import { ApiFormReport, ApiJointDelta } from '../services/apiGateway';
import { formatJointName } from './jointNames';

/** Signed whole degrees, e.g. "+12°" / "−8°" / "0°". */
export function formatDelta(deg: number | null | undefined): string {
  if (deg === null || deg === undefined) return '—';
  const rounded = Math.round(deg);
  if (rounded === 0) return '0°';
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)}°`;
}

/** Joints that were actually measured, largest difference first (the backend already orders them). */
export function measuredJoints(report: ApiFormReport): [string, ApiJointDelta][] {
  return Object.entries(report.per_joint).filter(([, j]) => j.max_delta !== null);
}

/** The single biggest difference in a report, e.g. { joint: 'Knee', value: '−12°' }, or null. */
export function biggestDifference(report: ApiFormReport): { joint: string; value: string } | null {
  const top = measuredJoints(report)[0];
  return top ? { joint: formatJointName(top[0]), value: formatDelta(top[1].max_delta) } : null;
}

/** Short one-line summary of the top differences, e.g. "Knee −12°, Hip +8°, Trunk +5°". */
export function summarizeDifferences(report: ApiFormReport, count = 3): string {
  const top = measuredJoints(report).slice(0, count);
  if (top.length === 0) return 'no joints measured';
  return top.map(([name, j]) => `${formatJointName(name)} ${formatDelta(j.max_delta)}`).join(', ');
}
