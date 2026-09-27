import * as THREE from 'three';
import { coverFit, coverFitPoint, PixelPoint, stableAnklePx } from './align';
import { SmplPose } from './types';

// Temporary diagnostics for the "overlay rides higher than the person during a squat" report.
// Each measurement below maps to one suspected cause, so a single playback of the demo clip says
// which one is actually responsible:
//   #1 timing  — reference is indexed by fraction-of-user-clip, not synced to the user's rep
//   #2 scale   — model is drawn at a fixed size, unrelated to how big the user appears on screen
//   #3 feet    — skinning pins the pelvis, so bent knees lift the feet unless trans.y compensates
//   #4 trans   — ROMP's cam_trans is metric in ROMP's camera, applied raw in a different camera
// Delete this file (and its call sites in Smpl3DOverlay.tsx) once the cause is confirmed.

const MP_HIP_L = 23;
const MP_HIP_R = 24;
const MP_ANKLE_L = 27;
const MP_ANKLE_R = 28;
const SMPL_KNEE_L = 4;
const SMPL_KNEE_R = 5;

function midpoint(landmarks: (number[] | null)[], a: number, b: number): PixelPoint | null {
  const pa = landmarks[a];
  const pb = landmarks[b];
  if (!pa || !pb) return null;
  return { x: (pa[0] + pb[0]) / 2, y: (pa[1] + pb[1]) / 2 };
}

function median(values: number[]): number {
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Same first-N-detected-frames median as stableAnklePx, but for the hip midpoint. */
function stableHipPx(frames: { landmarks: (number[] | null)[] }[], windowSize = 10): PixelPoint | null {
  const samples: PixelPoint[] = [];
  for (let i = 0; i < frames.length && samples.length < windowSize; i++) {
    const p = midpoint(frames[i].landmarks, MP_HIP_L, MP_HIP_R);
    if (p) samples.push(p);
  }
  if (samples.length === 0) return null;
  return { x: median(samples.map((s) => s.x)), y: median(samples.map((s) => s.y)) };
}

/** Index of the user frame whose timestamp is closest to `t` (frames are sorted by t). */
function userFrameAt(frames: { t: number }[], t: number): number {
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].t < t) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(frames[lo - 1].t - t) < Math.abs(frames[lo].t - t)) return lo - 1;
  return lo;
}

/** Mean knee bend in degrees — axis-angle magnitude of SMPL's two knee joints. Independent of
 * cam_trans, so it finds the reference's squat bottom even if the translation data is wrong. */
function kneeBendDeg(pose: SmplPose): number {
  const mag = (j: number) => Math.hypot(pose[j * 3], pose[j * 3 + 1], pose[j * 3 + 2]);
  return (((mag(SMPL_KNEE_L) + mag(SMPL_KNEE_R)) / 2) * 180) / Math.PI;
}

function argMax(values: number[]): number {
  let best = 0;
  for (let i = 1; i < values.length; i++) if (values[i] > values[best]) best = i;
  return best;
}

/** World point -> drawing-buffer pixel, same space as coverFitPoint(..., viewportW, viewportH). */
function projectToScreen(p: THREE.Vector3, camera: THREE.Camera, viewportW: number, viewportH: number): PixelPoint {
  const ndc = p.clone().project(camera);
  return { x: ((ndc.x + 1) / 2) * viewportW, y: ((1 - ndc.y) / 2) * viewportH };
}

export interface AlignDebugContext {
  camera: THREE.PerspectiveCamera;
  group: THREE.Group;
  positions: Float32Array;
  /** Rest-pose pelvis joint, in the mesh's local space. */
  pelvisRest: THREE.Vector3;
  /** Rest-pose lowest vertex (soles), in the mesh's local space. */
  restFeetLocalY: number;
  /** Rest-pose feet height and pelvis height above them, in world units. */
  groundWorldY: number;
  pelvisAboveFeet: number;
  referenceDepth: number;
  fovRad: number;
  maxRelativeMotion: number;
}

export interface AlignDebugFrame {
  userTime: number;
  userDuration: number;
  refIdx: number;
  pose: SmplPose;
  /** Translation as it came from the pose file, before MAX_RELATIVE_MOTION clamping. */
  rawTranslation: THREE.Vector3;
  viewportW: number;
  viewportH: number;
  /** The screen offset currently applied via translateX/Y, in drawing-buffer (physical) pixels. */
  offsetPhys: PixelPoint;
}

export class AlignDebugger {
  private summaryLogged = false;
  private lastLiveLog = 0;
  private maxFeetLiftPx = 0;
  private maxHipErrPx = 0;
  private maxFeetErrPx = 0;
  private refBottomIdx = -1;
  private userBottomIdx = -1;
  private standingHip: PixelPoint | null = null;

