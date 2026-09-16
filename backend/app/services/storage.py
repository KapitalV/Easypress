"""
Storage Service
Local filesystem storage with automated TTL cleanup.
Abstracts file I/O so it can be swapped to MinIO/S3 later.
"""

import asyncio
import os
import shutil
import time
import uuid
from pathlib import Path
from typing import List, Optional


# Base storage directory (relative to backend root)
BASE_DIR = Path(os.environ.get("STORAGE_DIR", "./data"))
UPLOADS_DIR = BASE_DIR / "uploads"
COMPRESSED_DIR = BASE_DIR / "compressed"

# TTL in seconds — files older than this are deleted
TTL_SECONDS = int(os.environ.get("STORAGE_TTL_SECONDS", "3600"))  # 60 minutes


class StorageService:
    """Local filesystem storage with TTL cleanup."""

    def __init__(self):
        self.uploads_dir = UPLOADS_DIR
        self.compressed_dir = COMPRESSED_DIR

    def ensure_directories(self):
        """Create storage directories if they don't exist."""
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        self.compressed_dir.mkdir(parents=True, exist_ok=True)

    def create_job_dir(self, job_id: str) -> Path:
        """Create a new job directory for uploads and compressed outputs."""
        upload_dir = self.uploads_dir / job_id
        compressed_dir = self.compressed_dir / job_id
        upload_dir.mkdir(parents=True, exist_ok=True)
        compressed_dir.mkdir(parents=True, exist_ok=True)
        return upload_dir

    def generate_file_id(self) -> str:
        """Generate a unique file ID."""
        return str(uuid.uuid4())[:8]

    def save_upload(self, job_id: str, file_id: str, filename: str, data: bytes) -> Path:
        """
        Save an uploaded file to the job's upload directory.
        Returns the path to the saved file.
        """
        # Sanitize filename — keep only the extension
        ext = Path(filename).suffix.lower()
        safe_name = f"{file_id}{ext}"
        file_path = self.uploads_dir / job_id / safe_name
        file_path.write_bytes(data)
        return file_path

    def save_compressed(self, job_id: str, file_id: str, filename: str, data: bytes) -> Path:
        """
        Save a compressed file to the job's compressed directory.
        Returns the path to the saved file.
        """
        ext = Path(filename).suffix.lower()
        safe_name = f"{file_id}{ext}"
        file_path = self.compressed_dir / job_id / safe_name
        file_path.write_bytes(data)
        return file_path

    def get_upload(self, job_id: str, file_id: str) -> Optional[bytes]:
        """Read an uploaded file's bytes."""
        job_dir = self.uploads_dir / job_id
        if not job_dir.exists():
            return None
        for f in job_dir.iterdir():
            if f.stem == file_id:
                return f.read_bytes()
        return None

    def get_compressed(self, job_id: str, file_id: str) -> Optional[bytes]:
        """Read a compressed file's bytes."""
        job_dir = self.compressed_dir / job_id
        if not job_dir.exists():
            return None
        for f in job_dir.iterdir():
            if f.stem == file_id:
                return f.read_bytes()
        return None

    def get_compressed_path(self, job_id: str, file_id: str) -> Optional[Path]:
        """Get the filesystem path to a compressed file."""
        job_dir = self.compressed_dir / job_id
        if not job_dir.exists():
            return None
        for f in job_dir.iterdir():
            if f.stem == file_id:
                return f
        return None

    def list_compressed_files(self, job_id: str) -> List[dict]:
        """List all compressed files for a job."""
        job_dir = self.compressed_dir / job_id
        if not job_dir.exists():
            return []
        files = []
        for f in sorted(job_dir.iterdir()):
            if f.is_file():
                files.append({
                    "file_id": f.stem,
                    "filename": f.name,
                    "size_bytes": f.stat().st_size,
                    "path": str(f),
                })
        return files

    def get_upload_path(self, job_id: str, file_id: str) -> Optional[Path]:
        """Get the filesystem path to an uploaded file."""
        job_dir = self.uploads_dir / job_id
        if not job_dir.exists():
            return None
        for f in job_dir.iterdir():
            if f.stem == file_id:
                return f
        return None

    def delete_job(self, job_id: str):
        """Delete all files for a job (both uploads and compressed)."""
        for base_dir in [self.uploads_dir, self.compressed_dir]:
            job_dir = base_dir / job_id
            if job_dir.exists():
                shutil.rmtree(job_dir, ignore_errors=True)

    def _cleanup_old_jobs(self):
        """Delete job directories older than TTL_SECONDS."""
        now = time.time()
        count = 0
        for base_dir in [self.uploads_dir, self.compressed_dir]:
            if not base_dir.exists():
                continue
            for job_dir in base_dir.iterdir():
                if job_dir.is_dir():
                    age = now - job_dir.stat().st_mtime
                    if age > TTL_SECONDS:
                        shutil.rmtree(job_dir, ignore_errors=True)
                        count += 1
        return count

    async def run_ttl_cleanup_loop(self, interval_seconds: int = 300):
        """Background loop that cleans up expired job directories."""
        while True:
            try:
                await asyncio.sleep(interval_seconds)
                deleted = self._cleanup_old_jobs()
                if deleted > 0:
                    print(f"[Storage] TTL cleanup: removed {deleted} expired job directories")
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"[Storage] TTL cleanup error: {e}")
