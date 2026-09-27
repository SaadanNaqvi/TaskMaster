"""
Convert a SMPL body model .pkl (from https://smpl.is.tue.mpg.de/, license required) into a plain
JSON asset the frontend can load directly, with no Python/pickle/chumpy dependency at runtime.

This is a one-time, local data-format conversion — it does not train or fit anything. It extracts:
  - vertices  : rest-pose ("T-pose") mesh vertex positions, from `v_template`
  - faces     : triangle indices, from `f`
  - weights   : per-vertex joint skinning weights, from `weights` (used for linear blend skinning)
  - joints    : rest-pose joint positions, computed as `J_regressor @ v_template`
  - parents   : the 24-joint kinematic tree (parent index per joint, -1 for the root)
  - poseDirs  : pose-corrective blend shapes (`posedirs`), but only the 4 columns-blocks for
                POSE_CORRECTIVE_JOINTS (knees + elbows) — the joints this app's exercises actually
                bend far enough for plain linear-blend-skinning's "candy-wrapper" collapse at the
                joint to be visible. The full (V, 3, 207) posedirs covers all 23 non-root joints and
                would add tens of MB to a mobile bundle for joints (wrists, spine, collars, ...)
                that never bend enough in an exercise clip to be worth it.

Deliberately NOT included: `shapedirs` (SMPL's shape blend shapes — no per-user body shape
personalization yet, so every rendered body uses the mean/rest shape regardless of betas the pose
pipeline may produce).

Usage:
    cd backend
    pip install numpy     # any recent version — no special pin needed, see below
    python3 -m scripts.convert_smpl --input pose/models/smpl/SMPL_NEUTRAL.pkl

This overwrites frontend/assets/smpl/body_model.smplmesh in place (content is plain JSON despite
the extension — see --output help) — that exact path is committed to the repo with a small
procedural placeholder mesh so the app always has *something* to load without a bundler error.
Once you run this script it becomes the real SMPL mesh. If this repo is or becomes public, don't
commit that overwrite back — SMPL's license doesn't allow redistributing the model.

Why there's no `chumpy` dependency here, on purpose
----------------------------------------------------
SMPL's official .pkl stores several arrays as `chumpy.Ch` objects instead of plain numpy arrays.
Unpickling technically needs *some* importable `chumpy.Ch` class to reconstruct them — but
installing the real `chumpy` package on any modern Python fails, because chumpy's own setup.py
does a raw `import pip; pip.req.parse_requirements(...)`, an internal pip API that was removed
around pip 10 (2018) and isn't coming back. There is no Python-version fix for this — Python 3.9
through 3.14 all hit the same broken install.

Instead, this script registers a tiny **stub** `chumpy` module before unpickling. It doesn't
replicate chumpy's autodiff machinery — it just gives pickle a class it can restore attributes
onto (`Ch.__dict__`), and then we read the raw underlying array straight out of that dict. We never
need chumpy to actually *do* anything, since we only want the constant arrays it was wrapping.
"""

from __future__ import annotations

import argparse
import base64
import json
import pickle
import sys
import types
from pathlib import Path

import numpy as np


def _install_chumpy_stub() -> None:
    """Registers fake `chumpy` / `chumpy.ch` modules so pickle can unpickle SMPL's Ch objects
    without the real (unbuildable) chumpy package installed."""

    class _ChStub:
        def __setstate__(self, state):
            # Default object pickling calls this with a dict; be permissive in case some
            # chumpy version pickles a tuple or something else instead.
            if isinstance(state, dict):
                self.__dict__.update(state)
            else:
                self.__dict__['_raw_state'] = state

        def __reduce__(self):  # pragma: no cover - only relevant if re-pickled, which we don't do
            return (_ChStub, ())

    ch_module = types.ModuleType('chumpy.ch')
    ch_module.Ch = _ChStub
    chumpy_module = types.ModuleType('chumpy')
    chumpy_module.Ch = _ChStub
    chumpy_module.ch = ch_module
    sys.modules.setdefault('chumpy', chumpy_module)
    sys.modules.setdefault('chumpy.ch', ch_module)


_CANDIDATE_ARRAY_KEYS = ('x', '_x', 'r', '_r')


def _to_dense(value):
    """Unwrap a (possibly stubbed) chumpy.Ch array, a scipy sparse matrix, or a plain ndarray."""
    if isinstance(value, np.ndarray):
        return value
    if hasattr(value, 'toarray'):  # scipy sparse matrix
        return np.asarray(value.toarray())
    if hasattr(value, 'r') and isinstance(getattr(value, 'r', None), np.ndarray):
        return value.r
    if hasattr(value, '__dict__'):
        for key in _CANDIDATE_ARRAY_KEYS:
            candidate = value.__dict__.get(key)
            if isinstance(candidate, np.ndarray):
                return candidate
        # Nothing matched a known key — surface what's actually there so this is fixable in one edit.
        raise TypeError(
            f"Don't know how to extract an array from {type(value)}; "
            f"its __dict__ keys are: {list(value.__dict__.keys())}. "
            "Add whichever key holds the ndarray to _CANDIDATE_ARRAY_KEYS above."
        )
    return np.asarray(value)


