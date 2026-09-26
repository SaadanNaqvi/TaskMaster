export type JointKey = 'head' | 'sh' | 'el' | 'wr' | 'hip' | 'kn' | 'an' | 'he' | 'to';
export type Point = [number, number];
export type Joints = Record<JointKey, Point>;

/** Reference geometry lifted from the mockup so the real UI matches it 1:1. Viewbox is 360x480. */
export const USER_JOINTS: Joints = {
  head: [228, 150],
  sh: [206, 192],
  el: [178, 222],
  wr: [196, 190],
  hip: [140, 318],
  kn: [236, 330],
  an: [196, 430],
  he: [180, 440],
  to: [230, 440],
};

export const REF_JOINTS: Joints = {
  head: [194, 142],
  sh: [178, 186],
  el: [154, 216],
  wr: [170, 186],
  hip: [140, 318],
  kn: [228, 302],
  an: [192, 404],
  he: [176, 414],
  to: [226, 414],
};

/** A slightly deeper squat than USER_JOINTS — used to animate "the correct rep" in loops. */
export const REF_JOINTS_DEEP: Joints = {
  head: [214, 176],
  sh: [190, 216],
  el: [162, 244],
  wr: [178, 214],
  hip: [140, 322],
  kn: [230, 308],
  an: [192, 404],
  he: [176, 414],
  to: [226, 414],
};

export const BONES: [JointKey, JointKey][] = [
  ['sh', 'hip'],
  ['hip', 'kn'],
  ['kn', 'an'],
  ['he', 'to'],
  ['sh', 'el'],
  ['el', 'wr'],
];

export function lerpJoints(a: Joints, b: Joints, t: number): Joints {
  const out = {} as Joints;
  (Object.keys(a) as JointKey[]).forEach((k) => {
    out[k] = [a[k][0] + (b[k][0] - a[k][0]) * t, a[k][1] + (b[k][1] - a[k][1]) * t];
  });
  return out;
}
