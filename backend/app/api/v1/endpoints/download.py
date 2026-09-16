"""
Download API Endpoints
Handles individual file downloads and streaming ZIP archives for batch jobs.
"""

import io
from pathlib import Path
from typing import Generator

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, StreamingResponse

from app.services.storage import StorageService

router = APIRouter()
storage = StorageService()

# Import jobs store from jobs module
from app.api.v1.endpoints.jobs import jobs_store


def _get_original_filename(job_id: str, file_id: str) -> str:
    """Get the original filename for a file in a job."""
    job = jobs_store.get(job_id)
    if job and file_id in job["files"]:
        return job["files"][file_id].get("original_filename", f"{file_id}.jpg")
    return f"{file_id}.jpg"


@router.get("/download/{job_id}/{file_id}")
async def download_single_file(job_id: str, file_id: str):
    """Download a single compressed file."""
    job = jobs_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if file_id not in job["files"]:
        raise HTTPException(status_code=404, detail="File not found in job")

    file_info = job["files"][file_id]
    if file_info["status"] != "completed":
        raise HTTPException(status_code=409, detail="File has not been compressed yet")

    file_path = storage.get_compressed_path(job_id, file_id)
    if file_path is None or not file_path.exists():
        raise HTTPException(status_code=404, detail="Compressed file not found on disk")

    # Use output_filename if specified, else original filename with _compressed suffix
    if "output_filename" in file_info:
        download_name = file_info["output_filename"]
    else:
        original_name = file_info.get("original_filename", f"{file_id}.jpg")
        stem = Path(original_name).stem
        ext = file_path.suffix
        download_name = f"{stem}_compressed{ext}"

    return FileResponse(
        path=str(file_path),
        filename=download_name,
        media_type="application/octet-stream",
    )


@router.get("/download/{job_id}")
async def download_job(job_id: str):
    """Download all compressed files as a ZIP archive (or single file)."""
    job = jobs_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    completed_files = []
    for file_id, file_info in job["files"].items():
        if file_info["status"] == "completed":
            file_path = storage.get_compressed_path(job_id, file_id)
            if file_path and file_path.exists():
                if "output_filename" in file_info:
                    arcname = file_info["output_filename"]
                else:
                    original_name = file_info.get("original_filename", f"{file_id}.jpg")
                    stem = Path(original_name).stem
                    ext = file_path.suffix
                    arcname = f"{stem}_compressed{ext}"
                completed_files.append((file_path, arcname))

    if not completed_files:
        raise HTTPException(status_code=404, detail="No compressed files available")

    # Single file: direct download
    if len(completed_files) == 1:
        file_path, arcname = completed_files[0]
        return FileResponse(
            path=str(file_path),
            filename=arcname,
            media_type="application/octet-stream",
        )

    # Multiple files: streaming ZIP
    try:
        import zipstream
        HAS_ZIPSTREAM = True
    except ImportError:
        HAS_ZIPSTREAM = False

    if HAS_ZIPSTREAM:
        return _stream_zip_zipstream(completed_files, job_id)
    else:
        return _stream_zip_stdlib(completed_files, job_id)


def _stream_zip_zipstream(files: list, job_id: str) -> StreamingResponse:
    """Stream ZIP using zipstream-ng (memory-efficient)."""
    import zipstream

    z = zipstream.ZipFile(mode="w", compression=zipstream.ZIP_STORED)
    for file_path, arcname in files:
        z.write(str(file_path), arcname=arcname)

    def generator():
        for chunk in z:
            yield chunk

    return StreamingResponse(
        generator(),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="compressed_images_{job_id}.zip"',
        },
    )


def _stream_zip_stdlib(files: list, job_id: str) -> StreamingResponse:
    """Fallback: build ZIP in memory using stdlib zipfile (for small batches)."""
    import zipfile

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as zf:
        for file_path, arcname in files:
            zf.write(str(file_path), arcname=arcname)

    buf.seek(0)

    return StreamingResponse(
        iter([buf.read()]),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="compressed_images_{job_id}.zip"',
        },
    )


@router.get("/download/{job_id}/{file_id}/original")
async def download_original_file(job_id: str, file_id: str):
    """Download the original uploaded file (for comparison)."""
    job = jobs_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if file_id not in job["files"]:
        raise HTTPException(status_code=404, detail="File not found in job")

    file_path = storage.get_upload_path(job_id, file_id)
    if file_path is None or not file_path.exists():
        raise HTTPException(status_code=404, detail="Original file not found on disk")

    original_name = job["files"][file_id].get("original_filename", f"{file_id}.jpg")

    return FileResponse(
        path=str(file_path),
        filename=original_name,
        media_type="application/octet-stream",
    )
