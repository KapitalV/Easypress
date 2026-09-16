"""
Jobs API Endpoints
Handles file upload, job creation, status polling, and SSE progress streaming.
"""

import asyncio
import json
import uuid
import time
from typing import Dict, List, Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from app.services.validator import validate_file, ValidationError
from app.services.storage import StorageService
from app.services.image_engine import compress_optimal, compress_to_target

router = APIRouter()
storage = StorageService()

# In-memory job state (production would use Redis)
# Structure: { job_id: { status, files: { file_id: { ... } }, created_at, ... } }
jobs_store: Dict[str, dict] = {}

# SSE event queues per job (for real-time progress)
sse_queues: Dict[str, List[asyncio.Queue]] = {}


def _create_job() -> str:
    """Create a new job and return its ID."""
    job_id = str(uuid.uuid4())[:12]
    jobs_store[job_id] = {
        "job_id": job_id,
        "status": "pending",
        "files": {},
        "created_at": time.time(),
        "total_original_size": 0,
        "total_compressed_size": 0,
    }
    storage.create_job_dir(job_id)
    return job_id


def _publish_sse_event(job_id: str, event_data: dict):
    """Push an SSE event to all listeners for a job."""
    if job_id in sse_queues:
        for queue in sse_queues[job_id]:
            try:
                queue.put_nowait(event_data)
            except asyncio.QueueFull:
                pass


