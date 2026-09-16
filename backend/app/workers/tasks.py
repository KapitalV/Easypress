"""
Celery Worker Tasks
Compression tasks that run in isolated worker processes.
Note: For the dev server, compression runs in-process via asyncio.
These tasks are for production deployment with Celery workers.
"""

from app.workers.celery_app import celery_app
from app.services.storage import StorageService
from app.services.image_engine import compress_optimal, compress_to_target

storage = StorageService()


@celery_app.task(bind=True, name="compress_image")
def compress_image_task(
    self,
    job_id: str,
    file_id: str,
    mime_type: str,
    mode: str = "optimal",
    target_min_bytes: int = None,
    target_max_bytes: int = None,
):
    """
    Compress a single image file.
    Updates task state for progress tracking.
    """
    try:
        # Update state: processing
        self.update_state(state="PROCESSING", meta={
            "file_id": file_id,
            "progress": 10,
            "status": "reading file",
        })

        # Read file from storage
        data = storage.get_upload(job_id, file_id)
        if data is None:
            raise FileNotFoundError(f"Upload not found: {job_id}/{file_id}")

        self.update_state(state="PROCESSING", meta={
            "file_id": file_id,
            "progress": 30,
            "status": "compressing",
        })

        # Compress
        if mode == "target" and target_min_bytes and target_max_bytes:
            result = compress_to_target(
                data, mime_type,
                target_min_bytes, target_max_bytes,
            )
        else:
            result = compress_optimal(data, mime_type)

        self.update_state(state="PROCESSING", meta={
            "file_id": file_id,
            "progress": 80,
            "status": "saving result",
        })

        # Save compressed output
        ext_map = {"jpeg": ".jpg", "png": ".png", "webp": ".webp", "gif": ".gif", "svg": ".svg"}
        out_ext = ext_map.get(result.format, ".jpg")
        out_filename = file_id + out_ext
        storage.save_compressed(job_id, file_id, out_filename, result.data)

        return {
            "file_id": file_id,
            "status": "completed",
            "original_size": result.original_size,
            "compressed_size": result.compressed_size,
            "savings_percent": result.savings_percent,
            "quality": result.quality,
            "was_downsampled": result.was_downsampled,
        }

    except Exception as e:
        self.update_state(state="FAILURE", meta={
            "file_id": file_id,
            "error": str(e),
        })
        raise
