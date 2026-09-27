import * as THREE from 'three';
import { SmplAsset, SmplPose } from './types';

function axisAngleToQuaternion(rx: number, ry: number, rz: number): THREE.Quaternion {
  const angle = Math.sqrt(rx * rx + ry * ry + rz * rz);
  if (angle < 1e-8) return new THREE.Quaternion();
  return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(rx / angle, ry / angle, rz / angle), angle);
}

function localRestTransform(asset: SmplAsset, joint: number): THREE.Matrix4 {
  const { joints, parents } = asset;
  const jx = joints[joint * 3];
  const jy = joints[joint * 3 + 1];
  const jz = joints[joint * 3 + 2];
  const parent = parents[joint];
  if (parent < 0) return new THREE.Matrix4().makeTranslation(jx, jy, jz);
  return new THREE.Matrix4().makeTranslation(
    jx - joints[parent * 3],
    jy - joints[parent * 3 + 1],
    jz - joints[parent * 3 + 2]
  );
}

const IDENTITY_ROTATION_ROW_MAJOR = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** Row-major-flattened (R - I) for one joint's *local* rotation — SMPL's pose-corrective blend
 * shapes are defined in terms of each joint's own local rotation, not its composed world one. */
function poseFeatureBlock(rx: number, ry: number, rz: number, out: Float32Array, offset: number): void {
  const e = new THREE.Matrix4().makeRotationFromQuaternion(axisAngleToQuaternion(rx, ry, rz)).elements;
  // e is column-major; pick row-major order to match convert_smpl.py's posedirs column layout.
  const rowMajor = [e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]];
  for (let k = 0; k < 9; k++) out[offset + k] = rowMajor[k] - IDENTITY_ROTATION_ROW_MAJOR[k];
}

/**
 * A poser bound to one SMPL asset. Precomputes the rest-pose skeleton once, then turns an
 * axis-angle pose (jointCount*3 numbers, radians) into skinned vertex positions via standard
 * Linear Blend Skinning, plus pose-corrective blend shapes for whichever joints the asset carries
 * them for (see convert_smpl.py's POSE_CORRECTIVE_JOINTS — currently knees + elbows only, to fix
 * the "candy-wrapper" collapse plain LBS produces at a deeply bent knee).
 */
export class SmplPoser {
  private readonly asset: SmplAsset;
  private readonly restGlobalInverse: THREE.Matrix4[];

  constructor(asset: SmplAsset) {
    this.asset = asset;
    const restGlobal: THREE.Matrix4[] = new Array(asset.jointCount);
    for (let j = 0; j < asset.jointCount; j++) {
      const parent = asset.parents[j];
      const local = localRestTransform(asset, j);
      restGlobal[j] = parent < 0 ? local : restGlobal[parent].clone().multiply(local);
    }
    this.restGlobalInverse = restGlobal.map((m) => m.clone().invert());
  }

  /** Global (world-space, rest-relative) transform of each joint for the given pose. */
  globalTransforms(pose: SmplPose): THREE.Matrix4[] {
    const { jointCount, parents } = this.asset;
    const local: THREE.Matrix4[] = new Array(jointCount);
    for (let j = 0; j < jointCount; j++) {
      const q = axisAngleToQuaternion(pose[j * 3], pose[j * 3 + 1], pose[j * 3 + 2]);
      const rest = localRestTransform(this.asset, j);
      local[j] = new THREE.Matrix4().makeRotationFromQuaternion(q).premultiply(rest);
    }
    const global: THREE.Matrix4[] = new Array(jointCount);
    for (let j = 0; j < jointCount; j++) {
      const parent = parents[j];
      global[j] = parent < 0 ? local[j] : global[parent].clone().multiply(local[j]);
    }
    return global;
  }

  /** Writes skinned vertex positions for the given pose into `out` (length vertexCount*3). */
  pose(poseVec: SmplPose, out: Float32Array): void {
    const { vertexCount, jointCount, vertices, weights, poseCorrectiveJoints, poseDirs } = this.asset;
    const global = this.globalTransforms(poseVec);
    const skin = global.map((g, j) => g.clone().multiply(this.restGlobalInverse[j]).elements);

    const correctiveCount = poseCorrectiveJoints.length * 9;
    let poseFeature: Float32Array | null = null;
    if (correctiveCount > 0) {
      poseFeature = new Float32Array(correctiveCount);
      poseCorrectiveJoints.forEach((joint, idx) => {
        poseFeatureBlock(poseVec[joint * 3], poseVec[joint * 3 + 1], poseVec[joint * 3 + 2], poseFeature!, idx * 9);
      });
    }

    for (let i = 0; i < vertexCount; i++) {
      let vx = vertices[i * 3];
      let vy = vertices[i * 3 + 1];
      let vz = vertices[i * 3 + 2];
      if (poseFeature) {
        const base = i * 3 * correctiveCount;
        for (let k = 0; k < correctiveCount; k++) {
          const f = poseFeature[k];
          if (f === 0) continue;
          vx += poseDirs[base + k] * f;
          vy += poseDirs[base + correctiveCount + k] * f;
          vz += poseDirs[base + 2 * correctiveCount + k] * f;
        }
      }
      let ox = 0;
      let oy = 0;
      let oz = 0;
      const weightBase = i * jointCount;
      for (let j = 0; j < jointCount; j++) {
        const w = weights[weightBase + j];
        if (w === 0) continue;
        const e = skin[j]; // three.js Matrix4.elements is column-major
        ox += w * (e[0] * vx + e[4] * vy + e[8] * vz + e[12]);
        oy += w * (e[1] * vx + e[5] * vy + e[9] * vz + e[13]);
        oz += w * (e[2] * vx + e[6] * vy + e[10] * vz + e[14]);
      }
      out[i * 3] = ox;
      out[i * 3 + 1] = oy;
      out[i * 3 + 2] = oz;
    }
  }
}
