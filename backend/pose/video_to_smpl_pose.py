"""
Convert an exercise video into a per-frame SMPL axis-angle pose sequence using MediaPipe Pose
landmarks — no GPU, no PyTorch, no detectron2. Runs entirely on CPU in seconds.

This is a geometric approximation, not a learned model like HMR2.0/4D-Humans: for each SMPL bone
we can observe from MediaPipe's 33 landmarks (hip->knee, knee->ankle, shoulder->elbow,
elbow->wrist, and the overall torso lean), we compute the "swing" rotation that takes the bone's
rest-pose direction onto the direction MediaPipe observed, hierarchically through the kinematic
chain so parent rotations are already accounted for. Joints with no direct landmark correspondence
(collars, feet, wrists' own rotation, neck/head, and the pelvis's own global orientation) are left
at rest. See the module docstring in frontend/src/lib/smpl/skinning.ts for the equivalent
TypeScript forward-kinematics used to *render* whatever this script produces — they must agree on
convention (local axis-angle per joint, applied parent-then-child) since this script's output feeds
that renderer directly.

Why this over HMR2.0/4D-Humans: that pipeline needs a cloud GPU, detectron2 (painful outside
Linux+CUDA), and hits a cascade of PyTorch 2.6 checkpoint-compatibility issues. This tradeoff loses
shape personalization and any twist/roll rotation (position data alone can't reveal roll around a
bone's own axis), but for a side-on exercise video, the motions that matter for form comparison
(hip depth, knee flexion, torso lean, elbow bend) are exactly the "swing" bends this script can
see well, not the twist it can't.

Usage:
    cd backend
    pip install -r pose/requirements.txt
    python3 -m pose.video_to_smpl_pose --video path/to/clip.mp4 --out pose_sequence.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

MODEL_PATH = Path(__file__).parent / 'pose_landmarker_full.task'
SMPL_ASSET_PATH = Path(__file__).parent.parent.parent / 'frontend' / 'assets' / 'smpl' / 'body_model.json'

# MediaPipe BlazePose's 33-landmark indices (stable since its 2020 release).
MP_LEFT_SHOULDER, MP_RIGHT_SHOULDER = 11, 12
MP_LEFT_ELBOW, MP_RIGHT_ELBOW = 13, 14
MP_LEFT_WRIST, MP_RIGHT_WRIST = 15, 16
MP_LEFT_HIP, MP_RIGHT_HIP = 23, 24
MP_LEFT_KNEE, MP_RIGHT_KNEE = 25, 26
MP_LEFT_ANKLE, MP_RIGHT_ANKLE = 27, 28

# SMPL's standard 24-joint order/parents (must match frontend/scripts/generatePlaceholderBody.js
# and frontend/src/lib/smpl/poses.ts).
PARENTS = [-1, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 9, 12, 13, 14, 16, 17, 18, 19, 20, 21]

# Which SMPL joints we can actually observe, and from which MediaPipe landmark pair.
# joint -> (smpl_child_joint, mp_parent_landmark, mp_child_landmark)
# joint 3 (spine1) is special-cased to use the hip-midpoint -> shoulder-midpoint direction instead.
JOINT_TARGETS: dict[int, tuple[int, int, int]] = {
    1: (4, MP_LEFT_HIP, MP_LEFT_KNEE),
    2: (5, MP_RIGHT_HIP, MP_RIGHT_KNEE),
    4: (7, MP_LEFT_KNEE, MP_LEFT_ANKLE),
    5: (8, MP_RIGHT_KNEE, MP_RIGHT_ANKLE),
    16: (18, MP_LEFT_SHOULDER, MP_LEFT_ELBOW),
    17: (19, MP_RIGHT_SHOULDER, MP_RIGHT_ELBOW),
    18: (20, MP_LEFT_ELBOW, MP_LEFT_WRIST),
    19: (21, MP_RIGHT_ELBOW, MP_RIGHT_WRIST),
}
SPINE1_JOINT = 3
SPINE1_CHILD = 6

EMA_ALPHA = 0.5  # landmark smoothing factor; lower = smoother but laggier


def load_rest_pose() -> tuple[np.ndarray, list[int]]:
    if not SMPL_ASSET_PATH.exists():
        raise FileNotFoundError(
            f'{SMPL_ASSET_PATH} not found — run the frontend at least once so the committed '
            'placeholder (or your converted real SMPL) body_model.json exists.'
        )
    data = json.loads(SMPL_ASSET_PATH.read_text())
    joints = np.array(data['joints'], dtype=np.float64).reshape(data['jointCount'], 3)
    return joints, data['parents']


def rotation_between_vectors(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Axis-angle rotation that takes unit-ish vector a onto unit-ish vector b (shortest arc)."""
    a = a / (np.linalg.norm(a) + 1e-8)
    b = b / (np.linalg.norm(b) + 1e-8)
    dot = float(np.clip(np.dot(a, b), -1.0, 1.0))
    cross = np.cross(a, b)
    cross_norm = np.linalg.norm(cross)
    if cross_norm < 1e-6:
        if dot > 0:
            return np.zeros(3)
        perp = np.array([1.0, 0.0, 0.0]) if abs(a[0]) < 0.9 else np.array([0.0, 1.0, 0.0])
        axis = np.cross(a, perp)
        axis = axis / (np.linalg.norm(axis) + 1e-8)
        return axis * np.pi
    axis = cross / cross_norm
    angle = np.arccos(dot)
    return axis * angle