@router.post("/jobs")
async def create_job(
    files: List[UploadFile] = File(...),
    mode: str = Form(default="optimal"),
    target_min_kb: Optional[int] = Form(default=None),
    target_max_kb: Optional[int] = Form(default=None),
):
    """
    Upload images and create a compression job.

    - mode: "optimal" | "target"
    - target_min_kb / target_max_kb: only used when mode="target" (in KB)
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    if len(files) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 files per batch")

    # Validate target range
    if mode == "target":
        if target_min_kb is None or target_max_kb is None:
            raise HTTPException(status_code=400, detail="target_min_kb and target_max_kb are required for target mode")
        if target_min_kb < 1 or target_max_kb > 500:
            raise HTTPException(status_code=400, detail="Target range must be between 1KB and 500KB")
        if target_min_kb > target_max_kb:
            raise HTTPException(status_code=400, detail="target_min_kb must be ≤ target_max_kb")

    job_id = _create_job()
    job = jobs_store[job_id]
    file_infos = []

    # Read and validate all files
    for upload_file in files:
        try:
            data = await upload_file.read()
            filename = upload_file.filename or "unknown"

            # Validate file
            validation = validate_file(data, filename)
            file_id = storage.generate_file_id()

            # Save upload
            storage.save_upload(job_id, file_id, filename, data)

            file_info = {
                "file_id": file_id,
                "original_filename": filename,
                "mime_type": validation["mime_type"],
                "original_size": validation["size_bytes"],
                "width": validation.get("width"),
                "height": validation.get("height"),
                "status": "pending",
                "progress": 0,
                "compressed_size": None,
                "savings_percent": None,
            }
            job["files"][file_id] = file_info
            job["total_original_size"] += validation["size_bytes"]
            file_infos.append(file_info)

        except ValidationError as e:
            raise HTTPException(status_code=422, detail={
                "error": e.code,
                "message": e.message,
                "filename": upload_file.filename,
            })
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error processing {upload_file.filename}: {str(e)}")

    # Start async compression in background
    job["status"] = "processing"
    asyncio.create_task(_process_job(
        job_id, mode,
        target_min_kb * 1024 if target_min_kb else None,
        target_max_kb * 1024 if target_max_kb else None,
    ))

    return {
        "job_id": job_id,
        "status": "processing",
        "file_count": len(file_infos),
        "files": file_infos,
        "total_original_size": job["total_original_size"],
    }


async def _process_job(
    job_id: str,
    mode: str,
    target_min_bytes: Optional[int],
    target_max_bytes: Optional[int],
):
    """Background task to process all files in a job."""
    job = jobs_store.get(job_id)
    if not job:
        return

    total_files = len(job["files"])
    completed = 0

    for file_id, file_info in job["files"].items():
        try:
            file_info["status"] = "processing"
            file_info["progress"] = 10

            _publish_sse_event(job_id, {
                "type": "file_progress",
                "file_id": file_id,
                "status": "processing",
                "progress": 10,
            })

            # Read the uploaded file
            data = storage.get_upload(job_id, file_id)
            if data is None:
                file_info["status"] = "error"
                file_info["error"] = "File not found in storage"
                continue

            file_info["progress"] = 30
            _publish_sse_event(job_id, {
                "type": "file_progress",
                "file_id": file_id,
                "status": "processing",
                "progress": 30,
            })

            # Run compression (CPU-bound — run in thread pool)
            loop = asyncio.get_event_loop()
            if mode == "target" and target_min_bytes and target_max_bytes:
                result = await loop.run_in_executor(
                    None,
                    compress_to_target,
                    data,
                    file_info["mime_type"],
                    target_min_bytes,
                    target_max_bytes,
                    None,
                )
            else:
                result = await loop.run_in_executor(
                    None,
                    compress_optimal,
                    data,
                    file_info["mime_type"],
                )

            file_info["progress"] = 80
            _publish_sse_event(job_id, {
                "type": "file_progress",
                "file_id": file_id,
                "status": "processing",
                "progress": 80,
            })

            # Determine output extension
            ext_map = {"jpeg": ".jpg", "png": ".png", "webp": ".webp", "gif": ".gif", "svg": ".svg"}
            out_ext = ext_map.get(result.format, ".jpg")
            out_filename = file_id + out_ext

            # Save compressed file
            storage.save_compressed(job_id, file_id, out_filename, result.data)

            # Update file info
            file_info["status"] = "completed"
            file_info["progress"] = 100
            file_info["compressed_size"] = result.compressed_size
            file_info["savings_percent"] = result.savings_percent
            file_info["quality"] = result.quality
            file_info["was_downsampled"] = result.was_downsampled
            if result.width:
                file_info["output_width"] = result.width
            if result.height:
                file_info["output_height"] = result.height

            job["total_compressed_size"] += result.compressed_size
            completed += 1

            _publish_sse_event(job_id, {
                "type": "file_complete",
                "file_id": file_id,
                "status": "completed",
                "progress": 100,
                "compressed_size": result.compressed_size,
                "savings_percent": result.savings_percent,
                "batch_progress": round(completed / total_files * 100),
            })

            # Small delay to allow SSE to flush
            await asyncio.sleep(0.1)

        except Exception as e:
            file_info["status"] = "error"
            file_info["error"] = str(e)
            file_info["progress"] = 100
            completed += 1

            _publish_sse_event(job_id, {
                "type": "file_error",
                "file_id": file_id,
                "status": "error",
                "error": str(e),
                "batch_progress": round(completed / total_files * 100),
            })

    # Mark job complete
    job["status"] = "completed"
    total_savings = 0
    if job["total_original_size"] > 0:
        total_savings = round(
            (1 - job["total_compressed_size"] / job["total_original_size"]) * 100, 1
        )

    _publish_sse_event(job_id, {
        "type": "job_complete",
        "status": "completed",
        "total_original_size": job["total_original_size"],
        "total_compressed_size": job["total_compressed_size"],
        "total_savings_percent": total_savings,
    })


@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Get current status of a compression job."""
    job = jobs_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    total_savings = 0
    if job["total_original_size"] > 0 and job["total_compressed_size"] > 0:
        total_savings = round(
            (1 - job["total_compressed_size"] / job["total_original_size"]) * 100, 1
        )

    return {
        "job_id": job["job_id"],
        "status": job["status"],
        "files": list(job["files"].values()),
        "total_original_size": job["total_original_size"],
        "total_compressed_size": job["total_compressed_size"],
        "total_savings_percent": total_savings,
    }


@router.get("/jobs/{job_id}/events")
async def job_events(job_id: str, request: Request):
    """SSE endpoint for real-time job progress updates."""
    job = jobs_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    queue = asyncio.Queue(maxsize=100)

    if job_id not in sse_queues:
        sse_queues[job_id] = []
    sse_queues[job_id].append(queue)

    async def event_generator():
        try:
            # Send initial state
            yield {
                "event": "init",
                "data": json.dumps({
                    "job_id": job_id,
                    "status": job["status"],
                    "file_count": len(job["files"]),
                    "files": {fid: {"status": f["status"], "progress": f["progress"]}
                              for fid, f in job["files"].items()},
                }),
            }

            # If already completed, send final state and close
            if job["status"] == "completed":
                yield {
                    "event": "job_complete",
                    "data": json.dumps({
                        "status": "completed",
                        "total_original_size": job["total_original_size"],
                        "total_compressed_size": job["total_compressed_size"],
                    }),
                }
                return

            # Stream events
            while True:
                if await request.is_disconnected():
                    break

                try:
                    event_data = await asyncio.wait_for(queue.get(), timeout=30)
                    yield {
                        "event": event_data.get("type", "message"),
                        "data": json.dumps(event_data),
                    }

                    # Stop streaming after job completion
                    if event_data.get("type") == "job_complete":
                        break

                except asyncio.TimeoutError:
                    # Send keepalive
                    yield {"event": "ping", "data": "{}"}

        finally:
            # Cleanup queue
            if job_id in sse_queues and queue in sse_queues[job_id]:
                sse_queues[job_id].remove(queue)
                if not sse_queues[job_id]:
                    del sse_queues[job_id]

    return EventSourceResponse(event_generator())


