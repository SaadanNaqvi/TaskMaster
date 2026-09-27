import * as THREE from 'three';
import { parseSmplAsset, SmplAsset, SmplAssetJson } from './types';
import { SmplPoser } from './skinning';

// How far the outline shell sits outside the real surface, as a fraction of the body's own scale
// (uniform scale around the body's local origin, not a true per-vertex normal offset — cheap, and
// looks right for a roughly-centered humanoid; a genuinely uniform-width outline on thin parts
// like fingers would need real normal-offsetting, not worth it here).
const OUTLINE_SCALE = 1.06;

export interface SmplScene {
  asset: SmplAsset;
  poser: SmplPoser;
  scene: THREE.Scene;
  /** Depth-only — invisible (colorWrite disabled), just occludes so `outline` doesn't show through
   * the middle of the body. Don't put a visible material on this; see `outline` for that. */
  mesh: THREE.Mesh;
  /** The actual visible part: a slightly enlarged, back-faces-only shell in the body color. Shares
   * `mesh`'s geometry, so posing updates both at once. Combined with `mesh` above (the standard
   * "inverted hull" toon-outline technique), this reads as a hollow outline of the body instead of
   * a solid filled mesh — the see-through interior is intentional. */
  outline: THREE.Mesh;
  /** Wraps both meshes — manipulate this (not `mesh`/`outline` directly) to position/scale/rotate
   * the whole body as a unit, e.g. for screen-space alignment (lib/smpl/align.ts), while their own
   * vertex positions stay purely a function of the current pose. */
  group: THREE.Group;
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

  const occluderMaterial = new THREE.MeshBasicMaterial({ colorWrite: false });
  const mesh = new THREE.Mesh(geometry, occluderMaterial);
  mesh.renderOrder = 0;

  const outlineMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    side: THREE.BackSide,
    transparent: opacity < 1,
    opacity,
  });
  const outline = new THREE.Mesh(geometry, outlineMaterial);
  outline.scale.setScalar(OUTLINE_SCALE);
  outline.renderOrder = 1;

  const group = new THREE.Group();
  group.add(mesh);
  group.add(outline);
  scene.add(group);

  return { asset, poser, scene, mesh, outline, group, geometry, positions, bounds };
}

export function lerpPose(a: Float32Array, b: Float32Array, t: number): Float32Array {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] + (b[i] - a[i]) * t;
  return out;
}

export function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}
