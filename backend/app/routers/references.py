from __future__ import annotations

import re
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Body, Query

from ..catalogue import get_exercise
from ..config import DATA_ROOT, LIBRARY_DIR
from ..errors import ApiError
from ..gates import require_consent, require_exercise, require_job, require_job_done, require_not_promoted
from ..media import prepare, thumbnail, to_url
from ..pipeline import stubs
from ..schemas import CreateReferenceIn, ReferenceOut
from ..storage import add_reference, get_job, job_dir, list_references, update_job, load_library_index

router = APIRouter()


@router.get("/references", response_model=list[ReferenceOut])
def list_references_route(exercise: str = Query(...)):
    require_exercise(exercise)
    refs = list_references(exercise)
    refs = sorted(refs, key=lambda item: (0 if item.get("source") == "pro" else 1, str(item.get("name", "")).lower()))
    out = []
    for ref in refs:
        if ref.get("source") == "user" and ref.get("consent") is not True:
            continue
        out.append(
            ReferenceOut(
                id=ref["id"],
                name=ref["name"],
                exercise=ref["exercise"],
                source=ref["source"],
                video_url=ref.get("video_url") or "/files/library/placeholder.mp4",
                thumbnail_url=ref.get("thumbnail_url") or "/files/library/placeholder.jpg",
                smpl_pose_url=ref.get("smpl_pose_url"),
            )
        )
    return out


@router.post("/references", response_model=ReferenceOut, status_code=201)
def create_reference(body: CreateReferenceIn = Body(...)):
    require_consent(body)
    name = body.name.strip()
    if len(name) < 1 or len(name) > 40:
        raise ApiError(422, "invalid_request", "Reference name must be 1-40 characters after trimming", {"name": body.name})
    require_job(body.job_id)
    job = get_job(body.job_id)
    require_job_done(job)
    require_not_promoted(job)

    slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_") or "reference"
    ref_id = f"{slug}_{uuid.uuid4().hex[:6]}"
    library_dir = LIBRARY_DIR / ref_id
    library_dir.mkdir(parents=True, exist_ok=True)

    source_video = job_dir(body.job_id) / "prepared.mp4"
    prepared_video = library_dir / "video.mp4"
    if source_video.exists():
        shutil.copy2(source_video, prepared_video)
    else:
        raise ApiError(500, "internal_error", "Prepared video missing", {"job_id": body.job_id})

    pose = job_dir(body.job_id) / "user_pose.json"
    if pose.exists():
        shutil.copy2(pose, library_dir / "pose.json")
    else:
        pose_json = stubs.extract_pose(source_video)
        with open(library_dir / "pose.json", "w", encoding="utf-8") as fh:
            import json
            json.dump(pose_json.model_dump() if hasattr(pose_json, "model_dump") else pose_json, fh)

    thumb_path = library_dir / "thumbnail.jpg"
    thumbnail(source_video, 0.5, thumb_path)

    entry = {
        "id": ref_id,
        "name": name,
        "exercise": job.get("exercise"),
        "source": "user",
        "consent": True,
        "video_url": to_url(prepared_video),
        "thumbnail_url": to_url(thumb_path),
        "pose_path": str(library_dir / "pose.json"),
        "video_path": str(prepared_video),
        "rep": {"bottom": 0},
    }
    add_reference(entry)
    update_job(body.job_id, promoted_reference_id=ref_id)

    return ReferenceOut(
        id=entry["id"],
        name=entry["name"],
        exercise=entry["exercise"],
        source=entry["source"],
        video_url=entry["video_url"],
        thumbnail_url=entry["thumbnail_url"],
    )