@router.post("/jobs/enrollment")
async def create_enrollment_job(
    photo: UploadFile = File(...),
    signature: UploadFile = File(...),
    prefix: str = Form(default="candidate"),
):
    """
    Dedicated Enrollment Compression:
    - Photo compressed to 30KB–50KB range, converted to JPEG, named '{prefix}_image.jpg'
    - Signature compressed to 10KB–30KB range, converted to JPEG, named '{prefix}_sign.jpg'
    """
    clean_prefix = "".join(c for c in prefix.strip() if c.isalnum() or c in ("-", "_")).lower()
    if not clean_prefix:
        clean_prefix = "candidate"

    photo_min = 30 * 1024
    photo_max = 50 * 1024
    sign_min = 10 * 1024
    sign_max = 30 * 1024

    photo_data = await photo.read()
    sign_data = await signature.read()

    photo_validation = validate_file(photo_data, photo.filename or "photo.jpg")
    sign_validation = validate_file(sign_data, signature.filename or "sign.jpg")

    job_id = _create_job()
    job = jobs_store[job_id]

    photo_file_id = f"{clean_prefix}_image"
    sign_file_id = f"{clean_prefix}_sign"

    # Save original uploads
    storage.save_upload(job_id, photo_file_id, f"{clean_prefix}_image_orig.jpg", photo_data)
    storage.save_upload(job_id, sign_file_id, f"{clean_prefix}_sign_orig.jpg", sign_data)

    loop = asyncio.get_event_loop()
    photo_res = await loop.run_in_executor(
        None,
        compress_to_target,
        photo_data,
        photo_validation["mime_type"],
        photo_min,
        photo_max,
        None,
        "jpeg",
    )

    sign_res = await loop.run_in_executor(
        None,
        compress_to_target,
        sign_data,
        sign_validation["mime_type"],
        sign_min,
        sign_max,
        None,
        "jpeg",
    )

    photo_filename = f"{clean_prefix}_image.jpg"
    sign_filename = f"{clean_prefix}_sign.jpg"

    storage.save_compressed(job_id, photo_file_id, photo_filename, photo_res.data)
    storage.save_compressed(job_id, sign_file_id, sign_filename, sign_res.data)

    photo_info = {
        "file_id": photo_file_id,
        "original_filename": photo.filename or "photo.jpg",
        "output_filename": photo_filename,
        "mime_type": "image/jpeg",
        "original_size": len(photo_data),
        "compressed_size": photo_res.compressed_size,
        "savings_percent": photo_res.savings_percent,
        "status": "completed",
        "quality": photo_res.quality,
        "width": photo_res.width,
        "height": photo_res.height,
        "target_range": "30KB - 50KB",
    }

    sign_info = {
        "file_id": sign_file_id,
        "original_filename": signature.filename or "signature.jpg",
        "output_filename": sign_filename,
        "mime_type": "image/jpeg",
        "original_size": len(sign_data),
        "compressed_size": sign_res.compressed_size,
        "savings_percent": sign_res.savings_percent,
        "status": "completed",
        "quality": sign_res.quality,
        "width": sign_res.width,
        "height": sign_res.height,
        "target_range": "10KB - 30KB",
    }

    job["status"] = "completed"
    job["files"] = {
        photo_file_id: photo_info,
        sign_file_id: sign_info,
    }
    job["total_original_size"] = len(photo_data) + len(sign_data)
    job["total_compressed_size"] = photo_res.compressed_size + sign_res.compressed_size

    return {
        "job_id": job_id,
        "status": "completed",
        "prefix": clean_prefix,
        "photo": photo_info,
        "signature": sign_info,
        "photo_download_url": f"/api/v1/download/{job_id}/{photo_file_id}",
        "sign_download_url": f"/api/v1/download/{job_id}/{sign_file_id}",
        "zip_download_url": f"/api/v1/download/{job_id}",
    }
