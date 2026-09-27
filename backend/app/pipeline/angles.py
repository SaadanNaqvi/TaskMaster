"""2D joint angles over MediaPipe's 33-landmark PoseSequence (pixel coords, see
pose/extract_pose_sequence.py). Pure Python so it runs in the main FastAPI env without mediapipe.

Angles are measured on one side of the body only — the side facing the camera. The user films
side-on (RecordScreen's framing guide), so the far side is mostly occluded and MediaPipe's guess for
it is noise in 2D.
"""
from __future__ import annotations

import math
from typing import Literal, Sequence

from ..schemas import PoseFrame, PoseSequence

Side = Literal["left", "right"]

# Below this MediaPipe visibility a landmark is treated as missing rather than measured.
MIN_VISIBILITY = 0.5

# joint -> (a, vertex, c) landmark indices; the angle is measured at the vertex. Right-side indices
# are the left ones + 1 throughout MediaPipe's body landmarks (11-32).
_LEFT_JOINTS: dict[str, tuple[int, int, int]] = {
    "shoulder": (13, 11, 23),  # elbow, shoulder, hip
    "elbow": (11, 13, 15),  # shoulder, elbow, wrist
    "hip": (11, 23, 25),  # shoulder, hip, knee
    "knee": (23, 25, 27),  # hip, knee, ankle
    "ankle": (25, 27, 31),  # knee, ankle, foot index
}
_TRUNK_LEFT = (11, 23)  # shoulder, hip
_HEEL_TOE_LEFT = (29, 31)

# Order the joints are reported in, top of the body down.
JOINTS: tuple[str, ...] = ("trunk", "shoulder", "elbow", "hip", "knee", "ankle")


def _idx(i: int, side: Side) -> int:
    return i if side == "left" else i + 1


def _point(frame: PoseFrame, i: int) -> tuple[float, float] | None:
    lm = frame.landmarks[i]
    if lm is None or lm[3] < MIN_VISIBILITY:
        return None
    return lm[0], lm[1]


def angle_at(a: tuple[float, float], b: tuple[float, float], c: tuple[float, float]) -> float | None:
    """Interior angle ABC in degrees (0-180), or None if either arm has zero length."""
    v1 = (a[0] - b[0], a[1] - b[1])
    v2 = (c[0] - b[0], c[1] - b[1])
    n1 = math.hypot(*v1)
    n2 = math.hypot(*v2)
    if n1 == 0 or n2 == 0:
        return None
    cos = (v1[0] * v2[0] + v1[1] * v2[1]) / (n1 * n2)
    return math.degrees(math.acos(max(-1.0, min(1.0, cos))))


def trunk_lean(shoulder: tuple[float, float], hip: tuple[float, float]) -> float | None:
    """Angle of the hip->shoulder line from vertical in degrees (0 = upright). Pixel y grows down."""
    dx = shoulder[0] - hip[0]
    dy = hip[1] - shoulder[1]
    if dx == 0 and dy == 0:
        return None
    return math.degrees(math.atan2(abs(dx), dy))


def joint_angles(frame: PoseFrame, side: Side) -> dict[str, float | None]:
    out: dict[str, float | None] = {}
    s = _point(frame, _idx(_TRUNK_LEFT[0], side))
    h = _point(frame, _idx(_TRUNK_LEFT[1], side))
    out["trunk"] = trunk_lean(s, h) if s and h else None
    for name, (a, b, c) in _LEFT_JOINTS.items():
        pa, pb, pc = (_point(frame, _idx(i, side)) for i in (a, b, c))
        out[name] = angle_at(pa, pb, pc) if pa and pb and pc else None
    return out


def camera_side(pose: PoseSequence) -> Side:
    """The body side facing the camera: whichever side's landmarks MediaPipe saw more confidently
    over the whole clip. Picked once per clip so the measured side can't flip mid-rep."""
    totals = {"left": 0.0, "right": 0.0}
    for frame in pose.frames:
        for i in range(11, 33):
            lm = frame.landmarks[i]
            if lm is not None:
                totals["left" if i % 2 == 1 else "right"] += lm[3]
    return "right" if totals["right"] > totals["left"] else "left"


def facing(pose: PoseSequence, side: Side) -> int:
    """+1 if the person faces +x (right of frame), -1 if -x — from heel->toe on the camera side."""
    total = 0.0
    heel, toe = (_idx(i, side) for i in _HEEL_TOE_LEFT)
    for frame in pose.frames:
        ph, pt = _point(frame, heel), _point(frame, toe)
        if ph and pt:
            total += pt[0] - ph[0]
    return -1 if total < 0 else 1


def smooth(values: Sequence[float | None], window: int = 5) -> list[float | None]:
    """Centered moving average that skips missing values, to take the edge off MediaPipe's
    frame-to-frame jitter before differences are taken. Missing frames stay missing."""
    half = window // 2
    out: list[float | None] = []
    for i, v in enumerate(values):
        if v is None:
            out.append(None)
            continue
        near = [x for x in values[max(0, i - half) : i + half + 1] if x is not None]
        out.append(sum(near) / len(near))
    return out


def angle_series(pose: PoseSequence, side: Side) -> dict[str, list[float | None]]:
    """Smoothed per-frame angles for every joint in JOINTS."""
    raw = [joint_angles(frame, side) for frame in pose.frames]
    return {name: smooth([a[name] for a in raw]) for name in JOINTS}


_WORDS: dict[str, tuple[str, str]] = {
    # joint -> (phrase when user's angle is larger, phrase when smaller)
    "knee": ("straighter", "more bent"),
    "hip": ("more open", "more closed"),
    "elbow": ("straighter", "more bent"),
    "shoulder": ("more raised", "less raised"),
    "ankle": ("shin more upright", "shin further forward"),
    "trunk": ("leaning more", "more upright"),
}


def describe(joint: str, delta: float) -> str:
    """Plain-language reading of a signed user-minus-reference delta, e.g. 'Knee: 12° more bent
    than reference'."""
    label = joint.capitalize()
    if abs(delta) < 1:
        return f"{label}: matches reference"
    larger, smaller = _WORDS[joint]
    return f"{label}: {abs(delta):.0f}° {larger if delta > 0 else smaller} than reference"
