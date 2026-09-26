from __future__ import annotations

from pathlib import Path

from ..schemas import PoseSequence, RepWindow


def extract_pose(video_path: Path) -> PoseSequence:
    raise NotImplementedError


def find_rep(pose: PoseSequence, exercise: str) -> RepWindow:
    raise NotImplementedError


def sync(user: PoseSequence, user_rep: RepWindow, ref: PoseSequence, ref_rep: RepWindow):
    raise NotImplementedError


def align(user: PoseSequence, ref: PoseSequence, pairs):
    raise NotImplementedError


def score(user: PoseSequence, ref: PoseSequence, alignment, exercise: str):
    raise NotImplementedError
