import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Exercise } from '../../models/exercise';

interface IconProps {
  size?: number;
  color?: string;
}

const common = {
  fill: 'none',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function SquatIcon({ size = 26, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" {...common} stroke={color} strokeWidth={2.4}>
      <Path d="M4 11h32" />
      <Rect x="5" y="6" width="4" height="10" rx="1" />
      <Rect x="31" y="6" width="4" height="10" rx="1" />
      <Circle cx="21" cy="6" r="2.5" />
      <Path d="M20 11 L15 22 L25 25 L21 35 M15 22 L12 35" />
    </Svg>
  );
}

export function BenchIcon({ size = 26, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" {...common} stroke={color} strokeWidth={2.4}>
      <Path d="M4 28h32" />
      <Path d="M10 28v7M30 28v7" />
      <Circle cx="31" cy="23" r="2.5" />
      <Path d="M28 24 L12 24 L8 30" />
      <Path d="M20 24v-12" />
      <Path d="M8 12h24" />
      <Rect x="5" y="8" width="4" height="8" rx="1" />
      <Rect x="31" y="8" width="4" height="8" rx="1" />
    </Svg>
  );
}

export function DeadliftIcon({ size = 26, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" {...common} stroke={color} strokeWidth={2.4}>
      <Circle cx="24" cy="6" r="2.5" />
      <Path d="M22 10 L14 20 L20 26 L18 35 M14 20 L22 28 L26 35 M20 14 L22 30" />
      <Path d="M4 31h32" />
      <Circle cx="7" cy="31" r="5" />
      <Circle cx="33" cy="31" r="5" />
    </Svg>
  );
}

export function LatPulldownIcon({ size = 26, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" {...common} stroke={color} strokeWidth={2.4}>
      <Path d="M20 2v5" />
      <Path d="M7 7h26" />
      <Path d="M9 7 L13 16 L20 18 L27 16 L31 7" />
      <Circle cx="20" cy="13" r="2.5" />
      <Path d="M20 18 L20 27 L28 28 L28 36" />
      <Path d="M10 28h20" />
    </Svg>
  );
}

export const EXERCISE_ICONS: Record<Exercise, React.FC<IconProps>> = {
  Squat: SquatIcon,
  'Bench Press': BenchIcon,
  Deadlift: DeadliftIcon,
  'Lat Pulldown': LatPulldownIcon,
};

export const EXERCISE_ACCENTS: Record<Exercise, string> = {
  Squat: '#C8F53C',
  'Bench Press': '#5AC8FA',
  Deadlift: '#FFB547',
  'Lat Pulldown': '#B18CFF',
};
