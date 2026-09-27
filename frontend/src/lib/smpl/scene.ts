import * as THREE from 'three';
import { parseSmplAsset, SmplAsset, SmplAssetJson } from './types';
import { SmplPoser } from './skinning';

export interface SmplScene {
  asset: SmplAsset;
  poser: SmplPoser;
  scene: THREE.Scene;
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  positions: Float32Array;
  /** Vertical center + height of the mesh's rest-pose bounds, since different SMPL-topology
   * assets use different coordinate conventions (ground-relative vs pelvis-centered). */
  bounds: { centerY: number; height: number };
}

/** Builds the scene/mesh/lighting shared by every SMPL viewer — the passive results-screen
 * overlay and the full interactive viewer both start from this. */
export function createSmplScene(json: SmplAssetJson, color: THREE.ColorRepresentation, opacity: number): SmplScene {
  const asset = parseSmplAsset(json);
  const poser = new SmplPoser(asset);
  const positions = new Float32Array(asset.vertexCount * 3);

  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < asset.vertexCount; i++) {
    const y = asset.vertices[i * 3 + 1];
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const bounds = { centerY: (minY + maxY) / 2, height: Math.max(maxY - minY, 0.5) };

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const key = new THREE.DirectionalLight(0xffffff, 0.6);
  key.position.set(2, 3, 2);
  scene.add(key);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(Array.from(asset.faces));

  const material = new THREE.MeshLambertMaterial({
    color: new THREE.Color(color),
    transparent: opacity < 1,
    opacity,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  return { asset, poser, scene, mesh, geometry, positions, bounds };
}

export function lerpPose(a: Float32Array, b: Float32Array, t: number): Float32Array {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] + (b[i] - a[i]) * t;
  return out;
}

export function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}