def load_smpl_pkl(path: Path) -> dict:
    _install_chumpy_stub()
    with open(path, 'rb') as fh:
        return pickle.load(fh, encoding='latin1')


# SMPL joints whose bend visibly distorts under plain linear-blend-skinning with no pose-corrective
# term: knees and elbows are the only joints a squat (or most exercises this app targets) bends
# anywhere near their range of motion. Restricting to these 4 (of 23 eligible non-root joints)
# keeps the exported posedirs slice to ~4/23 of full size — full posedirs would add tens of MB to
# a mobile bundle (see the module docstring's original size rationale) for joints that never bend
# far enough in an exercise clip to be worth their weight.
POSE_CORRECTIVE_JOINTS = [4, 5, 18, 19]  # left_knee, right_knee, left_elbow, right_elbow


def convert(input_path: Path, output_path: Path) -> None:
    data = load_smpl_pkl(input_path)

    vertices = _to_dense(data['v_template']).astype(np.float32)  # (N, 3)
    faces = _to_dense(data['f']).astype(np.int32)  # (M, 3)
    weights = _to_dense(data['weights']).astype(np.float32)  # (N, J)
    j_regressor = _to_dense(data['J_regressor']).astype(np.float32)  # (J, N)
    kintree = np.asarray(data['kintree_table']).astype(np.int64)  # (2, J)
    # (N, 3, 207): 207 = 23 non-root joints x 9 (flattened 3x3 rotation-minus-identity), in
    # ascending joint order starting at joint 1 (SMPL's posedirs has no term for the root, since a
    # global rotation of the whole body has no bend to correct for).
    posedirs_full = _to_dense(data['posedirs']).astype(np.float32)

    joints = j_regressor @ vertices  # (J, 3) rest-pose joint positions

    parents = kintree[0].tolist()
    # SMPL stores the root's parent as a sentinel (commonly 2**32 - 1); normalize to -1.
    parents = [-1 if p > len(parents) else p for p in parents]

    vertex_count = vertices.shape[0]
    joint_count = joints.shape[0]
    if weights.shape != (vertex_count, joint_count):
        raise ValueError(f'Unexpected weights shape {weights.shape}, expected {(vertex_count, joint_count)}')

    # Slice out just the 9-column block per selected joint (block for joint j starts at column
    # (j-1)*9, since column 0 belongs to joint 1) and concatenate in POSE_CORRECTIVE_JOINTS order —
    # frontend/src/lib/smpl/skinning.ts must build its pose-feature vector in this same order.
    pose_dirs = np.concatenate(
        [posedirs_full[:, :, (j - 1) * 9:(j - 1) * 9 + 9] for j in POSE_CORRECTIVE_JOINTS], axis=2
    )  # (N, 3, len(POSE_CORRECTIVE_JOINTS) * 9)

    # JSON numbers cost ~10-15 ASCII bytes each; 6890*3*36 of them as a plain array bloats this to
    # ~19MB for what's really <3MB of float32 data. Base64-packed bytes cost only 33% overhead
    # instead of 300-500%, so this field alone drops from ~19MB to ~4MB.
    pose_dirs_bytes = pose_dirs.astype(np.float32).tobytes()

    payload = {
        'vertexCount': vertex_count,
        'jointCount': joint_count,
        'vertices': vertices.reshape(-1).tolist(),
        'faces': faces.reshape(-1).tolist(),
        'weights': weights.reshape(-1).tolist(),
        'joints': joints.reshape(-1).tolist(),
        'parents': parents,
        'poseCorrectiveJoints': POSE_CORRECTIVE_JOINTS,
        'poseDirsShape': list(pose_dirs.shape),
        'poseDirsBase64': base64.b64encode(pose_dirs_bytes).decode('ascii'),
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as fh:
        json.dump(payload, fh)

    size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f'Wrote {output_path} ({size_mb:.1f} MB) — {vertex_count} vertices, {joint_count} joints')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True, help='Path to the SMPL .pkl file')
    parser.add_argument(
        '--output',
        default='../frontend/assets/smpl/body_model.smplmesh',
        help='Output path (default: ../frontend/assets/smpl/body_model.smplmesh). Content is plain '
        "JSON; the extension is deliberately not .json so Metro bundles it as a binary asset "
        'instead of inlining it into the JS bundle.',
    )
    args = parser.parse_args()
    convert(Path(args.input), Path(args.output))


if __name__ == '__main__':
    main()
