import React from 'react';
import { Circle, G, Line } from 'react-native-svg';
import { Joints } from './joints';

interface Props {
  joints: Joints;
  fill?: string;
}

/** Solid silhouette of a lifter mid-squat with a barbell, sitting behind the skeleton overlay. */
export default function LifterSilhouette({ joints: j, fill = '#3B424D' }: Props) {
  return (
    <G>
      <Line x1={j.he[0]} y1={j.he[1]} x2={j.to[0]} y2={j.to[1]} stroke={fill} strokeWidth={16} strokeLinecap="round" />
      <Line x1={j.kn[0]} y1={j.kn[1]} x2={j.an[0]} y2={j.an[1]} stroke={fill} strokeWidth={30} strokeLinecap="round" />
      <Line x1={j.hip[0]} y1={j.hip[1]} x2={j.kn[0]} y2={j.kn[1]} stroke={fill} strokeWidth={40} strokeLinecap="round" />
      <Line x1={j.sh[0]} y1={j.sh[1]} x2={j.hip[0]} y2={j.hip[1]} stroke={fill} strokeWidth={50} strokeLinecap="round" />
      <Circle cx={j.hip[0]} cy={j.hip[1]} r={26} fill={fill} />
      <Line x1={j.sh[0]} y1={j.sh[1]} x2={j.el[0]} y2={j.el[1]} stroke={fill} strokeWidth={20} strokeLinecap="round" />
      <Line x1={j.el[0]} y1={j.el[1]} x2={j.wr[0]} y2={j.wr[1]} stroke={fill} strokeWidth={16} strokeLinecap="round" />
      <Circle cx={j.head[0]} cy={j.head[1]} r={23} fill={fill} />
      <Circle cx={j.sh[0] - 4} cy={j.sh[1] - 8} r={44} fill="none" stroke="#2A2F37" strokeWidth={12} />
      <Circle cx={j.sh[0] - 4} cy={j.sh[1] - 8} r={7} fill="#59616D" />
    </G>
  );
}
