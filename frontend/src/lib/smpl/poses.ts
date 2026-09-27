import { SmplPose } from './types';

/**
 * SMPL's standard 24-joint order (fixed by the model, unchanged since its 2015 release):
 * 0 pelvis, 1 left_hip, 2 right_hip, 3 spine1, 4 left_knee, 5 right_knee, 6 spine2,
 * 7 left_ankle, 8 right_ankle, 9 spine3, 10 left_foot, 11 right_foot, 12 neck,
 * 13 left_collar, 14 right_collar, 15 head, 16 left_shoulder, 17 right_shoulder,
 * 18 left_elbow, 19 right_elbow, 20 left_wrist, 21 right_wrist, 22 left_hand, 23 right_hand.
 */
export const JOINT_COUNT = 24;

function pose(overrides: { [joint: number]: [number, number, number] }): SmplPose {
  const out = new Float32Array(JOINT_COUNT * 3);
  for (const [jointStr, rvec] of Object.entries(overrides)) {
    const joint = Number(jointStr);
    out[joint * 3] = rvec[0];
    out[joint * 3 + 1] = rvec[1];
    out[joint * 3 + 2] = rvec[2];
  }
  return out;
}

export const STANDING_POSE: SmplPose = pose({});

/**
 * Hand-authored approximate squat-bottom pose (not derived from real motion capture — this whole
 * module only exists to animate a placeholder overlay while there's no real per-frame pose data).
 * Flexion values are rough eyeballed radians, not biomechanically precise.
 */
export const SQUAT_BOTTOM_POSE: SmplPose = pose({
  1: [-1.1, 0, 0.1], // left_hip
  2: [-1.1, 0, -0.1], // right_hip
  3: [-0.25, 0, 0], // spine1
  4: [1.3, 0, 0], // left_knee
  5: [1.3, 0, 0], // right_knee
  6: [-0.15, 0, 0], // spine2
  7: [-0.35, 0, 0], // left_ankle
  8: [-0.35, 0, 0], // right_ankle
  16: [0, 0, 0.35], // left_shoulder — slight arms-forward counterbalance
  17: [0, 0, -0.35], // right_shoulder
});
