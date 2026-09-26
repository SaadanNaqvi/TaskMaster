from __future__ import annotations

import shutil

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.staticfiles import StaticFiles

from .config import CORS_ORIGINS, DATA_ROOT, ensure_data_dirs
from .errors import ApiError, api_error_handler, unhandled_exception_handler, validation_error_handler
from .routers.exercises import router as exercises_router
from .routers.jobs import router as jobs_router
from .routers.references import router as references_router
from .storage import load_jobs_on_startup


def create_app() -> FastAPI:
    ensure_data_dirs()
    app = FastAPI(title="TaskMaster API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if CORS_ORIGINS == "*" else [origin.strip() for origin in CORS_ORIGINS.split(",") if origin.strip()],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.add_exception_handler(ApiError, api_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

    app.include_router(exercises_router)
    app.include_router(references_router)
    app.include_router(jobs_router)
    app.mount("/files", StaticFiles(directory=str(DATA_ROOT)), name="files")

    @app.get("/health")
    async def health() -> dict:
        ffmpeg_ok = shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None
        return {"ok": True, "stub": True, "ffmpeg": ffmpeg_ok, "version": "0.1.0"}

    @app.on_event("startup")
    async def startup() -> None:
        ensure_data_dirs()
        if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
            raise RuntimeError("ffmpeg and ffprobe must be on PATH")
        load_jobs_on_startup()

    @app.post('/jobs')
    def processJob(video, exerciseId):
        # get pkl file for exerciseID in server folders somehow 
        # combine pkl with video
        return "path"


    return app




app = create_app()
