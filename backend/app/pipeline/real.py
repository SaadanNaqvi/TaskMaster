from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

from ..schemas import PoseSequence, RepWindow

# mediapipe lives in a separate venv (see backend/pose/requirements-mediapipe.txt) so the main
# FastAPI environment doesn't need to carry it — same split as .venv-romp for the 3D pipeline.
_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_VENV_POSE_PYTHON = _BACKEND_ROOT / '.venv-pose' / 'bin' / 'python'
_VENV_ROMP_PYTHON = _BACKEND_ROOT / '.venv-romp' / 'bin' / 'python'

# MediaPipe's 33-landmark indices for the two hip joints (stable since BlazePose's 2020 release).
_HIP_LANDMARKS = (23, 24)


def mediapipe_available() -> bool:
    return _VENV_POSE_PYTHON.exists()


def extract_pose(video_path: Path) -> PoseSequence:
    if not mediapipe_available():
        raise RuntimeError(
            f'{_VENV_POSE_PYTHON} not found. Set up the MediaPipe environment once: '
            'cd backend && python3 -m venv .venv-pose && '
            '.venv-pose/bin/pip install -r pose/requirements-mediapipe.txt'
        )
    with tempfile.TemporaryDirectory() as tmp:
        out_path = Path(tmp) / 'pose.json'
        subprocess.run(
            [
                str(_VENV_POSE_PYTHON),
                '-m',
                'pose.extract_pose_sequence',
                '--video',
                str(video_path),
                '--out',
                str(out_path),
            ],
            cwd=_BACKEND_ROOT,
            check=True,
            timeout=600,
        )
        with open(out_path, 'r', encoding='utf-8') as fh:
            payload = json.load(fh)
    return PoseSequence.model_validate(payload)


def extract_smpl_pose(video_path: Path, out_path: Path) -> bool:
    """Best-effort: writes a SMPL pose sequence (backend/pose/video_to_smpl_pose.py's ROMP output —
    24-joint axis-angle pose + root translation per frame) for the mobile 3D overlay/viewer. This is
    a *separate* pose representation from extract_pose()'s 33-landmark PoseSequence above — one
    feeds the SMPL mesh renderer, the other feeds rep-finding/sync/scoring.

    Returns False (leaving out_path unwritten) if .venv-romp isn't set up, rather than failing
    reference creation over an optional enhancement — the reference is still usable for scoring
    without a 3D overlay, just without the mesh."""
    if not _VENV_ROMP_PYTHON.exists():
        return False
    subprocess.run(
        [
            str(_VENV_ROMP_PYTHON),
            '-m',
            'pose.video_to_smpl_pose',
            '--video',
            str(video_path),
            '--out',
            str(out_path),
        ],
        cwd=_BACKEND_ROOT,
        check=True,
        timeout=1800,
    )
    return True


def find_rep(pose: PoseSequence, exercise: str) -> RepWindow:
    """Finds the deepest frame (max hip height, i.e. max pixel-y) as the rep's bottom. Assumes the
    clip is already trimmed to a single rep — no multi-rep segmentation (that's DTW/find_peaks
    territory per the tech-stack doc's M2, not needed for a one-rep library reference clip)."""
    if not pose.frames:
        raise ValueError('pose has no frames')

    hip_y_per_frame: list[float | None] = []
    for frame in pose.frames:
        ys = [
            frame.landmarks[i][1]
            for i in _HIP_LANDMARKS
            if frame.landmarks[i] is not None
        ]
        hip_y_per_frame.append(sum(ys) / len(ys) if ys else None)

    # Hold the last detected value through brief dropouts so a couple of missed frames can't win
    # the max() by leaving a None-gap that never competes — matches the pose scripts' EMA/hold
    # approach to dropouts elsewhere in this repo.
    last = next((v for v in hip_y_per_frame if v is not None), 0.0)
    filled: list[float] = []
    for v in hip_y_per_frame:
        last = v if v is not None else last
        filled.append(last)

    bottom = max(range(len(filled)), key=lambda i: filled[i])
    return RepWindow(start=0, end=len(pose.frames) - 1, bottom=bottom)


def sync(user: PoseSequence, user_rep: RepWindow, ref: PoseSequence, ref_rep: RepWindow):
    raise NotImplementedError('Rep-to-rep DTW sync is not implemented yet')


def align(user: PoseSequence, ref: PoseSequence, pairs):
    raise NotImplementedError('Spatial alignment is not implemented yet')


def score(user: PoseSequence, ref: PoseSequence, alignment, exercise: str):
    raise NotImplementedError('Form scoring is not implemented yet')
