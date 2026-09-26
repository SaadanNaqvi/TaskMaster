import React from 'react';
import { Defs, G, Line, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

interface Props {
  width?: number;
  height?: number;
  id?: string;
}

/** Squat-rack gym backdrop: wall gradient, spotlight, rack posts, floor line. */
export default function GymBackdrop({ width = 360, height = 480, id = 'gym' }: Props) {
  const floorY = height * 0.78;
  const pegs = Array.from({ length: 8 }, (_, i) => 80 + i * (height / 12.6));
  return (
    <G>
      <Defs>
        <LinearGradient id={`${id}-wall`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#20252C" />
          <Stop offset="0.78" stopColor="#15181D" />
          <Stop offset="0.781" stopColor="#0F1115" />
          <Stop offset="1" stopColor="#0A0B0E" />
        </LinearGradient>
        <RadialGradient id={`${id}-spot`} cx="0.55" cy="0.35" r="0.6">
          <Stop offset="0" stopColor="#ffffff" stopOpacity={0.07} />
          <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={width} height={height} fill={`url(#${id}-wall)`} />
      <Rect width={width} height={height} fill={`url(#${id}-spot)`} />
      <Rect x={width * 0.117} y={40} width={10} height={floorY - 40} fill="#262B33" />
      <Rect x={width * 0.833} y={40} width={10} height={floorY - 40} fill="#262B33" />
      <Rect x={width * 0.1} y={40} width={width * 0.78} height={8} fill="#262B33" />
      {pegs.map((y, i) => (
        <G key={i}>
          <Rect x={width * 0.13} y={y} width={3} height={6} fill="#343a44" />
          <Rect x={width * 0.847} y={y} width={3} height={6} fill="#343a44" />
        </G>
      ))}
      <Line x1={0} y1={floorY} x2={width} y2={floorY} stroke="#2c323b" strokeWidth={1} />
    </G>
  );
}
