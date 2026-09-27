from __future__ import annotations

import json
import threading
import time
import traceback
from pathlib import Path

from ..catalogue import get_exercise
from ..config import LIBRARY_DIR, MAX_CONCURRENT_JOBS, STUB_DELAY_S, STUB_MODE
from ..media import prepare, thumbnail, to_url
from ..schemas import PoseSequence
from ..storage import get_job, job_dir, update_job

try:
    from . import real as pipeline_real
except Exception:  # pragma: no cover
    pipeline_real = None

from . import stubs

RUNNER_LOCK = threading.Semaphore(MAX_CONCURRENT_JOBS)


def _extract_pose(video_path: str | Path):
    # Unlike sync/align/score below, real pose extraction doesn't depend on STUB_MODE being
    # turned off — it's genuinely implemented, has no bearing on whether the rest of the (still
    # partly stubbed) pipeline can run, and real landmarks are what the mobile app's 3D overlay
    # needs to actually align to the user (see frontend/src/lib/smpl/align.ts). It opportunistically
    # uses the real MediaPipe environment when set up, falling back to the synthetic stub only when
    # that environment isn't available (e.g. a fresh clone with no .venv-pose yet) — so this never
    # turns "the app doesn't work out of the box" into a hard requirement.
    if pipeline_real is not None and pipeline_real.mediapipe_available():
        return pipeline_real.extract_pose(Path(video_path))
    return stubs.extract_pose(Path(video_path))


def _find_rep(pose, exercise: str):
    # Pure Python over already-extracted pose data, no external environment dependency — always
    # use the real hip-height-peak algorithm, including over the stub's synthetic pose above (its
    # sinusoidal fake motion still has a well-defined deepest frame, more meaningful than the
    # stub's own naive len//2 guess).
    if pipeline_real is not None:
        return pipeline_real.find_rep(pose, exercise)
    return stubs.find_rep(pose, exercise)


def _sync(user, user_rep, ref, ref_rep):
    if STUB_MODE:
        return stubs.sync(user, user_rep, ref, ref_rep)
    if pipeline_real is None:
        raise NotImplementedError("Real pipeline not available")
    return pipeline_real.sync(user, user_rep, ref, ref_rep)


def _align(user, ref, pairs):
    if STUB_MODE:
        return stubs.align(user, ref, pairs)
    if pipeline_real is None:
        raise NotImplementedError("Real pipeline not available")
    return pipeline_real.align(user, ref, pairs)


def _score(user, ref, alignment, exercise: str):
    if STUB_MODE:
        return stubs.score(user, ref, alignment, exercise)
    if pipeline_real is None:
        raise NotImplementedError("Real pipeline not available")
    return pipeline_real.score(user, ref, alignment, exercise)


def _load_reference_pose(reference_id: str):
    ref_dir = job_dir(reference_id)
    pose_path = ref_dir / "pose.json"
    if not pose_path.exists():
        return stubs.extract_pose(ref_dir / "video.mp4") if (ref_dir / "video.mp4").exists() else stubs.extract_pose(Path("dummy.mp4"))
    with open(pose_path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def run_job(job_id: str):
    if not RUNNER_LOCK.acquire(blocking=False):
        return
    try:
        job = get_job(job_id)
        if job is None:
            return
        upload_path = Path(job["upload_path"])
        ref_id = job.get("reference_id")
        exercise = job.get("exercise")
        prepared_path = job_dir(job_id) / "prepared.mp4"
        try:
            update_job(job_id, status="preparing", progress=0.05)
            if STUB_DELAY_S:
                time.sleep(STUB_DELAY_S)
            prepare(upload_path, prepared_path)

            update_job(job_id, status="extracting", progress=0.2)
            if STUB_DELAY_S:
                time.sleep(STUB_DELAY_S)
            user_pose = _extract_pose(prepared_path)
            ref_pose = stubs.extract_pose(Path("dummy.mp4"))
            if ref_id:
                ref_path = LIBRARY_DIR / ref_id / "pose.json"
                if ref_path.exists():
                    with open(ref_path, "r", encoding="utf-8") as fh:
                        ref_pose = PoseSequence.model_validate(json.load(fh))
                else:
                    ref_pose = stubs.extract_pose(Path("dummy.mp4"))
            if not getattr(ref_pose, "frames", None):
                ref_pose = stubs.extract_pose(Path("dummy.mp4"))

            update_job(job_id, status="syncing", progress=0.6)
            if STUB_DELAY_S:
                time.sleep(STUB_DELAY_S)
            user_rep = _find_rep(user_pose, exercise)
            ref_rep = _find_rep(ref_pose, exercise)
            alignment_pairs = _sync(user_pose, user_rep, ref_pose, ref_rep)
            alignment = _align(user_pose, ref_pose, alignment_pairs)

            update_job(job_id, status="scoring", progress=0.8)
            if STUB_DELAY_S:
                time.sleep(STUB_DELAY_S)
            form_report = _score(user_pose, ref_pose, alignment, exercise)

            result = {
                "job_id": job_id,
                "video_url": to_url(prepared_path),
                "form_report": form_report.model_dump() if hasattr(form_report, "model_dump") else form_report,
                "user_pose": user_pose.model_dump() if hasattr(user_pose, "model_dump") else user_pose,
                "ref_pose": ref_pose.model_dump() if hasattr(ref_pose, "model_dump") else ref_pose,
                "alignment": [item.model_dump() if hasattr(item, "model_dump") else item for item in alignment],
                "exercise": exercise,
            }
            result_path = job_dir(job_id) / "result.json"
            with open(result_path, "w", encoding="utf-8") as fh:
                json.dump(result, fh, indent=2)
            with open(job_dir(job_id) / "user_pose.json", "w", encoding="utf-8") as fh:
                json.dump(result["user_pose"], fh, indent=2)
            update_job(job_id, status="done", progress=1.0, error=None)
        except Exception as exc:
            err = str(exc)
            job_dir(job_id).mkdir(parents=True, exist_ok=True)
            with open(job_dir(job_id) / "error.log", "w", encoding="utf-8") as fh:
                fh.write(traceback.format_exc())
            update_job(job_id, status="failed", progress=1.0, error=err[:200])
    finally:
        RUNNER_LOCK.release()
