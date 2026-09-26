from __future__ import annotations

import os
import re
from pathlib import Path

from fastapi import UploadFile

from .catalogue import get_category, get_exercise
from .config import MAX_DURATION_S, MAX_UPLOAD_MB, MIN_DURATION_S, UPLOADS_DIR
from .errors import ApiError
from .media import probe
from .storage import get_job, get_reference

ALLOWED_VIDEO_MIME_TYPES = {"video/mp4", "video/quicktime", "video/x-m4v", "application/octet-stream"}
ALLOWED_EXTENSIONS = {".mp4", ".mov", ".m4v"}


def require_category(category_id: str):
    category = get_category(category_id)
    if category is None:
        raise ApiError(404, "unknown_category", f"Category '{category_id}' does not exist", {"category": category_id})
    return category


def require_exercise(exercise_id: str):
    exercise = get_exercise(exercise_id)
    if exercise is None:
        raise ApiError(404, "unknown_exercise", f"Exercise '{exercise_id}' does not exist", {"exercise": exercise_id})
    return exercise


def require_reference(reference_id: str):
    ref = get_reference(reference_id)
    if ref is None:
        raise ApiError(404, "unknown_reference", f"Reference '{reference_id}' does not exist", {"reference_id": reference_id})
    source = ref.get("source")
    consent = bool(ref.get("consent", False))
    if source != "pro" and not consent:
        raise ApiError(404, "unknown_reference", f"Reference '{reference_id}' does not exist", {"reference_id": reference_id})
    return ref


def require_reference_matches(reference: dict, exercise_id: str):
    if reference.get("exercise") != exercise_id:
        raise ApiError(422, "reference_exercise_mismatch", f"Reference '{reference.get('id')}' does not match exercise '{exercise_id}'", {"exercise": exercise_id, "reference_id": reference.get("id")})
    return reference


def require_video_upload(file: UploadFile):
    if file is None:
        raise ApiError(415, "unsupported_media_type", "Missing upload file", {})
    filename = (file.filename or "").lower()
    extension = Path(filename).suffix.lower()
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_VIDEO_MIME_TYPES and extension not in ALLOWED_EXTENSIONS:
        raise ApiError(415, "unsupported_media_type", "Unsupported media type", {"content_type": content_type, "filename": filename})
    return file


def save_upload_capped(file: UploadFile, dest: str | Path):
    path = Path(dest)
    path.parent.mkdir(parents=True, exist_ok=True)
    total = 0
    try:
        with open(path, "wb") as out:
            while True:
                chunk = file.file.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_UPLOAD_MB * 1024 * 1024:
                    raise ApiError(413, "file_too_large", f"Upload exceeds {MAX_UPLOAD_MB} MB limit", {"max_mb": MAX_UPLOAD_MB})
                out.write(chunk)
    except ApiError:
        if path.exists():
            path.unlink(missing_ok=True)
        raise
    except Exception:
        if path.exists():
            path.unlink(missing_ok=True)
        raise
    return path


def require_probe_ok(path: str | Path):
    try:
        info = probe(path)
    except Exception as exc:
        raise ApiError(415, "not_a_video", str(exc), {"path": str(path)}) from exc
    if info.get("width", 0) <= 0 or info.get("height", 0) <= 0:
        raise ApiError(415, "not_a_video", "Uploaded file is not a valid video", {"path": str(path)})
    return info


def require_duration(probe_info: dict):
    duration = float(probe_info.get("duration_s", 0.0))
    if duration < MIN_DURATION_S:
        raise ApiError(422, "video_too_short", f"Video must be at least {MIN_DURATION_S} seconds", {"duration_s": duration})
    if duration > MAX_DURATION_S + 0.5:
        raise ApiError(413, "video_too_long", f"Video exceeds maximum duration of {MAX_DURATION_S} seconds", {"duration_s": duration})
    return probe_info


def require_job(job_id: str):
    if not re.fullmatch(r"[0-9a-f]{12}", job_id):
        raise ApiError(404, "unknown_job", f"Job '{job_id}' does not exist", {"job_id": job_id})
    job = get_job(job_id)
    if job is None:
        raise ApiError(404, "unknown_job", f"Job '{job_id}' does not exist", {"job_id": job_id})
    return job


def require_job_done(job: dict):
    if job.get("status") == "done":
        return job
    if job.get("status") == "failed":
        raise ApiError(500, "job_failed", job.get("error") or "Job failed", {"job_id": job.get("job_id"), "error": job.get("error")})
    raise ApiError(409, "job_not_finished", "Job is not finished yet", {"job_id": job.get("job_id")})


def require_consent(body):
    if getattr(body, "consent", None) is not True:
        raise ApiError(400, "consent_required", "Consent is required to create a reference", {"consent": body.consent})
    return body


def require_not_promoted(job: dict):
    if job.get("promoted_reference_id") is not None:
        raise ApiError(409, "already_promoted", "This job has already been promoted", {"job_id": job.get("job_id")})
    return job
