import urllib.request
import re
import ssl
import time

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

print("Monitoring Vercel deployment...")
for i in range(20):
    try:
        req = urllib.request.Request("https://easypress.vishalsahu.tech", headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, context=ctx, timeout=5) as r:
            html = r.read().decode()
            etag = r.headers.get("ETag", "")
            js_files = re.findall(r'src="(/_next/static/[^"]+\.js)"', html)
            found = False
            for js in js_files:
                jreq = urllib.request.Request(f"https://easypress.vishalsahu.tech{js}", headers={"User-Agent": "Mozilla/5.0"})
                try:
                    with urllib.request.urlopen(jreq, context=ctx, timeout=5) as jr:
                        content = jr.read().decode("utf-8", errors="ignore")
                        if "clientCompressor" in content or "clientBlobRegistry" in content or "JSZip" in content or "compressToTargetClient" in content:
                            print(f">>> SUCCESS: New client-side engine deployed live on Vercel in {js}!")
                            found = True
                            break
                except Exception:
                    pass
            if found:
                print("Live website is ready!")
                break
            else:
                print(f"Attempt {i+1}: Vercel build in progress... (ETag: {etag[:10]}...)")
    except Exception as e:
        print(f"Waiting... ({e})")
    time.sleep(6)
