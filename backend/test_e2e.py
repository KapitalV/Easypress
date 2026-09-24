"""
End-to-End System Test Suite for EasyPress
Tests all backend API endpoints, compression engines, downloads,
zip archives, enrollment pipeline, and frontend HTTP serving.
"""

import io
import json
import sys
import time
import zipfile
import urllib.request
import urllib.error
from PIL import Image, ImageDraw

BACKEND_URL = "http://127.0.0.1:8000"
FRONTEND_URL = "http://localhost:3000"

passed_tests = 0
failed_tests = 0

def log_pass(msg):
    global passed_tests
    passed_tests += 1
    print(f"  [PASS] {msg}")

def log_fail(msg, err=None):
    global failed_tests
    failed_tests += 1
    print(f"  [FAIL] {msg} -> {err}")

def create_sample_photo(width=1200, height=1600) -> bytes:
    img = Image.new("RGB", (width, height), color=(180, 210, 235))
    draw = ImageDraw.Draw(img)
    # Draw photo elements
    for y in range(0, height, 15):
        for x in range(0, width, 15):
            c = (x % 255, y % 255, (x * 3 + y * 2) % 255)
            draw.point((x, y), fill=c)
    draw.ellipse([width//4, height//4, width*3//4, height*3//4], fill=(235, 195, 165))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

def create_sample_signature(width=800, height=300) -> bytes:
    img = Image.new("RGBA", (width, height), color=(255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    draw.line([(60, 150), (220, 90), (380, 210), (550, 110), (740, 180)], fill=(0, 20, 130, 255), width=8)
    draw.arc([100, 100, 300, 240], start=0, end=180, fill=(0, 20, 130, 255), width=6)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

def build_multipart(fields: dict, files: list) -> tuple:
    boundary = "----WebKitFormBoundaryE2ETest" + str(int(time.time()))
    body = io.BytesIO()

    for name, val in fields.items():
        body.write(f"--{boundary}\r\n".encode())
        body.write(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        body.write(f"{val}\r\n".encode())

    for field_name, filename, data, mime in files:
        body.write(f"--{boundary}\r\n".encode())
        body.write(f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"\r\n'.encode())
        body.write(f"Content-Type: {mime}\r\n\r\n".encode())
        body.write(data)
        body.write(b"\r\n")

    body.write(f"--{boundary}--\r\n".encode())
    content_type = f"multipart/form-data; boundary={boundary}"
    return content_type, body.getvalue()

def test_health():
    print("\n--- 1. Backend Health Check ---")
    try:
        req = urllib.request.Request(f"{BACKEND_URL}/health")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            if resp.status == 200 and data.get("status") == "healthy":
                log_pass("GET /health returned 200 healthy")
            else:
                log_fail(f"GET /health unexpected response: {data}")
    except Exception as e:
        log_fail("GET /health failed", e)

def test_batch_optimal():
    print("\n--- 2. General Batch Compression (Optimal Mode) ---")
    try:
        img1 = create_sample_photo(600, 800)
        img2 = create_sample_signature(400, 200)

        content_type, body = build_multipart(
            fields={"mode": "optimal"},
            files=[
                ("files", "test1.png", img1, "image/png"),
                ("files", "test2.png", img2, "image/png"),
            ]
        )

        req = urllib.request.Request(f"{BACKEND_URL}/api/v1/jobs", data=body)
        req.add_header("Content-Type", content_type)

        with urllib.request.urlopen(req, timeout=10) as resp:
            res_data = json.loads(resp.read().decode())
            job_id = res_data["job_id"]
            log_pass(f"Created job {job_id} with 2 files")

        # Poll status until completed
        for _ in range(30):
            time.sleep(0.5)
            status_req = urllib.request.Request(f"{BACKEND_URL}/api/v1/jobs/{job_id}")
            with urllib.request.urlopen(status_req, timeout=5) as sresp:
                sdata = json.loads(sresp.read().decode())
                if sdata["status"] == "completed":
                    log_pass(f"Job {job_id} processing completed")
                    break
        else:
            log_fail(f"Job {job_id} did not finish within timeout")
            return

        # Check individual file download
        file0 = sdata["files"][0]
        file_id = file0["file_id"]
        dl_url = f"{BACKEND_URL}/api/v1/download/{job_id}/{file_id}"
        with urllib.request.urlopen(dl_url, timeout=5) as dl_resp:
            dl_bytes = dl_resp.read()
            if len(dl_bytes) > 0:
                log_pass(f"Downloaded compressed single file: {len(dl_bytes)} bytes")
            else:
                log_fail("Downloaded compressed file is empty")

        # Check original file download
        orig_url = f"{BACKEND_URL}/api/v1/download/{job_id}/{file_id}/original"
        with urllib.request.urlopen(orig_url, timeout=5) as orig_resp:
            orig_bytes = orig_resp.read()
            if len(orig_bytes) == len(img1):
                log_pass(f"Downloaded original comparison file: {len(orig_bytes)} bytes (matches uploaded)")
            else:
                log_fail(f"Original file size mismatch: {len(orig_bytes)} != {len(img1)}")

        # Check batch ZIP download
        zip_url = f"{BACKEND_URL}/api/v1/download/{job_id}"
        with urllib.request.urlopen(zip_url, timeout=5) as z_resp:
            zip_bytes = z_resp.read()
            zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
            file_list = zf.namelist()
            if len(file_list) == 2:
                log_pass(f"Downloaded ZIP with {len(file_list)} files: {file_list}")
            else:
                log_fail(f"ZIP files count unexpected: {file_list}")

    except Exception as e:
        log_fail("General batch optimal failed", e)

def test_batch_target():
    print("\n--- 3. General Batch Compression (Target Mode: 25KB-45KB) ---")
    try:
        import os
        # Create a realistic image that starts at ~450KB to test bisection downsampling
        raw_pixels = os.urandom(800 * 800 * 3)
        pil_img = Image.frombytes("RGB", (800, 800), raw_pixels)
        buf = io.BytesIO()
        pil_img.save(buf, format="JPEG", quality=85)
        img_bytes = buf.getvalue()

        content_type, body = build_multipart(
            fields={
                "mode": "target",
                "target_min_kb": "25",
                "target_max_kb": "45",
            },
            files=[
                ("files", "target_sample.jpg", img_bytes, "image/jpeg"),
            ]
        )

        req = urllib.request.Request(f"{BACKEND_URL}/api/v1/jobs", data=body)
        req.add_header("Content-Type", content_type)

        with urllib.request.urlopen(req, timeout=10) as resp:
            res_data = json.loads(resp.read().decode())
            job_id = res_data["job_id"]
            log_pass(f"Target mode job created: {job_id}")

        for _ in range(30):
            time.sleep(0.5)
            status_req = urllib.request.Request(f"{BACKEND_URL}/api/v1/jobs/{job_id}")
            with urllib.request.urlopen(status_req, timeout=5) as sresp:
                sdata = json.loads(sresp.read().decode())
                if sdata["status"] == "completed":
                    break

        file0 = sdata["files"][0]
        size_kb = file0["compressed_size"] / 1024
        print(f"     Original: {len(img_bytes)/1024:.1f} KB -> Target range: 25-45 KB | Result: {size_kb:.1f} KB (Quality: {file0.get('quality')}, Downsampled: {file0.get('was_downsampled')})")
        if 25.0 <= size_kb <= 45.0:
            log_pass(f"Target compression strictly within target window: {size_kb:.1f} KB")
        else:
            log_fail(f"Target compression outside acceptable bounds: {size_kb:.1f} KB")

    except Exception as e:
        log_fail("Target mode compression failed", e)

def test_dual_enrollment():
    print("\n--- 4. Dual Photo & Signature Enrollment Compression ---")
    try:
        photo_bytes = create_sample_photo(1200, 1600)
        sign_bytes = create_sample_signature(800, 300)
        candidate_name = "vikram_singh"

        content_type, body = build_multipart(
            fields={"prefix": candidate_name},
            files=[
                ("photo", "applicant_pic.png", photo_bytes, "image/png"),
                ("signature", "applicant_sig.png", sign_bytes, "image/png"),
            ]
        )

        req = urllib.request.Request(f"{BACKEND_URL}/api/v1/jobs/enrollment", data=body)
        req.add_header("Content-Type", content_type)

        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
            log_pass("POST /api/v1/jobs/enrollment returned 200 OK")

        job_id = data["job_id"]
        photo_info = data["photo"]
        sign_info = data["signature"]

        # Verify photo specs
        photo_name = photo_info["output_filename"]
        photo_kb = photo_info["compressed_size"] / 1024
        if photo_name == f"{candidate_name}_image.jpg":
            log_pass(f"Photo filename custom-renamed properly: {photo_name}")
        else:
            log_fail(f"Photo filename wrong: {photo_name}")

        print(f"     Photo size: {photo_kb:.1f} KB (Required: 30KB - 50KB)")
        if 28.0 <= photo_kb <= 52.0:
            log_pass(f"Photo strictly within/adjacent to 30KB–50KB target: {photo_kb:.1f} KB")
        else:
            log_fail(f"Photo size out of range: {photo_kb:.1f} KB")

        # Verify signature specs
        sign_name = sign_info["output_filename"]
        sign_kb = sign_info["compressed_size"] / 1024
        if sign_name == f"{candidate_name}_sign.jpg":
            log_pass(f"Signature filename custom-renamed properly: {sign_name}")
        else:
            log_fail(f"Signature filename wrong: {sign_name}")

        print(f"     Signature size: {sign_kb:.1f} KB (Required: 10KB - 30KB)")
        if 9.0 <= sign_kb <= 31.0:
            log_pass(f"Signature strictly within/adjacent to 10KB–30KB target: {sign_kb:.1f} KB")
        else:
            log_fail(f"Signature size out of range: {sign_kb:.1f} KB")

        # Verify photo download endpoint & JPEG format
        photo_dl = f"{BACKEND_URL}{data['photo_download_url']}"
        with urllib.request.urlopen(photo_dl, timeout=5) as p_resp:
            p_bytes = p_resp.read()
            # Verify JPEG magic bytes
            if p_bytes[:3] == b"\xff\xd8\xff":
                log_pass(f"Photo download verified: {len(p_bytes)} bytes, valid JPEG magic bytes")
            else:
                log_fail("Photo download is not valid JPEG")

        # Verify signature download endpoint & JPEG format
        sign_dl = f"{BACKEND_URL}{data['sign_download_url']}"
        with urllib.request.urlopen(sign_dl, timeout=5) as s_resp:
            s_bytes = s_resp.read()
            if s_bytes[:3] == b"\xff\xd8\xff":
                log_pass(f"Signature download verified: {len(s_bytes)} bytes, valid JPEG magic bytes")
            else:
                log_fail("Signature download is not valid JPEG")

        # Verify ZIP download containing both renamed files
        zip_dl = f"{BACKEND_URL}{data['zip_download_url']}"
        with urllib.request.urlopen(zip_dl, timeout=5) as z_resp:
            z_bytes = z_resp.read()
            zf = zipfile.ZipFile(io.BytesIO(z_bytes))
            namelist = zf.namelist()
            expected = [f"{candidate_name}_image.jpg", f"{candidate_name}_sign.jpg"]
            if set(namelist) == set(expected):
                log_pass(f"Enrollment ZIP download verified with both files: {namelist}")
            else:
                log_fail(f"Enrollment ZIP contents unexpected: {namelist} != {expected}")

    except Exception as e:
        log_fail("Dual enrollment test failed", e)

def test_extend_small_file_target():
    print("\n--- 5. Small Image Extension (Low Quality/Size Extended to Target: 10KB -> 30-50KB) ---")
    try:
        # Create a small 5KB-10KB photo
        small_photo = Image.new("RGB", (300, 400), color=(180, 200, 220))
        draw = ImageDraw.Draw(small_photo)
        draw.ellipse([80, 80, 220, 260], fill=(220, 180, 150))
        p_buf = io.BytesIO()
        small_photo.save(p_buf, format="JPEG", quality=75)
        small_photo_bytes = p_buf.getvalue()
        small_photo_kb = len(small_photo_bytes) / 1024
        print(f"     Uploaded small photo: {small_photo_kb:.1f} KB (Target: 30KB - 50KB)")

        # Create a small 1KB-2KB signature
        small_sign = Image.new("RGBA", (400, 150), color=(255, 255, 255, 0))
        sdraw = ImageDraw.Draw(small_sign)
        sdraw.line([(20, 75), (100, 30), (200, 100), (350, 50)], fill=(0, 0, 150, 255), width=5)
        s_buf = io.BytesIO()
        small_sign.save(s_buf, format="PNG")
        small_sign_bytes = s_buf.getvalue()
        small_sign_kb = len(small_sign_bytes) / 1024
        print(f"     Uploaded small signature: {small_sign_kb:.1f} KB (Target: 10KB - 30KB)")

        # Test Batch Target Extension
        content_type, body = build_multipart(
            fields={
                "mode": "target",
                "target_min_kb": "30",
                "target_max_kb": "50",
            },
            files=[
                ("files", "small_photo.jpg", small_photo_bytes, "image/jpeg"),
            ]
        )
        req = urllib.request.Request(f"{BACKEND_URL}/api/v1/jobs", data=body)
        req.add_header("Content-Type", content_type)
        with urllib.request.urlopen(req, timeout=10) as resp:
            res_data = json.loads(resp.read().decode())
            job_id = res_data["job_id"]

        for _ in range(30):
            time.sleep(0.5)
            status_req = urllib.request.Request(f"{BACKEND_URL}/api/v1/jobs/{job_id}")
            with urllib.request.urlopen(status_req, timeout=5) as sresp:
                sdata = json.loads(sresp.read().decode())
                if sdata["status"] == "completed":
                    break

        file0 = sdata["files"][0]
        size_kb = file0["compressed_size"] / 1024
        print(f"     Batch Target result: {small_photo_kb:.1f} KB -> {size_kb:.1f} KB (Target: 30KB - 50KB)")
        if 30.0 <= size_kb <= 50.0:
            log_pass(f"Small file successfully extended to target range: {size_kb:.1f} KB")
        else:
            log_fail(f"Small file not extended to target range: {size_kb:.1f} KB")

        # Test Enrollment Extension with custom ranges
        content_type_enroll, body_enroll = build_multipart(
            fields={
                "prefix": "rohit",
                "photo_min_kb": "30",
                "photo_max_kb": "50",
                "sign_min_kb": "10",
                "sign_max_kb": "30",
            },
            files=[
                ("photo", "small_photo.jpg", small_photo_bytes, "image/jpeg"),
                ("signature", "small_sign.png", small_sign_bytes, "image/png"),
            ]
        )
        req_enroll = urllib.request.Request(f"{BACKEND_URL}/api/v1/jobs/enrollment", data=body_enroll)
        req_enroll.add_header("Content-Type", content_type_enroll)
        with urllib.request.urlopen(req_enroll, timeout=15) as resp_enroll:
            enroll_data = json.loads(resp_enroll.read().decode())
            log_pass("Enrollment with small files returned 200 OK")

        e_photo_kb = enroll_data["photo"]["compressed_size"] / 1024
        e_sign_kb = enroll_data["signature"]["compressed_size"] / 1024
        print(f"     Enrollment Photo: {small_photo_kb:.1f} KB -> {e_photo_kb:.1f} KB (Target: 30-50 KB)")
        print(f"     Enrollment Sign: {small_sign_kb:.1f} KB -> {e_sign_kb:.1f} KB (Target: 10-30 KB)")

        if 30.0 <= e_photo_kb <= 50.0:
            log_pass(f"Enrollment photo extended to target range: {e_photo_kb:.1f} KB")
        else:
            log_fail(f"Enrollment photo out of range: {e_photo_kb:.1f} KB")

        if 10.0 <= e_sign_kb <= 30.0:
            log_pass(f"Enrollment signature extended to target range: {e_sign_kb:.1f} KB")
        else:
            log_fail(f"Enrollment signature out of range: {e_sign_kb:.1f} KB")

    except Exception as e:
        log_fail("Small file extension test failed", e)

def test_validation_and_errors():
    print("\n--- 5. Security & Input Validation ---")
    # Test 1: Upload non-image data
    try:
        content_type, body = build_multipart(
            fields={"mode": "optimal"},
            files=[("files", "malicious.txt", b"Hello not an image", "text/plain")]
        )
        req = urllib.request.Request(f"{BACKEND_URL}/api/v1/jobs", data=body)
        req.add_header("Content-Type", content_type)
        try:
            urllib.request.urlopen(req, timeout=5)
            log_fail("Non-image upload should have been rejected with 422")
        except urllib.error.HTTPError as he:
            if he.code in (400, 422):
                log_pass(f"Rejected invalid MIME file with status {he.code}")
            else:
                log_fail(f"Unexpected status for invalid file: {he.code}")
    except Exception as e:
        log_fail("Validation test 1 error", e)

    # Test 2: Invalid target bounds (min > max)
    try:
        content_type, body = build_multipart(
            fields={"mode": "target", "target_min_kb": "100", "target_max_kb": "50"},
            files=[("files", "img.png", create_sample_photo(100, 100), "image/png")]
        )
        req = urllib.request.Request(f"{BACKEND_URL}/api/v1/jobs", data=body)
        req.add_header("Content-Type", content_type)
        try:
            urllib.request.urlopen(req, timeout=5)
            log_fail("target_min > target_max should have been rejected with 400")
        except urllib.error.HTTPError as he:
            if he.code == 400:
                log_pass("Rejected invalid target range (min > max) with HTTP 400")
            else:
                log_fail(f"Unexpected status for bad range: {he.code}")
    except Exception as e:
        log_fail("Validation test 2 error", e)

def test_frontend():
    print("\n--- 6. Frontend Dev Server Health & HTML Rendering ---")
    try:
        req = urllib.request.Request(FRONTEND_URL)
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8")
            if resp.status == 200:
                log_pass("Frontend GET / returned HTTP 200 OK")
            else:
                log_fail(f"Frontend returned status {resp.status}")

            # Check presence of key text and components
            keywords = ["EasyPress", "Photo & Signature", "Government", "Enrollment", "Batch"]
            found = [kw for kw in keywords if kw.lower() in html.lower()]
            if len(found) >= 3:
                log_pass(f"Frontend HTML contains application keywords: {found}")
            else:
                log_fail(f"Frontend HTML missing expected keywords: {found}")
    except Exception as e:
        log_fail("Frontend test failed", e)

if __name__ == "__main__":
    print("==================================================")
    print("  EasyPress Comprehensive End-to-End Test Suite  ")
    print("==================================================")
    test_health()
    test_batch_optimal()
    test_batch_target()
    test_dual_enrollment()
    test_extend_small_file_target()
    test_validation_and_errors()
    test_frontend()

    print("\n==================================================")
    print(f"  Summary: {passed_tests} PASSED, {failed_tests} FAILED")
    print("==================================================")
    if failed_tests > 0:
        sys.exit(1)
    else:
        sys.exit(0)
