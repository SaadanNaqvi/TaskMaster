"""
Convert an exercise video into a per-frame SMPL pose sequence using ROMP (Monocular, One-stage
Regression of Multiple 3D People) — a real learned SMPL regressor, not a geometric approximation.

This replaces the previous MediaPipe-landmarks-to-SMPL-swing-angles approach (see git history).
That approach was a stopgap: MediaPipe only gives 2D-ish joint *positions*, so the amount of SMPL
pose it could reconstruct was capped at "swing" (the bend visible from joint-to-joint direction) —
no twist/roll, no shape, no real global orientation, because position data alone can't reveal
rotation around a bone's own axis. ROMP instead regresses full SMPL parameters (pose, shape, and a
weak-perspective camera) directly from each RGB frame, so we get real twist and a real body shape,
not just what MediaPipe's 33 landmarks happen to expose.

Why ROMP specifically, over HMR2.0/4D-Humans (which the original script's docstring ruled out):
ROMP does its own person detection internally, so it needs no detectron2 — the exact dependency
that made HMR2.0/4D-Humans painful outside Linux+CUDA. It runs on CPU (slow but workable for
offline batch processing of short clips) via `simple-romp`, a pip-installable package.

One-time environment setup (do this once per machine, not per video):
    cd backend
    python3.11 -m venv .venv-romp   # ROMP's dependency stack targets 3.9-3.11, not 3.12+/3.14
    source .venv-romp/bin/activate
    pip install --upgrade setuptools numpy cython lap
    pip install --no-build-isolation -r pose/requirements-romp.txt
    # ROMP's own backbone weights auto-download to ~/.romp/ROMP.pkl on first import.
    # Then convert the *already-licensed* SMPL_NEUTRAL.pkl in pose/models/smpl/ into ROMP's
    # format (this needs the real `chumpy` package to unpickle, which is unbuildable on modern
    # Python — see backend/scripts/convert_smpl.py's docstring for why — so declassify it first
    # with the same stub trick that script uses):
    python3 - <<'PY'
    import pickle, sys, types
    import numpy as np, scipy.sparse
    class _Ch:
        def __setstate__(self, s): self.__dict__.update(s if isinstance(s, dict) else {'_raw': s})
    m = types.ModuleType('chumpy'); m.Ch = _Ch
    ch = types.ModuleType('chumpy.ch'); ch.Ch = _Ch; m.ch = ch
    sys.modules['chumpy'], sys.modules['chumpy.ch'] = m, ch
    def dense(v):
        if isinstance(v, np.ndarray) or scipy.sparse.issparse(v): return v
        return v.r if hasattr(v, 'r') else np.asarray(v)
    with open('pose/models/smpl/SMPL_NEUTRAL.pkl', 'rb') as f:
        model = pickle.load(f, encoding='latin1')
    with open('pose/models/smpl/SMPL_NEUTRAL_declassified.pkl', 'wb') as f:
        pickle.dump({k: dense(v) for k, v in model.items()}, f, protocol=2)
    PY
    romp.prepare_smpl -source_dir=pose/models/smpl
    # (prepare_smpl looks for SMPL_NEUTRAL.pkl specifically — temporarily rename the declassified
    # file to that name, or point -source_dir at a copy of pose/models/smpl with the swap made.
    # J_regressor_extra.npy, J_regressor_h36m.npy and smpl_kid_template.npy already live in
    # pose/models/smpl/ — they're auxiliary regressor matrices from ROMP's own public GitHub
    # release (github.com/Arthur151/ROMP/releases/download/V2.0/smpl_model_data.zip), not
    # SMPL-licensed data, so they're safe to keep committed.)

Usage (same as before):
    cd backend
    source .venv-romp/bin/activate
    python3 -m pose.video_to_smpl_pose --video path/to/clip.mp4 --out pose_sequence.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np
import romp

# ROMP's `smpl_thetas` output is already a standard 24-joint SMPL axis-angle pose (joint 0 =
# global_orient, joints 1-23 = the body), the exact layout frontend/src/lib/smpl/skinning.ts
# expects — so unlike the old geometric script, no per-joint remapping is needed here at all.
JOINT_COUNT = 24

# ROMP predicts global_orient/cam_trans in its own camera-space convention, which renders upside
# down against our Y-up world: verified empirically on a real clip — global_orient came out as a
# ~180 rotation about X for a person standing normally facing the camera (i.e. ROMP's "identity"
# camera-facing orientation IS a 180-about-X flip from our renderer's rest pose), and using
# cam_trans's y/z directly moved the mesh the wrong way during a squat (deepest-squat frame had a
# *positive* y instead of dropping below the standing baseline). Both are corrected by the same
# transform: rotating the whole camera-space frame 180 about X, i.e. negating y and z.
_FLIP_X_180 = cv2.Rodrigues(np.array([np.pi, 0.0, 0.0]))[0]


def _correct_global_orient(pose_72: np.ndarray) -> np.ndarray:
    rot_matrix, _ = cv2.Rodrigues(pose_72[:3].astype(np.float64))
    corrected, _ = cv2.Rodrigues(_FLIP_X_180 @ rot_matrix)
    out = pose_72.copy()
    out[:3] = corrected.flatten()
    return out


def _correct_translation(trans: np.ndarray) -> np.ndarray:
    return trans * np.array([1.0, -1.0, -1.0], dtype=trans.dtype)


def build_romp_model() -> romp.ROMP:
    settings = romp.main.default_settings
    settings.GPU = -1  # CPU-only: no CUDA on the dev/demo machine, and this runs offline anyway.
    settings.show_largest = True  # one person per clip (the user or the reference), side-on.
    settings.temporal_optimize = True  # built-in OneEuro filter — smooths thetas/betas/cam
    # across the calls below, since we reuse one instance in frame order. Replaces the old
    # script's manual EMA-on-landmarks smoothing.
    settings.calc_smpl = False  # we only need thetas/betas/cam_trans, not verts/joints/mesh —
    # skipping the SMPL forward pass roughly doubles per-frame throughput on CPU.
    return romp.ROMP(settings)


def extract_smpl_sequence(
    video_path: Path,
) -> tuple[list[np.ndarray], list[np.ndarray], list[np.ndarray], float]:
    """Returns (poses, betas_per_frame, translations, fps). poses/betas/translations are one
    array per *detected* frame — frames with nobody detected hold the last good values, matching
    the previous script's dropout handling, so playback never snaps to a T-pose mid-clip."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f'Could not open video: {video_path}')
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

    romp_model = build_romp_model()

    poses: list[np.ndarray] = []
    betas: list[np.ndarray] = []
    translations: list[np.ndarray] = []
    detected = 0
    total = 0
    while True:
        ok, frame_bgr = cap.read()
        if not ok:
            break
        total += 1
        outputs = romp_model(frame_bgr)  # expects BGR, i.e. raw cv2.read() output.
        if outputs is not None:
            detected += 1
            pose = _correct_global_orient(outputs['smpl_thetas'][0].astype(np.float32))
            poses.append(pose)
            betas.append(outputs['smpl_betas'][0].astype(np.float32))
            translations.append(_correct_translation(outputs['cam_trans'][0].astype(np.float32)))
        elif poses:
            poses.append(poses[-1])
            betas.append(betas[-1])
            translations.append(translations[-1])
        # else: no detection yet and nothing to hold — drop the frame, matching the old script.
    cap.release()

    print(f'{detected}/{total} frames had a detected person')
    return poses, betas, translations, fps


