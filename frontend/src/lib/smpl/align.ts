import * as THREE from 'three';
import { SmplPoser } from './skinning';
import { SmplPose } from './types';

// MediaPipe's 33-landmark indices for hips/shoulders (stable since BlazePose's 2020 release) —
// same landmarks backend/pose/extract_pose_sequence.py writes into PoseSequence.
const MP_HIP_L = 23;
const MP_HIP_R = 24;

// SMPL's standard joint indices for the equivalent anchor point.
const SMPL_HIP_L = 1;
const SMPL_HIP_R = 2;

export interface PixelPoint {
  x: number;
  y: number;
}

/** Hip-midpoint pixel position from one frame of MediaPipe landmarks — null if either hip landmark
 * wasn't detected that frame. */
export function hipPx(landmarks: (number[] | null)[]): PixelPoint | null {
  const hl = landmarks[MP_HIP_L];
  const hr = landmarks[MP_HIP_R];
  if (!hl || !hr) return null;
  return { x: (hl[0] + hr[0]) / 2, y: (hl[1] + hr[1]) / 2 };
}

/** Scale factor and offset `contentFit="cover"` applies when fitting a srcW x srcH video into a
 * dstW x dstH box — the same fit expo-video's <VideoView contentFit="cover"> uses, so a pixel
 * coordinate from the source video's own resolution can be mapped onto the displayed box. */
export function coverFit(srcW: number, srcH: number, dstW: number, dstH: number) {
  const scale = Math.max(dstW / srcW, dstH / srcH);
  return { scale, offsetX: (dstW - srcW * scale) / 2, offsetY: (dstH - srcH * scale) / 2 };
}

export function coverFitPoint(p: PixelPoint, srcW: number, srcH: number, dstW: number, dstH: number): PixelPoint {
  const { scale, offsetX, offsetY } = coverFit(srcW, srcH, dstW, dstH);
  return { x: p.x * scale + offsetX, y: p.y * scale + offsetY };
}

/**
 * Solves the (x,y) offset that places the reference mesh's hip at `targetHipPx`, for a mesh held
 * at a fixed depth of `referenceDepth` in front of `camera`, at its natural (unscaled) size — no
 * scaling is applied, by design: position-only overlap, not size-matching. This is 2D pixel-space
 * compositing, not real 3D spatial alignment — there's no camera calibration for the recorded
 * video, so "overlap in screen space" (this app's actual ask) is what's achievable, not "occupy
 * the same real-world 3D position."
 *
 * Approximation: the hip's local z-offset from the mesh's own origin is ignored when computing
 * perspective scale (i.e. the hip is treated as if exactly at `referenceDepth`) — the real offset
 * is small relative to referenceDepth (body thickness vs. several meters), so the error is minor.
 */
export function solveScreenPosition(params: {
  camera: THREE.PerspectiveCamera;
  poser: SmplPoser;
  pose: SmplPose;
  viewportW: number;
  viewportH: number;
  targetHipPx: PixelPoint;
  referenceDepth: number;
}): THREE.Vector3 {
  const { camera, poser, pose, viewportW, viewportH, targetHipPx, referenceDepth } = params;

  const hipL = poser.jointWorldPosition(pose, SMPL_HIP_L);
  const hipR = poser.jointWorldPosition(pose, SMPL_HIP_R);
  const hip = hipL.add(hipR).multiplyScalar(0.5);

  const fovRad = (camera.fov * Math.PI) / 180;
  const halfHeightWorld = referenceDepth * Math.tan(fovRad / 2);
  const pixelsPerWorldUnit = viewportH / (2 * halfHeightWorld);

  // Where the hip would land on screen if the group sat at (0,0,-referenceDepth), unscaled.
  const hipScreenX = viewportW / 2 + hip.x * pixelsPerWorldUnit;
  const hipScreenY = viewportH / 2 - hip.y * pixelsPerWorldUnit;

  const worldDX = (targetHipPx.x - hipScreenX) / pixelsPerWorldUnit;
  const worldDY = -(targetHipPx.y - hipScreenY) / pixelsPerWorldUnit;

  return new THREE.Vector3(worldDX, worldDY, -referenceDepth);
}
