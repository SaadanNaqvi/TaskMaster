from __future__ import annotations

from pathlib import Path


def _missing() -> None:
    raise NotImplementedError("Real pipeline modules are not implemented yet")


def extract_pose(video_path: Path):
    _missing()


def find_rep(pose, exercise: str):
    _missing()


def sync(user, user_rep, ref, ref_rep):
    _missing()


def align(user, ref, pairs):
    _missing()


def score(user, ref, alignment, exercise: str):
    _missing()