  constructor(
    private readonly ctx: AlignDebugContext,
    private readonly userFrames: { t: number; landmarks: (number[] | null)[] }[],
    private readonly userVideoWidth: number,
    private readonly userVideoHeight: number,
    private readonly poseSequence: SmplPose[]
  ) {
    this.refBottomIdx = argMax(poseSequence.map(kneeBendDeg));
    const hipYs = userFrames.map((f) => midpoint(f.landmarks, MP_HIP_L, MP_HIP_R)?.y ?? -Infinity);
    this.userBottomIdx = argMax(hipYs);
    this.standingHip = stableHipPx(userFrames);
  }

  private pixelsPerWorldUnit(viewportH: number): number {
    return viewportH / (2 * this.ctx.referenceDepth * Math.tan(this.ctx.fovRad / 2));
  }

  /** One-time summary for #1 (timing) and #2 (scale). Returns lines for the on-screen box. */
  summary(userDuration: number, viewportW: number, viewportH: number): string[] {
    const lines: string[] = [];
    const n = this.poseSequence.length;

    // #1 — where each clip bottoms out, and when the reference's bottom actually gets shown.
    const userBottom = this.userFrames[this.userBottomIdx];
    const refFrac = this.refBottomIdx / n;
    const refShownAt = refFrac * userDuration;
    const userFrac = userDuration > 0 ? userBottom.t / userDuration : 0;
    const timing = {
      userBottomT: +userBottom.t.toFixed(2),
      userBottomPct: +(userFrac * 100).toFixed(1),
      refBottomIdx: this.refBottomIdx,
      refLength: n,
      refBottomPct: +(refFrac * 100).toFixed(1),
      refBottomShownAtUserT: +refShownAt.toFixed(2),
      desyncS: +(refShownAt - userBottom.t).toFixed(2),
      refKneeBendAtBottomDeg: +kneeBendDeg(this.poseSequence[this.refBottomIdx]).toFixed(1),
    };
    console.log('[AlignDebug #1 timing]', timing);
    lines.push(
      `#1 userBot ${timing.userBottomT}s(${timing.userBottomPct}%) refBot@${timing.refBottomShownAtUserT}s(${timing.refBottomPct}%) desync ${timing.desyncS}s`
    );

    // #2 — user's standing hip-to-ankle height on screen vs the model's rest pelvis-to-feet height.
    const ankle = stableAnklePx(this.userFrames);
    if (ankle && this.standingHip) {
      const { scale } = coverFit(this.userVideoWidth, this.userVideoHeight, viewportW, viewportH);
      const userLegPx = (ankle.y - this.standingHip.y) * scale;
      const modelLegPx = this.ctx.pelvisAboveFeet * this.pixelsPerWorldUnit(viewportH);
      const sizing = {
        userHipToAnklePx: +userLegPx.toFixed(0),
        modelPelvisToFeetPx: +modelLegPx.toFixed(0),
        modelOverUser: +(modelLegPx / userLegPx).toFixed(2),
        coverScale: +scale.toFixed(3),
      };
      console.log('[AlignDebug #2 scale]', sizing);
      lines.push(`#2 legPx user ${sizing.userHipToAnklePx} model ${sizing.modelPelvisToFeetPx} ratio ${sizing.modelOverUser}`);
    } else {
      console.log('[AlignDebug #2 scale] no stable hip/ankle landmarks in user clip');
      lines.push('#2 no stable hip/ankle landmarks');
    }
    return lines;
  }

