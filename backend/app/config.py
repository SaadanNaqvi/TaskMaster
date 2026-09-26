from __future__ import annotations

import os
from pathlib import Path

DATA_ROOT = Path(os.getenv("TASKMASTER_DATA", str(Path(__file__).resolve().parents[1] / "data"))).resolve()
UPLOADS_DIR = DATA_ROOT / "uploads"
LIBRARY_DIR = DATA_ROOT / "library"
OUTPUTS_DIR = DATA_ROOT / "outputs"

STUB_MODE = os.getenv("TASKMASTER_STUB", "1") == "1"
MAX_UPLOAD_MB = int(os.getenv("TASKMASTER_MAX_UPLOAD_MB", "100"))
MAX_DURATION_S = float(os.getenv("TASKMASTER_MAX_DURATION_S", "15"))
MIN_DURATION_S = float(os.getenv("TASKMASTER_MIN_DURATION_S", "1"))
MAX_CONCURRENT_JOBS = int(os.getenv("TASKMASTER_MAX_CONCURRENT_JOBS", "2"))
CORS_ORIGINS = os.getenv("TASKMASTER_CORS", "*")
STUB_DELAY_S = float(os.getenv("TASKMASTER_STUB_DELAY_S", "0.5"))


def ensure_data_dirs() -> None:
    for path in (UPLOADS_DIR, LIBRARY_DIR, OUTPUTS_DIR):
        path.mkdir(parents=True, exist_ok=True)
