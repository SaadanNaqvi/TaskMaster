from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import tempfile

# Must never point at BACKEND_ROOT/"data" — the fixture below does `shutil.rmtree(data_root)` to
# reset state between runs, and that directory is real local dev data (uploads, job history,
# library references), not a fixture. A prior version pointed here and a single `pytest` run
# silently deleted it all, including source media that wasn't recoverable afterward.
_TEST_DATA_ROOT = Path(tempfile.mkdtemp(prefix="taskmaster_test_data_"))
os.environ["TASKMASTER_DATA"] = str(_TEST_DATA_ROOT)
os.environ["TASKMASTER_STUB"] = "1"
os.environ["TASKMASTER_STUB_DELAY_S"] = "0"

from app.main import app


@pytest.fixture(scope="session")
def client():
    data_root = Path(os.environ["TASKMASTER_DATA"])
    if data_root.exists():
        shutil.rmtree(data_root)
    data_root.mkdir(parents=True, exist_ok=True)
    (data_root / "uploads").mkdir(parents=True, exist_ok=True)
    (data_root / "library").mkdir(parents=True, exist_ok=True)
    (data_root / "outputs").mkdir(parents=True, exist_ok=True)

    ref_dir = data_root / "library" / "pro_squat_1"
    ref_dir.mkdir(parents=True, exist_ok=True)
    with open(ref_dir / "pose.json", "w", encoding="utf-8") as fh:
        json.dump({"fps": 30.0, "width": 640, "height": 480, "frames": []}, fh)

    library_index = [
        {
            "id": "pro_squat_1",
            "name": "Coach Sam",
            "exercise": "squat",
            "source": "pro",
            "consent": True,
            "video_url": "/files/library/pro_squat_1/video.mp4",
            "thumbnail_url": "/files/library/pro_squat_1/thumbnail.jpg",
            "pose_path": str(ref_dir / "pose.json"),
            "video_path": str(ref_dir / "video.mp4"),
            "rep": {"start": 0, "end": 0, "bottom": 0},
        }
    ]
    with open(data_root / "library" / "index.json", "w", encoding="utf-8") as fh:
        json.dump(library_index, fh)

    sample_video = data_root / "uploads" / "sample.mp4"
    subprocess.run([
        "ffmpeg",
        "-y",
        "-f",
        "lavfi",
        "-t",
        "2",
        "-i",
        "testsrc=size=640x480:rate=30",
        str(sample_video),
    ], check=True, capture_output=True)

    with TestClient(app) as client:
        yield client
