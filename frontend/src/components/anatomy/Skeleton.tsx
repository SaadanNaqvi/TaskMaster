import React from 'react';
import { Circle, G, Line } from 'react-native-svg';
import { BONES, JointKey, Joints } from './joints';

interface Props {
  joints: Joints;
  color: string;
  strokeWidth?: number;
  glow?: boolean;
  opacity?: number;
}

const DOT_ORDER: JointKey[] = ['sh', 'el', 'wr', 'hip', 'kn', 'an', 'to', 'he'];

/** Bone-and-joint stick figure. Draws a soft low-opacity duplicate underneath for a glow look
 * (react-native-svg doesn't render feGaussianBlur filters reliably on native). */
export default function Skeleton({ joints, color, strokeWidth = 4, glow = true, opacity = 1 }: Props) {
  return (
    <G opacity={opacity}>
      {glow && (
        <G opacity={0.28}>
          {BONES.map(([a, b], i) => (
            <Line
              key={`glow-${i}`}
              x1={joints[a][0]}
              y1={joints[a][1]}
              x2={joints[b][0]}
              y2={joints[b][1]}
              stroke={color}
              strokeWidth={strokeWidth + 7}
              strokeLinecap="round"
            />
          ))}
          <Line
            x1={joints.sh[0]}
            y1={joints.sh[1]}
            x2={joints.head[0]}
            y2={joints.head[1]}
            stroke={color}
            strokeWidth={strokeWidth + 7}
            strokeLinecap="round"
          />
        </G>
      )}
      <G>
        {BONES.map(([a, b], i) => (
          <Line
            key={`bone-${i}`}
            x1={joints[a][0]}
            y1={joints[a][1]}
            x2={joints[b][0]}
            y2={joints[b][1]}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        ))}
        <Line
          x1={joints.sh[0]}
          y1={joints.sh[1]}
          x2={joints.head[0]}
          y2={joints.head[1]}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {DOT_ORDER.map((k) => (
          <Circle
            key={k}
            cx={joints[k][0]}
            cy={joints[k][1]}
            r={strokeWidth + 1.5}
            fill="#0B0D10"
            stroke={color}
            strokeWidth={strokeWidth - 1}
          />
        ))}
        <Circle
          cx={joints.head[0]}
          cy={joints.head[1]}
          r={strokeWidth + 4}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth - 1}
        />
      </G>
    </G>
  );
}