def rodrigues(rotvec: np.ndarray) -> np.ndarray:
    mat, _ = cv2.Rodrigues(rotvec.astype(np.float64))
    return mat


def landmarks_to_pose(landmarks_xyz: np.ndarray, rest_joints: np.ndarray, parents: list[int]) -> np.ndarray:
    """landmarks_xyz: (33,3) in MediaPipe's coordinate convention (y-down image space).
    Returns a flat (72,) axis-angle pose: joint 0 (global_orient) is always zero/fixed — see the
    module docstring for why."""
    joint_count = len(parents)
    local_pose = np.zeros((joint_count, 3), dtype=np.float64)
    global_rot = [np.eye(3) for _ in range(joint_count)]  # joint 0's parent frame == world == identity

    # Flip y (image-down -> world-up) so bend directions come out the right way round; z is left
    # as-is since side-on framing makes depth motion minor for the joints we track.
    pts = landmarks_xyz.copy()
    pts[:, 1] *= -1

    def solve(joint: int, rest_child: int, observed_dir: np.ndarray) -> None:
        parent = parents[joint]
        rest_dir = rest_joints[rest_child] - rest_joints[joint]
        target_local = global_rot[parent].T @ observed_dir
        rotvec = rotation_between_vectors(rest_dir, target_local)
        local_pose[joint] = rotvec
        global_rot[joint] = global_rot[parent] @ rodrigues(rotvec)

    # Kinematic order matters: parents must be solved (or left at rest, which still needs
    # global_rot propagated) before children. Joint 0 is fixed at rest by construction.
    for joint in range(1, joint_count):
        parent = parents[joint]
        if joint == SPINE1_JOINT:
            hip_mid = (pts[MP_LEFT_HIP] + pts[MP_RIGHT_HIP]) / 2
            shoulder_mid = (pts[MP_LEFT_SHOULDER] + pts[MP_RIGHT_SHOULDER]) / 2
            solve(joint, SPINE1_CHILD, shoulder_mid - hip_mid)
        elif joint in JOINT_TARGETS:
            rest_child, mp_parent, mp_child = JOINT_TARGETS[joint]
            solve(joint, rest_child, pts[mp_child] - pts[mp_parent])
        else:
            # No observation for this joint — leave it at rest, just propagate the parent's frame.
            global_rot[joint] = global_rot[parent]

    return local_pose.reshape(-1).astype(np.float32)


def extract_landmarks(video_path: Path) -> tuple[list[np.ndarray | None], float]:
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f'Could not open video: {video_path}')
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

    # mediapipe's own docs say GPU delegate support is Ubuntu-only; forcing CPU avoids a native
    # crash (Metal helper "Service is unavailable") that the default otherwise hits on macOS.
    base_options = python.BaseOptions(model_asset_path=str(MODEL_PATH), delegate=python.BaseOptions.Delegate.CPU)
    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.5,
        min_pose_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    results: list[np.ndarray | None] = []
    with vision.PoseLandmarker.create_from_options(options) as landmarker:
        frame_number = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            timestamp_ms = int(frame_number * 1000 / fps)
            result = landmarker.detect_for_video(mp_image, timestamp_ms)
            if result.pose_landmarks:
                lm = result.pose_landmarks[0]
                results.append(np.array([[p.x, p.y, p.z] for p in lm], dtype=np.float64))
            else:
                results.append(None)
            frame_number += 1
    cap.release()
    return results, fps


def smooth_landmarks(frames: list[np.ndarray | None]) -> list[np.ndarray]:
    """Exponential moving average across frames; holds the last good value through brief
    detection dropouts instead of snapping to zero."""
    smoothed: list[np.ndarray] = []
    prev: np.ndarray | None = None
    for lm in frames:
        if lm is None:
            if prev is None:
                continue
            smoothed.append(prev)
            continue
        current = lm if prev is None else EMA_ALPHA * lm + (1 - EMA_ALPHA) * prev
        smoothed.append(current)
        prev = current
    return smoothed


def convert(video_path: Path, out_path: Path) -> None:
    rest_joints, parents = load_rest_pose()
    raw_landmarks, fps = extract_landmarks(video_path)
    detected = sum(1 for lm in raw_landmarks if lm is not None)
    print(f'{detected}/{len(raw_landmarks)} frames had a detected person')

    smoothed = smooth_landmarks(raw_landmarks)
    poses = [landmarks_to_pose(lm, rest_joints, parents) for lm in smoothed]

    payload = {
        'fps': fps,
        'jointCount': len(parents),
        'frames': [p.tolist() for p in poses],
    }
    out_path.write_text(json.dumps(payload))
    print(f'Wrote {out_path} — {len(poses)} frames')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--video', required=True, help='Path to the input video')
    parser.add_argument('--out', default='pose_sequence.json', help='Output JSON path')
    args = parser.parse_args()
    convert(Path(args.video), Path(args.out))


if __name__ == '__main__':
    main()
