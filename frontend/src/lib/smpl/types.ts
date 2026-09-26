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
}

export function parseSmplAsset(json: SmplAssetJson): SmplAsset {
  return {
    vertexCount: json.vertexCount,
    jointCount: json.jointCount,
    vertices: Float32Array.from(json.vertices),
    faces: Uint32Array.from(json.faces),
    weights: Float32Array.from(json.weights),
    joints: Float32Array.from(json.joints),
    parents: json.parents,
  };
}

/** A pose is one axis-angle rotation vector (radians, magnitude = angle) per joint. */
export type SmplPose = Float32Array; // length jointCount*3
