import { ApiAlignmentFrame, ApiPoseFrame } from '../../services/apiGateway';

export type Side = 'left' | 'right';
export type Pt = { x: number; y: number };
export type Bone = [Pt, Pt];

/** Same cutoff the backend's angles.py uses — below it a landmark is treated as not seen. */
const MIN_VISIBILITY = 0.5;

// Stick figure for one side of the body in MediaPipe's 33-landmark indices (left side; the right
// side is each index + 1, except the nose). Only the camera-facing side is drawn — it's the side
// the angles are measured on, and the far side is mostly occluded noise in a side-on clip.
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

// Landmark each measured joint's angle sits at (backend/app/pipeline/angles.py), left side.
const LEFT_JOINT_LANDMARK: Record<string, number> = { shoulder: 11, elbow: 13, hip: 23, knee: 25, ankle: 27 };

function sideIndex(i: number, side: Side): number {
  return i === 0 || side === 'left' ? i : i + 1;
}

export function landmark(frame: ApiPoseFrame | undefined, i: number): Pt | null {
  const lm = frame?.landmarks[i];
  if (!lm || lm[3] < MIN_VISIBILITY) return null;
  return { x: lm[0], y: lm[1] };
}

/** The visible bones of one side of the body, each end passed through `map`. */
export function skeletonBones(frame: ApiPoseFrame | undefined, side: Side, map: (p: Pt) => Pt): Bone[] {
  const bones: Bone[] = [];
  for (const [a, b] of LEFT_BONES) {
    const pa = landmark(frame, sideIndex(a, side));
    const pb = landmark(frame, sideIndex(b, side));
    if (pa && pb) bones.push([map(pa), map(pb)]);
  }
  return bones;
}

/** Where a joint's delta label is pinned — trunk lean sits mid-torso rather than on a joint. */
export function jointPoint(frame: ApiPoseFrame | undefined, joint: string, side: Side): Pt | null {
  if (joint === 'trunk') {
    const s = landmark(frame, sideIndex(11, side));
    const h = landmark(frame, sideIndex(23, side));
    return s && h ? { x: (s.x + h.x) / 2, y: (s.y + h.y) / 2 } : null;
  }
  const i = LEFT_JOINT_LANDMARK[joint];
  return i === undefined ? null : landmark(frame, sideIndex(i, side));
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
