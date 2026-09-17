"""
Image Compressor — FastAPI Application
High-performance image compression API with SSE progress streaming.
"""

import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.endpoints import jobs, download
from app.services.storage import StorageService


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup & shutdown hooks."""
    # Startup — initialize storage directories and TTL cleanup
    storage = StorageService()
    storage.ensure_directories()

    # Launch background TTL cleanup task
    cleanup_task = asyncio.create_task(storage.run_ttl_cleanup_loop(interval_seconds=300))

    yield

    # Shutdown — cancel cleanup
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass


def create_app() -> FastAPI:
    """Application factory."""
    app = FastAPI(
        title="Image Compressor API",
        description="High-performance image compression with exact target file-size engine (10KB–50KB)",
        version="1.0.0",
        lifespan=lifespan,
    )

    # CORS — allow Next.js dev server
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "https://easypress.vishalsahu.tech",
            "https://www.easypress.vishalsahu.tech",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Mount API routes
    app.include_router(jobs.router, prefix="/api/v1", tags=["jobs"])
    app.include_router(download.router, prefix="/api/v1", tags=["download"])

    @app.get("/health")
    async def health_check():
        return {"status": "healthy", "service": "image-compressor"}

    return app


app = create_app()
