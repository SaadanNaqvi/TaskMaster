import { ApiAlignmentFrame, ApiPoseFrame } from '../../services/apiGateway';

export type Side = 'left' | 'right';
export type Pt = { x: number; y: number };
/** `far` marks bones on the body side facing away from the camera — drawn fainter, since angles are
 * only measured on the camera side and MediaPipe is mostly guessing at the occluded far limbs. */
export type Bone = { a: Pt; b: Pt; far: boolean };

/** Same cutoff the backend's angles.py uses — below it a landmark is treated as not seen. */
const MIN_VISIBILITY = 0.5;
/** Looser cutoff for just drawing the figure, so the (often low-visibility) far side still shows. */
const DRAW_MIN_VISIBILITY = 0.1;

// One side of the body in MediaPipe's 33-landmark indices (left side; the right side is each
// index + 1, except the nose).
const LEFT_BONES: [number, number][] = [
  [0, 11], // nose - shoulder
  [11, 13], // shoulder - elbow
  [13, 15], // elbow - wrist
  [11, 23], // shoulder - hip
  [23, 25], // hip - knee
  [25, 27], // knee - ankle
  [27, 29], // ankle - heel
  [29, 31], // heel - toe
  [27, 31], // ankle - toe
];
// Bones joining the two sides.
const CROSS_BONES: [number, number][] = [
  [11, 12], // shoulder - shoulder
  [23, 24], // hip - hip
];

// Landmark each measured joint's angle sits at (backend/app/pipeline/angles.py), left side.
const LEFT_JOINT_LANDMARK: Record<string, number> = { shoulder: 11, elbow: 13, hip: 23, knee: 25, ankle: 27 };

function sideIndex(i: number, side: Side): number {
  return i === 0 || side === 'left' ? i : i + 1;
}

export function landmark(frame: ApiPoseFrame | undefined, i: number, minVisibility = MIN_VISIBILITY): Pt | null {
  const lm = frame?.landmarks[i];
  if (!lm || lm[3] < minVisibility) return null;
  return { x: lm[0], y: lm[1] };
}

/** The whole-body stick figure, each end passed through `map`. `cameraSide` is the side the
 * angles were measured on; the other side's bones come back flagged `far`. */
export function skeletonBones(frame: ApiPoseFrame | undefined, cameraSide: Side, map: (p: Pt) => Pt): Bone[] {
  const bones: Bone[] = [];
  const add = (i: number, j: number, far: boolean) => {
    const pa = landmark(frame, i, DRAW_MIN_VISIBILITY);
    const pb = landmark(frame, j, DRAW_MIN_VISIBILITY);
    if (pa && pb) bones.push({ a: map(pa), b: map(pb), far });
  };
  const farSide: Side = cameraSide === 'left' ? 'right' : 'left';
  // Far side first so the camera side draws on top of it.
  for (const [i, j] of LEFT_BONES) add(sideIndex(i, farSide), sideIndex(j, farSide), true);
  for (const [i, j] of CROSS_BONES) add(i, j, false);
  for (const [i, j] of LEFT_BONES) add(sideIndex(i, cameraSide), sideIndex(j, cameraSide), false);
  return bones;
}

function midpoint(frame: ApiPoseFrame | undefined, a: number, b: number): Pt | null {
  const pts = [landmark(frame, a), landmark(frame, b)].filter((p): p is Pt => p !== null);
  if (pts.length === 0) return null;
  return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
}

/** Where a joint's delta label is pinned, for joint keys like 'knee_l' / 'knee_r' — trunk lean sits
 * mid-torso rather than on a joint. */
export function jointPoint(frame: ApiPoseFrame | undefined, joint: string): Pt | null {
  if (joint === 'trunk') {
    const s = midpoint(frame, 11, 12);
    const h = midpoint(frame, 23, 24);
    return s && h ? { x: (s.x + h.x) / 2, y: (s.y + h.y) / 2 } : null;
  }
  const [name, suffix] = joint.split('_');
  const i = LEFT_JOINT_LANDMARK[name];
  if (i === undefined || (suffix !== 'l' && suffix !== 'r')) return null;
  return landmark(frame, sideIndex(i, suffix === 'l' ? 'left' : 'right'));
}

/** Maps a reference-video pixel into the user video's pixel space so the reference skeleton lays
 * over the user's (backend/app/schemas.py::AlignmentFrame). */
export function refToUserSpace(p: Pt, a: ApiAlignmentFrame): Pt {
  const dx = (p.x - a.ref_anchor[0]) * (a.mirror ? -1 : 1);
  return { x: a.anchor[0] + a.scale * dx, y: a.anchor[1] + a.scale * (p.y - a.ref_anchor[1]) };
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
