from __future__ import annotations

import json
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, File, Form, UploadFile

from ..catalogue import get_exercise
from ..config import UPLOADS_DIR
from ..errors import ApiError
from ..gates import (
    require_duration,
    require_exercise,
    require_job,
    require_job_done,
    require_probe_ok,
    require_reference,
    require_reference_matches,
    require_video_upload,
    save_upload_capped,
)
from ..pipeline.runner import run_job
from ..schemas import JobCreated, JobStatusOut
from ..storage import create_job, get_job, job_dir

router = APIRouter()


@router.post("/jobs", response_model=JobCreated, status_code=202)
async def create_job_route(
    video: UploadFile = File(...),
    exercise: str = Form(...),
    reference_id: str = Form(...),
    background_tasks: BackgroundTasks = None,
):
    require_exercise(exercise)
    reference = require_reference(reference_id)
    require_reference_matches(reference, exercise)
    require_video_upload(video)

    ext = Path(video.filename or "video.mp4").suffix.lower() or ".mp4"
    if ext not in {".mp4", ".mov", ".m4v"}:
        ext = ".mp4"
    job_id = uuid.uuid4().hex[:12]
    upload_path = UPLOADS_DIR / f"{job_id}{ext}"
    save_upload_capped(video, upload_path)
    info = require_probe_ok(upload_path)
    require_duration(info)

    record = create_job(job_id=job_id, status="queued", progress=0.0, exercise=exercise, reference_id=reference_id, upload_path=str(upload_path))
    if background_tasks is not None:
        background_tasks.add_task(run_job, job_id)
    else:
        run_job(job_id)
    return JobCreated(job_id=job_id)


@router.get("/jobs/{job_id}", response_model=JobStatusOut)
def get_job_status(job_id: str):
    job = require_job(job_id)
    return JobStatusOut(
        job_id=job["job_id"],
        status=job["status"],
        progress=float(job.get("progress", 0.0)),
        error=job.get("error"),
        exercise=job.get("exercise"),
        reference_id=job.get("reference_id"),
        created_at=job["created_at"],
    )


@router.get("/jobs/{job_id}/result")
def get_job_result(job_id: str):
    job = require_job(job_id)
    require_job_done(job)
    result_path = job_dir(job_id) / "result.json"
    if not result_path.exists():
        raise ApiError(404, "unknown_job", "Result file not found", {"job_id": job_id})
    with open(result_path, "r", encoding="utf-8") as fh:
        payload = json.load(fh)
    return payload
