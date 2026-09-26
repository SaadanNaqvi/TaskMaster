from __future__ import annotations

import json
import logging
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from .config import DATA_ROOT, LIBRARY_DIR, OUTPUTS_DIR

logger = logging.getLogger(__name__)

_INDEX_PATH = LIBRARY_DIR / "index.json"
_LIBRARY_LOCK = threading.Lock()
JOB_STORE: dict[str, dict] = {}
JOB_LOCK = threading.Lock()


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def atomic_write_json(path: Path, payload: object) -> None:
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    with _LIBRARY_LOCK:
        with open(tmp_path, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=2)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp_path, path)


def load_library_index() -> list[dict]:
    if not _INDEX_PATH.exists():
        return []
    try:
        with open(_INDEX_PATH, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, list) else []
    except Exception:
        logger.exception("Library index is corrupt: %s", _INDEX_PATH)
        raise


def _library_entry_path(entry_id: str) -> Path:
    return LIBRARY_DIR / entry_id


def list_references(exercise: str | None = None) -> list[dict]:
    refs = load_library_index()
    if exercise is None:
        return refs
    return [ref for ref in refs if ref.get("exercise") == exercise]


def get_reference(reference_id: str) -> dict | None:
    refs = load_library_index()
    for ref in refs:
        if ref.get("id") == reference_id:
            return ref
    return None


def add_reference(entry: dict) -> dict:
    refs = load_library_index()
    refs.append(entry)
    atomic_write_json(_INDEX_PATH, refs)
    return entry


def _job_file(job_id: str) -> Path:
    return OUTPUTS_DIR / job_id / "job.json"


def _job_record(job_id: str, **fields: object) -> dict:
    now = utc_now_iso()
    record = {
        "job_id": job_id,
        "status": "queued",
        "progress": 0.0,
        "error": None,
        "exercise": None,
        "reference_id": None,
        "created_at": now,
        "updated_at": now,
        "promoted_reference_id": None,
    }
    record.update(fields)
    return record


def load_jobs_on_startup() -> None:
    global JOB_STORE
    JOB_STORE = {}
    if not OUTPUTS_DIR.exists():
        return
    found = sorted(p for p in OUTPUTS_DIR.iterdir() if p.is_dir())
    for job_dir in found:
        job_file = job_dir / "job.json"
        if not job_file.exists():
            continue
        try:
            with open(job_file, "r", encoding="utf-8") as fh:
                payload = json.load(fh)
        except Exception:
            logger.exception("Failed to read job metadata from %s", job_file)
            continue
        job_id = payload.get("job_id", job_dir.name)
        JOB_STORE[job_id] = payload
        if payload.get("status") not in {"done", "failed"}:
            payload["status"] = "failed"
            payload["error"] = "Server restarted during processing"
            payload["updated_at"] = utc_now_iso()
            try:
                atomic_write_json(job_file, payload)
            except Exception:
                logger.exception("Unable to persist interrupted job metadata for %s", job_id)


def create_job(job_id: str | None = None, **fields: object) -> dict:
    resolved_job_id = job_id or uuid4().hex[:12]
    record = _job_record(resolved_job_id, **fields)
    job_dir = OUTPUTS_DIR / resolved_job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    JOB_STORE[resolved_job_id] = record
    atomic_write_json(_job_file(resolved_job_id), record)
    return record


def get_job(job_id: str) -> dict | None:
    return JOB_STORE.get(job_id)


def update_job(job_id: str, **fields: object) -> dict:
    with JOB_LOCK:
        record = JOB_STORE.get(job_id)
        if record is None:
            return {}
        record.update(fields)
        record["updated_at"] = utc_now_iso()
        job_file = _job_file(job_id)
        job_file.parent.mkdir(parents=True, exist_ok=True)
        atomic_write_json(job_file, record)
        JOB_STORE[job_id] = record
        return record


def job_dir(job_id: str) -> Path:
    return OUTPUTS_DIR / job_id


load_jobs_on_startup()
