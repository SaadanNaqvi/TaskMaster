"""
Convert a SMPL body model .pkl (from https://smpl.is.tue.mpg.de/, license required) into a plain
JSON asset the frontend can load directly, with no Python/pickle/chumpy dependency at runtime.

This is a one-time, local data-format conversion — it does not train or fit anything. It extracts:
  - vertices  : rest-pose ("T-pose") mesh vertex positions, from `v_template`
  - faces     : triangle indices, from `f`
  - weights   : per-vertex joint skinning weights, from `weights` (used for linear blend skinning)
  - joints    : rest-pose joint positions, computed as `J_regressor @ v_template`
  - parents   : the 24-joint kinematic tree (parent index per joint, -1 for the root)

Deliberately NOT included: `shapedirs` / `posedirs` (SMPL's shape and pose-corrective blend
shapes). Skipping them keeps the exported asset small (~1-2MB instead of tens of MB) and skips a
chunk of the SMPL math — the tradeoff is the posed dummy mesh won't get SMPL's soft-tissue
corrections (skin bulging at bent joints, etc.), which is a fine tradeoff for a placeholder overlay
that will be replaced by a real backend-driven overlay later.

Usage:
    cd backend
    pip install numpy     # any recent version — no special pin needed, see below
    python3 -m scripts.convert_smpl --input pose/models/smpl/SMPL_NEUTRAL.pkl

This overwrites frontend/assets/smpl/body_model.json in place — that exact path is committed to
the repo with a small procedural placeholder mesh so the app always has *something* to load without
a bundler error. Once you run this script it becomes the real SMPL mesh. If this repo is or becomes
public, don't commit that overwrite back — SMPL's license doesn't allow redistributing the model.

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


def convert(input_path: Path, output_path: Path) -> None:
    data = load_smpl_pkl(input_path)

    vertices = _to_dense(data['v_template']).astype(np.float32)  # (N, 3)
    faces = _to_dense(data['f']).astype(np.int32)  # (M, 3)
    weights = _to_dense(data['weights']).astype(np.float32)  # (N, J)
    j_regressor = _to_dense(data['J_regressor']).astype(np.float32)  # (J, N)
    kintree = np.asarray(data['kintree_table']).astype(np.int64)  # (2, J)

    joints = j_regressor @ vertices  # (J, 3) rest-pose joint positions

    parents = kintree[0].tolist()
    # SMPL stores the root's parent as a sentinel (commonly 2**32 - 1); normalize to -1.
    parents = [-1 if p > len(parents) else p for p in parents]

    vertex_count = vertices.shape[0]
    joint_count = joints.shape[0]
    if weights.shape != (vertex_count, joint_count):
        raise ValueError(f'Unexpected weights shape {weights.shape}, expected {(vertex_count, joint_count)}')

    payload = {
        'vertexCount': vertex_count,
        'jointCount': joint_count,
        'vertices': vertices.reshape(-1).tolist(),
        'faces': faces.reshape(-1).tolist(),
        'weights': weights.reshape(-1).tolist(),
        'joints': joints.reshape(-1).tolist(),
        'parents': parents,
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
        default='../frontend/assets/smpl/body_model.json',
        help='Output JSON path (default: ../frontend/assets/smpl/body_model.json)',
    )
    args = parser.parse_args()
    convert(Path(args.input), Path(args.output))


if __name__ == '__main__':
    main()
