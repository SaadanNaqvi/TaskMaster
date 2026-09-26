import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
}

const common = { fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function TrainIcon({ size = 22, color = '#8A93A0' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...common} stroke={color} strokeWidth={2}>
      <Path d="M4 12h3v-4h2v8h2V6h2v12h2v-8h2v4h3" />
    </Svg>
  );
}

export function HistoryIcon({ size = 22, color = '#8A93A0' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...common} stroke={color} strokeWidth={2}>
      <Circle cx="12" cy="12" r="8" />
      <Path d="M12 8v4l3 2" />
    </Svg>
  );
}

export function FormMapIcon({ size = 22, color = '#8A93A0' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...common} stroke={color} strokeWidth={2}>
      <Path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
      <Path d="M9 4v14M15 6v14" />
    </Svg>
  );
}

export function ProfileIcon({ size = 22, color = '#8A93A0' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...common} stroke={color} strokeWidth={2}>
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
    </Svg>
  );
}
