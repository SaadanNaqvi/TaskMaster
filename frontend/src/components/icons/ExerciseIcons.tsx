import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
}

const common = {
  fill: 'none',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** Shared barbell glyph — bar + plates — reused across icons so the whole set reads as one family. */
function Barbell({ y }: { y: number }) {
  return (
    <G>
      <Path d={`M8 ${y}h24`} />
      <Rect x="4" y={y - 6} width="6" height="12" rx="2" />
      <Rect x="30" y={y - 6} width="6" height="12" rx="2" />
    </G>
  );
}

/** Deliberately simple: one recognisable motif per lift instead of a tiny illegible figure —
 * these render as small as 22px so every shape has to survive heavy downscaling. */
export function SquatIcon({ size = 26, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" {...common} stroke={color} strokeWidth={3.2}>
      <Barbell y={13} />
      <Path d="M13 24 L20 33 L27 24" />
    </Svg>
  );
}

export function BenchIcon({ size = 26, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" {...common} stroke={color} strokeWidth={3.2}>
      <Barbell y={11} />
      <Path d="M7 29h26" />
      <Path d="M11 29v6M29 29v6" />
    </Svg>
  );
}

export function DeadliftIcon({ size = 26, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" {...common} stroke={color} strokeWidth={3.2}>
      <Path d="M13 16 L20 7 L27 16" />
      <Barbell y={29} />
    </Svg>
  );
}

export function LatPulldownIcon({ size = 26, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" {...common} stroke={color} strokeWidth={3.2}>
      <Circle cx="20" cy="7" r="3" />
      <Path d="M20 10v8" />
      <Path d="M9 26 L20 18 L31 26" />
    </Svg>
  );
}

export function DumbbellIcon({ size = 26, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" {...common} stroke={color} strokeWidth={3.2}>
      <Path d="M11 20h18" />
      <Rect x="4" y="14" width="6" height="12" rx="2" />
      <Rect x="30" y="14" width="6" height="12" rx="2" />
    </Svg>
  );
}

/** Backend exercise ids are open-ended snake_case slugs — match by substring with a generic fallback
 * so new exercises the API adds later still render sensibly without a code change. */
export function getExerciseIcon(id: string): React.FC<IconProps> {
  const key = id.toLowerCase();
  if (key.includes('squat')) return SquatIcon;
  if (key.includes('bench')) return BenchIcon;
  if (key.includes('dead')) return DeadliftIcon;
  if (key.includes('lat') || key.includes('pulldown')) return LatPulldownIcon;
  return DumbbellIcon;
}

export function getExerciseAccent(id: string): string {
  const key = id.toLowerCase();
  if (key.includes('squat')) return '#C8F53C';
  if (key.includes('bench')) return '#5AC8FA';
  if (key.includes('dead')) return '#FFB547';
  if (key.includes('lat') || key.includes('pulldown')) return '#B18CFF';
  return '#8A93A0';
}
