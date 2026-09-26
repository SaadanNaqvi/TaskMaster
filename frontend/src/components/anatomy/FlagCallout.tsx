import React from 'react';
import { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { Point } from './joints';

interface Props {
  point: Point;
  label: string;
  dx: number;
  dy: number;
  color?: string;
}

/** Red flag pin + leader line + label pill, anchored to a joint — used on the results overlay. */
export default function FlagCallout({ point: [x, y], label, dx, dy, color = '#FF5A5F' }: Props) {
  const pillWidth = Math.max(74, label.length * 7.6);
  const pillX = x + dx - (dx < 0 ? pillWidth : 0);
  return (
    <G>
      <Circle cx={x} cy={y} r={15} fill={`${color}2E`} stroke={color} strokeWidth={2.5} />
      <Line x1={x} y1={y} x2={x + dx} y2={y + dy} stroke={color} strokeWidth={1.5} />
      <Rect x={pillX} y={y + dy - 13} width={pillWidth} height={26} rx={13} fill={color} />
      <SvgText
        x={pillX + pillWidth / 2}
        y={y + dy + 4.5}
        fontSize={12}
        fontWeight="700"
        fill="#fff"
        textAnchor="middle"
      >
        {label}
      </SvgText>
    </G>
  );
}
