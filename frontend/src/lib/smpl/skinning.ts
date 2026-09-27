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

/**
 * A poser bound to one SMPL asset. Precomputes the rest-pose skeleton once, then turns an
 * axis-angle pose (jointCount*3 numbers, radians) into skinned vertex positions via standard
 * Linear Blend Skinning — no shape/pose-corrective blend shapes (see convert_smpl.py for why).
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
    const { vertexCount, jointCount, vertices, weights } = this.asset;
    const global = this.globalTransforms(poseVec);
    const skin = global.map((g, j) => g.clone().multiply(this.restGlobalInverse[j]).elements);

    for (let i = 0; i < vertexCount; i++) {
      const vx = vertices[i * 3];
      const vy = vertices[i * 3 + 1];
      const vz = vertices[i * 3 + 2];
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
