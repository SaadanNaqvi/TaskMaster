"""
Extract a 2D `PoseSequence` (fps/width/height + 33 MediaPipe landmarks per frame, pixel
coordinates) from a video — the format `backend/app/schemas.py::PoseSequence` and the job
pipeline's rep-finding/sync/scoring modules consume, not the SMPL/ROMP output of
video_to_smpl_pose.py in this same directory (that's a separate pipeline, for the mobile 3D
viewer). This is invoked as a subprocess from backend/app/pipeline/real.py, from the main FastAPI
venv, because that venv doesn't (and shouldn't) carry mediapipe — see .venv-pose setup below.

Environment setup (once per machine):
    cd backend
    python3 -m venv .venv-pose
    .venv-pose/bin/pip install -r pose/requirements-mediapipe.txt

Usage:
    cd backend
    .venv-pose/bin/python -m pose.extract_pose_sequence --video path/to/clip.mp4 --out pose.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

MODEL_PATH = Path(__file__).parent / 'pose_landmarker_full.task'
LANDMARK_COUNT = 33


def extract(video_path: Path, out_path: Path) -> None:
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f'Could not open video: {video_path}')
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # CPU delegate: mediapipe's Metal GPU path crashes on macOS regardless of this setting on some
    # versions, but forcing CPU is what actually avoids it in practice (see requirements-mediapipe.txt).
    base_options = python.BaseOptions(model_asset_path=str(MODEL_PATH), delegate=python.BaseOptions.Delegate.CPU)
    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.5,
        min_pose_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    frames: list[dict] = []
    detected = 0
    with vision.PoseLandmarker.create_from_options(options) as landmarker:
        frame_number = 0
        while True:
            ok, frame_bgr = cap.read()
            if not ok:
                break
            rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            timestamp_ms = int(frame_number * 1000 / fps)
            result = landmarker.detect_for_video(mp_image, timestamp_ms)
            if result.pose_landmarks:
                detected += 1
                lm = result.pose_landmarks[0]
                # Pixel coordinates, not MediaPipe's native 0-1 normalized space, per the
                # PoseSequence contract — downstream rendering/scoring needs no conversion.
                landmarks = [[p.x * width, p.y * height, p.z * width, p.visibility] for p in lm]
            else:
                landmarks = [None] * LANDMARK_COUNT
            frames.append({'t': frame_number / fps, 'landmarks': landmarks})
            frame_number += 1
    cap.release()

    print(f'{detected}/{len(frames)} frames had a detected person')
    payload = {'fps': fps, 'width': width, 'height': height, 'frames': frames}
    out_path.write_text(json.dumps(payload))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--video', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    extract(Path(args.video), Path(args.out))


if __name__ == '__main__':
    main()
