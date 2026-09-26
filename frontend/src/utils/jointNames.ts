import { JointKey } from '../components/anatomy/joints';

/** Backend joint ids look like "knee_l" / "hip_r" — turn that into "Knee (left)". */
export function formatJointName(id: string): string {
  const match = id.match(/^(.*)_(l|r)$/);
  const base = match ? match[1] : id;
  const side = match ? (match[2] === 'l' ? 'left' : 'right') : null;
  const label = base
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return side ? `${label} (${side})` : label;
}

/** Maps an open-ended backend joint id onto the fixed set of points our 2D stick figure can draw. */
export function jointNameToKey(id: string): JointKey {
  const key = id.toLowerCase();
  if (key.includes('shoulder')) return 'sh';
  if (key.includes('elbow')) return 'el';
  if (key.includes('wrist') || key.includes('hand')) return 'wr';
  if (key.includes('hip')) return 'hip';
  if (key.includes('knee')) return 'kn';
  if (key.includes('ankle')) return 'an';
  if (key.includes('heel')) return 'he';
  if (key.includes('toe') || key.includes('foot')) return 'to';
  return 'head';
}
