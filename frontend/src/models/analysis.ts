import { Exercise } from './exercise';
import { JointKey } from '../components/anatomy/joints';
import { ReferenceOption } from './reference';

export type Severity = 'red' | 'amber' | 'lime';

export interface FormFlag {
  time: string;
  joint: string;
  jointKey: JointKey;
  degrees: number;
  message: string;
  severity: Severity;
}

export interface JointDeviation {
  name: string;
  jointKey: JointKey;
  degrees: number;
  severity: Severity;
  reps: string;
}

export interface AnalysisResult {
  id: string;
  exercise: Exercise;
  reference: ReferenceOption;
  createdAt: string;
  overallScore: number;
  repCount: number;
  tempoMatched: boolean;
  flags: FormFlag[];
  deviations: JointDeviation[];
  scoreByRep: number[];
}

/** Deterministic string hash -> seeded PRNG, so the same clip+reference always analyses the same way. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h;
}

function severityFor(degrees: number): Severity {
  if (degrees >= 11) return 'red';
  if (degrees >= 5) return 'amber';
  return 'lime';
}

const TRACKED_POINTS: Record<Exercise, { name: string; jointKey: JointKey; joint: string }[]> = {
  Squat: [
    { name: 'Hip depth', jointKey: 'hip', joint: 'Hip' },
    { name: 'Torso angle', jointKey: 'sh', joint: 'Torso' },
    { name: 'Knee travel', jointKey: 'kn', joint: 'Knee' },
    { name: 'Ankle', jointKey: 'an', joint: 'Ankle' },
  ],
  'Bench Press': [
    { name: 'Bar path', jointKey: 'wr', joint: 'Bar path' },
    { name: 'Elbow flare', jointKey: 'el', joint: 'Elbow' },
    { name: 'Shoulder position', jointKey: 'sh', joint: 'Shoulder' },
    { name: 'Leg drive', jointKey: 'kn', joint: 'Leg drive' },
  ],
  Deadlift: [
    { name: 'Hip hinge', jointKey: 'hip', joint: 'Hip' },
    { name: 'Back rounding', jointKey: 'sh', joint: 'Back' },
    { name: 'Bar path', jointKey: 'wr', joint: 'Bar path' },
    { name: 'Knee lockout', jointKey: 'kn', joint: 'Knee' },
  ],
  'Lat Pulldown': [
    { name: 'Torso lean', jointKey: 'sh', joint: 'Torso' },
    { name: 'Elbow path', jointKey: 'el', joint: 'Elbow' },
    { name: 'Pulldown depth', jointKey: 'wr', joint: 'Bar depth' },
    { name: 'Head position', jointKey: 'head', joint: 'Head' },
  ],
};

const FLAG_MESSAGES: Record<string, (deg: number, refName: string) => string> = {
  'Hip depth': (deg) => `Squat is ${deg}° shallow — sit hips below knee`,
  'Torso angle': (deg, ref) => `Leaning ${deg}° further forward than ${ref}`,
  'Knee travel': (deg) => `Knee drift ${deg >= 5 ? `${deg}° past toe` : 'OK · within 5°'}`,
  Ankle: (deg) => `Ankle collapse ${deg}° — brace the arch`,
  'Bar path': (deg) => `Bar drifts ${deg}° off the vertical path`,
  'Elbow flare': (deg) => `Elbows flare ${deg}° wider than reference`,
  'Shoulder position': (deg) => `Shoulders shift ${deg}° off the bench`,
  'Leg drive': (deg) => `Leg drive timing off by ${deg}°`,
  'Hip hinge': (deg) => `Hips rise ${deg}° early — keep chest and hips together`,
  'Back rounding': (deg) => `Upper back rounds ${deg}° at the pull`,
  'Knee lockout': (deg) => `Knee lockout ${deg}° late vs reference`,
  'Torso lean': (deg) => `Leaning back ${deg}° more than reference`,
  'Elbow path': (deg) => `Elbows drift ${deg}° forward of the torso`,
  'Pulldown depth': (deg) => `Bar stops ${deg}° short of target depth`,
  'Head position': (deg) => `Head juts forward ${deg}°`,
};

export function generateMockAnalysis(
  exercise: Exercise,
  reference: ReferenceOption,
  seedKey: string
): AnalysisResult {
  const rng = mulberry32(hashSeed(`${exercise}:${reference.id}:${seedKey}`));
  const points = TRACKED_POINTS[exercise];
  const repCount = 3 + Math.floor(rng() * 3); // 3-5

  const deviations: JointDeviation[] = points.map((p, i) => {
    const degrees = i === 0 ? 6 + Math.floor(rng() * 10) : Math.floor(rng() * 15);
    const repsHit = Array.from({ length: repCount }, (_, r) => r + 1).filter(() => rng() > 0.55);
    return {
      name: p.name,
      jointKey: p.jointKey,
      degrees,
      severity: severityFor(degrees),
      reps: repsHit.length ? `reps ${repsHit.join(', ')}` : '—',
    };
  });

  const worst = [...deviations].sort((a, b) => b.degrees - a.degrees).slice(0, 2);
  const rest = deviations.filter((d) => !worst.includes(d)).slice(0, 1);
  const toFlag = (d: JointDeviation): FormFlag => ({
    time: `0:0${2 + Math.floor(rng() * 6)}`,
    joint: points.find((p) => p.name === d.name)!.joint,
    jointKey: d.jointKey,
    degrees: d.degrees,
    message: FLAG_MESSAGES[d.name](d.degrees, reference.name),
    severity: d.severity,
  });
  const flags: FormFlag[] = [...worst.map(toFlag), ...rest.map(toFlag)];

  const penalty = deviations.reduce((sum, d) => sum + d.degrees, 0);
  const overallScore = Math.max(38, Math.min(96, Math.round(94 - penalty * 1.3)));

  const scoreByRep = Array.from({ length: repCount }, () => {
    const jitter = Math.floor(rng() * 24) - 12;
    return Math.max(35, Math.min(97, overallScore + jitter));
  });

  return {
    id: `${exercise}-${reference.id}-${seedKey}`,
    exercise,
    reference,
    createdAt: new Date().toISOString(),
    overallScore,
    repCount,
    tempoMatched: rng() > 0.35,
    flags,
    deviations,
    scoreByRep,
  };
}
