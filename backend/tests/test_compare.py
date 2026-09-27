from __future__ import annotations

import math

import pytest

from app.pipeline import angles, real
from app.schemas import PoseFrame, PoseSequence, RepWindow


def _figure(knee_deg: float = 180.0, facing: int = 1, size: float = 1.0, visible: str = "left") -> PoseFrame:
    """Side-on stick figure in pixel coords: upright torso, vertical thigh, shin bent so the knee's
    interior angle is knee_deg. Only the `visible` side is confidently detected."""
    phi = math.radians(180.0 - knee_deg)
    pts = {
        11: (300, 100),  # shoulder
        13: (300, 180),  # elbow
        15: (300 + 60 * facing, 180),  # wrist, forearm forward -> 90° elbow
        23: (300, 250),  # hip
        25: (300, 350),  # knee
        27: (300 + 100 * math.sin(phi) * -facing, 350 + 100 * math.cos(phi)),  # ankle
    }
    ankle = pts[27]
    pts[29] = (ankle[0] - 10 * facing, ankle[1] + 5)  # heel
    pts[31] = (ankle[0] + 20 * facing, ankle[1] + 5)  # toe
    near = 0 if visible == "left" else 1
    landmarks: list[list[float] | None] = [[300.0, 60.0, 0.0, 0.9]] * 11
    for i in range(11, 33):
        base = i - ((i - 11) % 2)  # the left-side index for this landmark
        x, y = pts.get(base, (300, 300))
        vis = 0.9 if (i - 11) % 2 == near else 0.1
        landmarks.append([300 + (x - 300) * size, 60 + (y - 60) * size, 0.0, vis])
    return PoseFrame(t=0.0, landmarks=landmarks)


def _seq(frames: list[PoseFrame]) -> PoseSequence:
    return PoseSequence(
        fps=30.0,
        width=640,
        height=480,
        frames=[f.model_copy(update={"t": i / 30}) for i, f in enumerate(frames)],
    )


def test_angle_at():
    assert angles.angle_at((0, 0), (0, 1), (1, 1)) == pytest.approx(90)
    assert angles.angle_at((0, 0), (0, 1), (0, 2)) == pytest.approx(180)
    assert angles.angle_at((0, 0), (0, 0), (1, 1)) is None


def test_trunk_lean():
    assert angles.trunk_lean((0, 0), (0, 100)) == pytest.approx(0)
    assert angles.trunk_lean((100, 0), (0, 100)) == pytest.approx(45)
    assert angles.trunk_lean((-100, 0), (0, 100)) == pytest.approx(45)


def test_joint_angles_from_figure():
    a = angles.joint_angles(_figure(knee_deg=100))
    assert a["knee_l"] == pytest.approx(100)
    assert a["hip_l"] == pytest.approx(180)
    assert a["elbow_l"] == pytest.approx(90)
    assert a["trunk"] == pytest.approx(0)
    # The far (right) side is barely visible in _figure, so it goes unmeasured rather than guessed.
    assert a["knee_r"] is None


def test_both_sides_measured_when_visible():
    frame = _figure(knee_deg=100)
    for i in range(12, 33, 2):
        frame.landmarks[i][3] = 0.9
    a = angles.joint_angles(frame)
    assert a["knee_l"] == pytest.approx(100)
    assert a["knee_r"] == pytest.approx(100)


def test_joints_list_both_sides():
    assert angles.JOINTS[0] == "trunk"
    assert {"knee_l", "knee_r", "shoulder_l", "shoulder_r"} <= set(angles.JOINTS)
    assert angles.opposite_side("knee_l") == "knee_r"
    assert angles.opposite_side("trunk") == "trunk"


def test_low_visibility_is_not_measured():
    frame = _figure()
    frame.landmarks[25] = [300.0, 350.0, 0.0, 0.2]
    a = angles.joint_angles(frame)
    assert a["knee_l"] is None and a["hip_l"] is None
    assert a["trunk"] is not None
    frame.landmarks[23] = None
    assert angles.joint_angles(frame)["trunk"] is None


def test_camera_side_and_facing():
    left = _seq([_figure(visible="left", facing=1)])
    right = _seq([_figure(visible="right", facing=-1)])
    assert angles.camera_side(left) == "left"
    assert angles.camera_side(right) == "right"
    assert angles.facing(left, "left") == 1
    assert angles.facing(right, "right") == -1


def test_smooth_keeps_gaps():
    assert angles.smooth([10, None, 20, 30, 40], window=3) == [10, None, 25, 30, 35]


def test_describe():
    assert angles.describe("knee_l", -12.4) == "Knee (left): 12° more bent than reference"
    assert angles.describe("trunk", 8) == "Trunk: 8° leaning more than reference"
    assert angles.describe("hip_r", 0.4) == "Hip (right): matches reference"


def test_sync_lines_up_rep_phases():
    user = _seq([_figure()] * 11)
    ref = _seq([_figure()] * 21)
    pairs = dict(real.sync(user, RepWindow(start=0, end=10, bottom=4), ref, RepWindow(start=0, end=20, bottom=12)))
    assert len(pairs) == 11
    assert pairs[0] == 0 and pairs[4] == 12 and pairs[10] == 20
    assert pairs[2] == 6
    assert pairs[7] == 16


def test_align_scale_and_mirror():
    user = _seq([_figure(facing=1)] * 3)
    ref = _seq([_figure(facing=-1, size=2.0)] * 3)
    alignment = real.align(user, ref, [(0, 0), (1, 1), (2, 2)])
    assert alignment[0].scale == pytest.approx(0.5)
    assert alignment[0].mirror is True
    assert alignment[0].anchor == pytest.approx([300, 250])


def test_score_reports_signed_knee_delta():
    user = _seq([_figure(knee_deg=90)] * 5)
    ref = _seq([_figure(knee_deg=120, facing=-1, visible="right")] * 8)
    user_rep = real.find_rep(user, "squat")
    ref_rep = real.find_rep(ref, "squat")
    alignment = real.align(user, ref, real.sync(user, user_rep, ref, ref_rep))
    report = real.score(user, ref, alignment, user_rep)

    assert report.user_side == "left" and report.ref_side == "right"
    # User films their left, reference their right: still compared, near side to near side.
    assert next(iter(report.per_joint)) == "knee_l"
    knee = report.per_joint["knee_l"]
    assert knee.delta_at_bottom == pytest.approx(-30)
    assert knee.max_delta == pytest.approx(-30)
    assert knee.user_at_bottom == pytest.approx(90)
    assert knee.ref_at_bottom == pytest.approx(120)
    assert knee.measured_fraction == 1.0
    assert knee.message == "Knee (left): 30° more bent than reference"
    assert report.per_joint["knee_r"].max_delta is None
    assert len(report.frames) == 5
    assert all(f.deltas["knee_l"] == pytest.approx(-30) for f in report.frames)
    assert report.frames[0].user["knee_l"] == pytest.approx(90)
    assert report.frames[0].ref["knee_l"] == pytest.approx(120)


def test_score_with_no_person_detected():
    empty = PoseFrame(t=0.0, landmarks=[None] * 33)
    user = _seq([empty] * 4)
    ref = _seq([_figure()] * 4)
    user_rep = real.find_rep(user, "squat")
    alignment = real.align(user, ref, real.sync(user, user_rep, ref, real.find_rep(ref, "squat")))
    report = real.score(user, ref, alignment, user_rep)
    assert all(j.max_delta is None and j.measured_fraction == 0 for j in report.per_joint.values())
    assert all(v is None for f in report.frames for v in f.deltas.values())
