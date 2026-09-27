import { toByteArray } from 'base64-js';

export interface SmplAsset {
  vertexCount: number;
  jointCount: number;
  /** Flat (vertexCount*3) rest-pose ("T-pose") vertex positions. */
  vertices: Float32Array;
  /** Flat (faceCount*3) triangle indices. */
  faces: Uint32Array;
  /** Flat (vertexCount*jointCount) per-vertex joint influence weights. */
  weights: Float32Array;
  /** Flat (jointCount*3) rest-pose joint positions. */
  joints: Float32Array;
  /** Parent joint index per joint; -1 for the root. */
  parents: number[];
  /** SMPL joint indices the pose-corrective blend shapes below cover — currently knees + elbows
   * only (see convert_smpl.py's POSE_CORRECTIVE_JOINTS for why just those). Empty when the asset
   * predates this (e.g. the committed placeholder), in which case posing skips the correction. */
  poseCorrectiveJoints: number[];
  /** Flat (vertexCount*3*poseCorrectiveJoints.length*9) pose-corrective blend shape deltas — SMPL's
   * `posedirs`, sliced to poseCorrectiveJoints. Row-major: vertex, then xyz, then the 9 columns per
   * joint in poseCorrectiveJoints order (matching convert_smpl.py's slice order). */
  poseDirs: Float32Array;
}

/** Raw shape of the JSON produced by backend/scripts/convert_smpl.py. */
export interface SmplAssetJson {
  vertexCount: number;
  jointCount: number;
  vertices: number[];
  faces: number[];
  weights: number[];
  joints: number[];
  parents: number[];
  poseCorrectiveJoints?: number[];
  poseDirsShape?: [number, number, number];
  /** base64 of the poseDirs slice packed as little-endian float32 — see convert_smpl.py's size
   * comment for why this isn't a plain JSON number array (~4x smaller this way). */
  poseDirsBase64?: string;
}

export function parseSmplAsset(json: SmplAssetJson): SmplAsset {
  let poseDirs = new Float32Array(0);
  if (json.poseDirsBase64) {
    const bytes = toByteArray(json.poseDirsBase64);
    // Float32Array requires its buffer offset to be a multiple of 4; base64-js always returns a
    // freshly allocated buffer starting at byte 0, so this view is safe without a copy.
    poseDirs = new Float32Array(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength / 4);
  }
  return {
    vertexCount: json.vertexCount,
    jointCount: json.jointCount,
    vertices: Float32Array.from(json.vertices),
    faces: Uint32Array.from(json.faces),
    weights: Float32Array.from(json.weights),
    joints: Float32Array.from(json.joints),
    parents: json.parents,
    poseCorrectiveJoints: json.poseCorrectiveJoints ?? [],
    poseDirs,
  };
}

/** A pose is one axis-angle rotation vector (radians, magnitude = angle) per joint. */
export type SmplPose = Float32Array; // length jointCount*3
