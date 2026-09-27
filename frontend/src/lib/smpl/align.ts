// MediaPipe's 33-landmark indices for ankles (stable since BlazePose's 2020 release) — same
// landmarks backend/pose/extract_pose_sequence.py writes into PoseSequence. Anchoring on the feet
// rather than the hip: the hip moves up/down through a squat, so anchoring there only lines up at
// whatever instant it was solved on — the feet stay planted for the whole rep, and matching where
// they touch the ground is also just the more visually obvious reference point for "does this
// overlay line up with the person."
const MP_ANKLE_L = 27;
const MP_ANKLE_R = 28;

export interface PixelPoint {
  x: number;
  y: number;
}

/** Ankle-midpoint pixel position from one frame of MediaPipe landmarks — null if either ankle
 * landmark wasn't detected that frame. */
export function anklePx(landmarks: (number[] | null)[]): PixelPoint | null {
  const al = landmarks[MP_ANKLE_L];
  const ar = landmarks[MP_ANKLE_R];
  if (!al || !ar) return null;
  return { x: (al[0] + ar[0]) / 2, y: (al[1] + ar[1]) / 2 };
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
  const samples: PixelPoint[] = [];
  for (let i = 0; i < frames.length && samples.length < windowSize; i++) {
    const p = anklePx(frames[i].landmarks);
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
