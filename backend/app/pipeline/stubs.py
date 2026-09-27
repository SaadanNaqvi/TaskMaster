from __future__ import annotations

import math
from pathlib import Path

from ..schemas import PoseFrame, PoseSequence, RepWindow


def _make_landmark(x: float, y: float, z: float, visibility: float = 1.0) -> list[float]:
    return [x, y, z, visibility]


def extract_pose(video_path: Path) -> PoseSequence:
    frames = []
    for i in range(30):
        t = i / 30.0
        hip_y = 350 + math.sin(t * 2 * math.pi) * 60
        knee_y = 420 + math.sin(t * 2 * math.pi + math.pi / 3) * 30
        ankle_y = 600 + math.sin(t * 2 * math.pi + math.pi / 2) * 40
        x_center = 260 + 60 * math.sin(t * 2 * math.pi)
        landmarks = []
        for j in range(33):
            if j in {11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32}:
                lx = x_center + (j % 11) * 6
                ly = hip_y + (j % 5) * 3
            else:
                lx = x_center + (j % 7) * 8
                ly = knee_y + (j % 6) * 4
            if j in {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16}:
                ly *= 0.8
            landmarks.append(_make_landmark(float(lx), float(ly), 0.0, 1.0))
        frames.append(PoseFrame(t=t, landmarks=landmarks))
    return PoseSequence(fps=30.0, width=640, height=480, frames=frames)


def find_rep(pose: PoseSequence, exercise: str) -> RepWindow:
    if not pose.frames:
        raise ValueError("pose has no frames")
    return RepWindow(start=0, end=max(len(pose.frames) - 1, 0), bottom=len(pose.frames) // 2)
