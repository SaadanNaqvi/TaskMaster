// MediaPipe's 33-landmark indices for ankles (stable since BlazePose's 2020 release) — same
// landmarks backend/pose/extract_pose_sequence.py writes into PoseSequence. Anchoring on the feet
// rather than the hip: the hip moves up/down through a squat, so anchoring there only lines up at
// whatever instant it was solved on — the feet stay planted for the whole rep, and matching where
// they touch the ground is also just the more visually obvious reference point for "does this
// overlay line up with the person."
const MP_ANKLE_L = 27;
const MP_ANKLE_R = 28;
const MP_HIP_L = 23;
const MP_HIP_R = 24;

export interface PixelPoint {
  x: number;
  y: number;
}

function midpointPx(landmarks: (number[] | null)[], a: number, b: number): PixelPoint | null {
  const pa = landmarks[a];
  const pb = landmarks[b];
  if (!pa || !pb) return null;
  return { x: (pa[0] + pb[0]) / 2, y: (pa[1] + pb[1]) / 2 };
}

/** Ankle-midpoint pixel position from one frame of MediaPipe landmarks — null if either ankle
 * landmark wasn't detected that frame. */
export function anklePx(landmarks: (number[] | null)[]): PixelPoint | null {
  return midpointPx(landmarks, MP_ANKLE_L, MP_ANKLE_R);
}

/** Hip-midpoint pixel position from one frame of MediaPipe landmarks — null if either hip
 * landmark wasn't detected that frame. */
export function hipPx(landmarks: (number[] | null)[]): PixelPoint | null {
  return midpointPx(landmarks, MP_HIP_L, MP_HIP_R);
}

function stablePx(
  frames: { landmarks: (number[] | null)[] }[],
  pick: (landmarks: (number[] | null)[]) => PixelPoint | null,
  windowSize: number
): PixelPoint | null {
  const samples: PixelPoint[] = [];
  for (let i = 0; i < frames.length && samples.length < windowSize; i++) {
    const p = pick(frames[i].landmarks);
    if (p) samples.push(p);
  }
  if (samples.length === 0) return null;
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  };
  return { x: median(samples.map((s) => s.x)), y: median(samples.map((s) => s.y)) };
}

/**
 * Median ankle-midpoint position across the first `windowSize` frames with a detected ankle
 * (default 10), instead of a single frame's own reading. Verified on a real recorded clip: the
 * detected ankle position moved ~190px vertically and ~40px horizontally over just the first 3
 * frames before holding steady for the rest of the clip — the very first frame or two of pose
 * detection can be visibly less stable than once it's tracking, so anchoring on frame 0 alone risks
 * anchoring on that transient instead of where the person actually stands. The median is dominated
 * by the (many) stable frames, not the (few) unstable ones.
 */
export function stableAnklePx(frames: { landmarks: (number[] | null)[] }[], windowSize = 10): PixelPoint | null {
  return stablePx(frames, anklePx, windowSize);
}

/** Same first-N-detected-frames median as stableAnklePx, but for the hip midpoint — the user's
 * standing hip height, since clips start with the person upright. */
export function stableHipPx(frames: { landmarks: (number[] | null)[] }[], windowSize = 10): PixelPoint | null {
  return stablePx(frames, hipPx, windowSize);
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
