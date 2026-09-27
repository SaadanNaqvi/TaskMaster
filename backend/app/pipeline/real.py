from __future__ import annotations

import json
import math
import subprocess
import tempfile
from pathlib import Path

from ..schemas import AlignmentFrame, FormReport, FrameDelta, JointDelta, PoseSequence, RepWindow
from . import angles

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


def sync(user: PoseSequence, user_rep: RepWindow, ref: PoseSequence, ref_rep: RepWindow) -> list[tuple[int, int]]:
    """Pairs every user frame in the rep with a reference frame by stretching each half of the rep
    (start->bottom, bottom->end) linearly onto the reference's matching half, so both reps hit
    their bottoms together. Per-phase linear rather than DTW — enough for single-rep clips."""

    def lerp(i: int, u0: int, u1: int, r0: int, r1: int) -> int:
        frac = 1.0 if u1 == u0 else (i - u0) / (u1 - u0)
        return round(r0 + frac * (r1 - r0))

    pairs = []
    for i in range(user_rep.start, user_rep.end + 1):
        if i <= user_rep.bottom:
            j = lerp(i, user_rep.start, user_rep.bottom, ref_rep.start, ref_rep.bottom)
        else:
            j = lerp(i, user_rep.bottom, user_rep.end, ref_rep.bottom, ref_rep.end)
        pairs.append((i, min(max(j, 0), len(ref.frames) - 1)))
    return pairs


def _torso(frame) -> float | None:
    hip, shoulder = angles.midpoint(frame, 23, 24), angles.midpoint(frame, 11, 12)
    if hip is None or shoulder is None:
        return None
    return math.hypot(shoulder[0] - hip[0], shoulder[1] - hip[1]) or None


def align(user: PoseSequence, ref: PoseSequence, pairs) -> list[AlignmentFrame]:
    """Per pair, the hip-to-hip translation that lays the reference skeleton over the user's.
    Scale is one torso-length ratio for the whole clip (bodies don't change size mid-rep, and a
    per-frame ratio would jitter), and mirror is set when the two face opposite ways."""
    ratios = sorted(
        u / r
        for u, r in ((_torso(user.frames[i]), _torso(ref.frames[j])) for i, j in pairs)
        if u and r
    )
    scale = ratios[len(ratios) // 2] if ratios else 1.0
    mirror = angles.facing(user, angles.camera_side(user)) != angles.facing(ref, angles.camera_side(ref))

    # Hold the last known hips through dropouts; before the first detection, use frame centers.
    user_hip = (user.width / 2, user.height / 2)
    ref_hip = (ref.width / 2, ref.height / 2)
    out = []
    for i, j in pairs:
        user_hip = angles.midpoint(user.frames[i], 23, 24) or user_hip
        ref_hip = angles.midpoint(ref.frames[j], 23, 24) or ref_hip
        out.append(
            AlignmentFrame(
                user_frame=i,
                ref_frame=j,
                anchor=list(user_hip),
                ref_anchor=list(ref_hip),
                scale=scale,
                mirror=mirror,
            )
        )
    return out


def score(user: PoseSequence, ref: PoseSequence, alignment: list[AlignmentFrame], user_rep: RepWindow) -> FormReport:
    """Signed user-minus-reference joint angle differences over the synced rep — per frame, at the
    bottom, and the largest. No overall score by design: the output is the degrees themselves."""
    user_side, ref_side = angles.camera_side(user), angles.camera_side(ref)
    user_angles = angles.angle_series(user)
    raw_ref_angles = angles.angle_series(ref)
    # Pair sides by camera position, not anatomy: the user's near-side knee against the reference's
    # near-side knee, even if that's the reference's other leg. Otherwise a user filming their left
    # side against a reference filmed from the right would compare visible joints against occluded
    # ones and measure almost nothing. Keys stay in the user's own left/right.
    swap = user_side != ref_side
    ref_angles = {joint: raw_ref_angles[angles.opposite_side(joint) if swap else joint] for joint in angles.JOINTS}

    def diff(joint: str, i: int, j: int) -> float | None:
        u, r = user_angles[joint][i], ref_angles[joint][j]
        return None if u is None or r is None else u - r

    frames = [
        FrameDelta(
            user_frame=a.user_frame,
            ref_frame=a.ref_frame,
            deltas={
                joint: None if (d := diff(joint, a.user_frame, a.ref_frame)) is None else round(d, 1)
                for joint in angles.JOINTS
            },
            user={joint: _round(user_angles[joint][a.user_frame]) for joint in angles.JOINTS},
            ref={joint: _round(ref_angles[joint][a.ref_frame]) for joint in angles.JOINTS},
        )
        for a in alignment
    ]
    bottom = next((a for a in alignment if a.user_frame == user_rep.bottom), None)

    per_joint: dict[str, JointDelta] = {}
    for joint in angles.JOINTS:
        measured = [(f.user_frame, f.deltas[joint]) for f in frames if f.deltas[joint] is not None]
        worst = max(measured, key=lambda m: abs(m[1]), default=None)
        u_bot = user_angles[joint][bottom.user_frame] if bottom else None
        r_bot = ref_angles[joint][bottom.ref_frame] if bottom else None
        d_bot = None if u_bot is None or r_bot is None else u_bot - r_bot
        per_joint[joint] = JointDelta(
            delta_at_bottom=_round(d_bot),
            user_at_bottom=_round(u_bot),
            ref_at_bottom=_round(r_bot),
            max_delta=worst[1] if worst else None,
            max_delta_frame=worst[0] if worst else None,
            measured_fraction=round(len(measured) / len(frames), 3) if frames else 0.0,
            message=angles.describe(joint, worst[1]) if worst else None,
        )

    ordered = dict(
        sorted(
            per_joint.items(),
            key=lambda kv: -1.0 if kv[1].max_delta is None else abs(kv[1].max_delta),
            reverse=True,
        )
    )
    return FormReport(
        user_side=user_side,
        ref_side=ref_side,
        bottom_frame=user_rep.bottom,
        per_joint=ordered,
        frames=frames,
    )


def _round(v: float | None) -> float | None:
    return None if v is None else round(v, 1)
