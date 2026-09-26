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
from app.pipeline import stubs
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
    pose = stubs.extract_pose(prepared)

    rep = stubs.find_rep(pose, args.exercise)
    bottom_t = max(0.0, rep.bottom / max(1, len(pose.frames) or 1) * 1.0)
    thumb = target_dir / "thumbnail.jpg"
    thumbnail(prepared, bottom_t, thumb)

    with open(target_dir / "pose.json", "w", encoding="utf-8") as fh:
        json.dump(pose.model_dump(), fh)

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
        "rep": rep.model_dump() if hasattr(rep, "model_dump") else rep,
    }
    add_reference(entry)
    print(ref_id)


if __name__ == "__main__":
    main()