def convert(video_path: Path, out_path: Path) -> None:
    poses, betas, translations, fps = extract_smpl_sequence(video_path)
    if not poses:
        raise RuntimeError(f'No person detected in any frame of {video_path}')

    # A single body shape for the whole clip reads as more stable than 10 shape params wobbling
    # frame to frame — ROMP regresses betas per-frame independently, so average them out. Not
    # currently consumed by the renderer (frontend/src/lib/smpl/skinning.ts does plain linear
    # blend skinning with no shape blend shapes, same scope cut convert_smpl.py already made for
    # pose-corrective blend shapes) — written here so it's ready once that's added.
    mean_betas = np.mean(np.stack(betas), axis=0)

    # translations are already axis-corrected (see _correct_translation) — root-relative here
    # (first frame subtracted) so playback starts near the origin regardless of where the person
    # stood in frame.
    trans_arr = np.stack(translations)
    trans_arr -= trans_arr[0]

    payload = {
        'fps': fps,
        'jointCount': JOINT_COUNT,
        'betas': mean_betas.tolist(),
        'frames': [
            {'pose': pose.tolist(), 'trans': trans.tolist()}
            for pose, trans in zip(poses, trans_arr)
        ],
    }
    out_path.write_text(json.dumps(payload))
    print(f'Wrote {out_path} — {len(poses)} frames')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--video', required=True, help='Path to the input video')
    parser.add_argument('--out', default='pose_sequence.json', help='Output JSON path')
    args = parser.parse_args()
    convert(Path(args.video), Path(args.out))


if __name__ == '__main__':
    main()