  /**
   * Per-update measurements for #1, #3 and #4. Call after the group transform and skinned positions
   * for this frame are written. Returns a live line for the on-screen box, or null when throttled.
   */
  frame(f: AlignDebugFrame): string[] | null {
    const { camera, group, positions, pelvisRest, groundWorldY, maxRelativeMotion } = this.ctx;
    const ppu = this.pixelsPerWorldUnit(f.viewportH);

    const lines: string[] = [];
    if (!this.summaryLogged && f.userDuration > 0) {
      this.summaryLogged = true;
      lines.push(...this.summary(f.userDuration, f.viewportW, f.viewportH));
    }

    camera.updateMatrixWorld();
    group.updateMatrixWorld(true);

    // #3 — lowest skinned vertex (the soles) in world space vs where the anchor assumed they sit.
    let minIdx = 0;
    for (let i = 1; i < positions.length / 3; i++) if (positions[i * 3 + 1] < positions[minIdx * 3 + 1]) minIdx = i;
    const feetLocal = new THREE.Vector3(positions[minIdx * 3], positions[minIdx * 3 + 1], positions[minIdx * 3 + 2]);
    const feetWorld = group.localToWorld(feetLocal.clone());
    // Lift of the feet from skinning alone (pelvis pinned), before translation is added.
    const feetLiftFromPose = feetLocal.y - this.ctx.restFeetLocalY;
    // Net: + = floating above the ground the anchor assumed, after translation too.
    const feetErrWorld = feetWorld.y - groundWorldY;
    const feetUpPx = feetErrWorld * ppu;
    this.maxFeetLiftPx = Math.max(this.maxFeetLiftPx, Math.abs(feetUpPx));

    // #4 — raw translation, whether it got clamped, and what it does on screen.
    const raw = f.rawTranslation;
    const clamped = raw.length() > maxRelativeMotion;
    const transDyPx = -raw.y * ppu;

    // Combined symptom: model pelvis/feet on screen vs user's hip/ankle on screen, same instant.
    const userIdx = userFrameAt(this.userFrames, f.userTime);
    const lm = this.userFrames[userIdx]?.landmarks ?? [];
    const userHip = midpoint(lm, MP_HIP_L, MP_HIP_R);
    const userAnkle = midpoint(lm, MP_ANKLE_L, MP_ANKLE_R);
    const cover = (p: PixelPoint) => coverFitPoint(p, this.userVideoWidth, this.userVideoHeight, f.viewportW, f.viewportH);
    const toScreen = (w: THREE.Vector3) => {
      const s = projectToScreen(w, camera, f.viewportW, f.viewportH);
      return { x: s.x + f.offsetPhys.x, y: s.y + f.offsetPhys.y };
    };
    const modelPelvisScr = toScreen(group.localToWorld(pelvisRest.clone()));
    const modelFeetScr = toScreen(feetWorld);
    // + = model is ABOVE the user (smaller screen y).
    const hipErrPx = userHip ? cover(userHip).y - modelPelvisScr.y : NaN;
    const feetErrScrPx = userAnkle ? cover(userAnkle).y - modelFeetScr.y : NaN;
    if (!Number.isNaN(hipErrPx)) this.maxHipErrPx = Math.max(this.maxHipErrPx, Math.abs(hipErrPx));
    if (!Number.isNaN(feetErrScrPx)) this.maxFeetErrPx = Math.max(this.maxFeetErrPx, Math.abs(feetErrScrPx));
    const userHipDropPx = userHip && this.standingHip ? (userHip.y - this.standingHip.y) * coverFit(this.userVideoWidth, this.userVideoHeight, f.viewportW, f.viewportH).scale : NaN;

    const now = Date.now();
    if (now - this.lastLiveLog < 500 && lines.length === 0) return null;
    this.lastLiveLog = now;

    const r = (v: number, d = 0) => (Number.isNaN(v) ? 'n/a' : v.toFixed(d));
    console.log('[AlignDebug frame]', {
      t: +f.userTime.toFixed(2),
      '#1': { userIdx, refIdx: f.refIdx, userHipDropPx: r(userHipDropPx), refKneeBendDeg: r(kneeBendDeg(f.pose), 1) },
      '#3': {
        feetLiftFromPoseWorld: +feetLiftFromPose.toFixed(3),
        feetAboveGroundWorld: +feetErrWorld.toFixed(3),
        feetAboveGroundPx: r(feetUpPx),
      },
      '#4': { rawTrans: raw.toArray().map((v) => +v.toFixed(3)), clamped, transDyPx: r(transDyPx) },
      screen: { hipErrPx: r(hipErrPx), feetErrPx: r(feetErrScrPx) },
      maxAbs: { feetLiftPx: r(this.maxFeetLiftPx), hipErrPx: r(this.maxHipErrPx), feetErrPx: r(this.maxFeetErrPx) },
    });
    lines.push(
      `t ${f.userTime.toFixed(2)} uIdx ${userIdx} rIdx ${f.refIdx} uHipDrop ${r(userHipDropPx)} rKnee ${r(kneeBendDeg(f.pose))}°`,
      `#3 poseLift ${(feetLiftFromPose * ppu).toFixed(0)}px net feetUp ${r(feetUpPx)}px (max ${r(this.maxFeetLiftPx)})`,
      `#4 trans ${raw.toArray().map((v) => v.toFixed(2)).join(',')}${clamped ? ' CLAMPED' : ''} dy ${r(transDyPx)}px`,
      `scr hipErr ${r(hipErrPx)} feetErr ${r(feetErrScrPx)} (+ = model above)`
    );
    return lines;
  }
}
