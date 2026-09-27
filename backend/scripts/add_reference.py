from __future__ import annotations

import argparse
import json
import re
import uuid
from pathlib import Path

from app.catalogue import get_exercise
from app.config import LIBRARY_DIR
from app.gates import require_exercise
from app.media import prepare, thumbnail, to_url
from app.pipeline.real import extract_smpl_pose
from app.pipeline.runner import _extract_pose, _find_rep
from app.storage import add_reference


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_") or "reference"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", required=True)
    parser.add_argument("--exercise", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--seed", action="store_true")
    args = parser.parse_args()

    require_exercise(args.exercise)
    ref_id = f"{slugify(args.name)}_{uuid.uuid4().hex[:6]}"
    target_dir = LIBRARY_DIR / ref_id
    target_dir.mkdir(parents=True, exist_ok=True)

    source = Path(args.video)
    if args.seed:
        source = target_dir / "seed.mp4"
        # create a tiny test pattern clip for a usable placeholder reference
        import subprocess
        subprocess.run([
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-t",
            "2",
            "-i",
            "testsrc=size=640x480:rate=30",
            str(source)
        ], check=True, capture_output=True)

    prepared = target_dir / "video.mp4"
    prepare(source, prepared)
    # Goes through the runner's stub/real switch (TASKMASTER_STUB) instead of always stubbing, so
    # a real reference clip actually gets real landmarks when TASKMASTER_STUB=0.
    pose = _extract_pose(prepared)

    rep = _find_rep(pose, args.exercise)
    # rep.bottom is a frame index — convert with fps, not frame count, to get a timestamp in
    # seconds (dividing by len(frames) instead of fps previously grabbed a thumbnail from far
    # earlier in the clip than the actual bottom-of-squat frame).
    bottom_t = max(0.0, rep.bottom / pose.fps)
    thumb = target_dir / "thumbnail.jpg"
    thumbnail(prepared, bottom_t, thumb)

    with open(target_dir / "pose.json", "w", encoding="utf-8") as fh:
        json.dump(pose.model_dump(), fh)

    # Best-effort: the SMPL/ROMP pose sequence that drives the mobile app's 3D mesh overlay. A
    # separate pipeline from the landmarks above (see extract_smpl_pose's docstring) — skipped for
    # --seed placeholders (a test-pattern clip has no person to regress a pose from) and never
    # allowed to fail reference creation, since scoring still works without a 3D overlay.
    smpl_pose_url = None
    if not args.seed:
        smpl_pose_path = target_dir / "smpl_pose.json"
        try:
            if extract_smpl_pose(prepared, smpl_pose_path):
                smpl_pose_url = to_url(smpl_pose_path)
        except Exception as exc:
            print(f"warning: SMPL pose extraction failed, continuing without 3D overlay: {exc}")

    entry = {
        "id": ref_id,
        "name": args.name,
        "exercise": args.exercise,
        "source": "pro",
        "consent": True,
        "video_url": to_url(prepared),
        "thumbnail_url": to_url(thumb),
        "pose_path": str(target_dir / "pose.json"),
        "video_path": str(prepared),
        "smpl_pose_url": smpl_pose_url,
        "rep": rep.model_dump() if hasattr(rep, "model_dump") else rep,
    }
    add_reference(entry)
    print(ref_id)


if __name__ == "__main__":
    main()
