import React, { useMemo, useState } from 'react';
import { GestureResponderEvent, LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { VideoPlayer } from 'expo-video';
import { ApiJobResult } from '../../services/apiGateway';
import { formatTime, frameTime, seekTo, usePlaybackTime } from '../../lib/skeleton/playback';
import { formatDelta, measuredJoints } from '../../utils/angleDeltas';
import { formatJointName } from '../../utils/jointNames';
import { colors, radii } from '../../theme/colors';
import { font } from '../../theme/typography';

// Same identities as the skeletons: you in cyan, the reference in grey — plus a dash on the
// reference so the two lines never rely on colour alone.
const USER_COLOR = colors.cyan;
const REF_COLOR = colors.muted;
const REF_DASH = '6 4';

const HEIGHT = 200;
const PAD = { left: 34, right: 30, top: 10, bottom: 22 };

type Sample = { t: number; user: number | null; ref: number | null };

/** "M x y L x y ..." with a fresh M after every gap, so unmeasured frames break the line instead of
 * being bridged with a made-up straight segment. */
function linePath(samples: Sample[], key: 'user' | 'ref', x: (t: number) => number, y: (v: number) => number): string {
  let d = '';
  let pen = false;
  for (const s of samples) {
    const v = s[key];
    if (v === null) {
      pen = false;
      continue;
    }
    d += `${pen ? 'L' : 'M'}${x(s.t).toFixed(1)} ${y(v).toFixed(1)} `;
    pen = true;
  }
  return d;
}

function lastPoint(samples: Sample[], key: 'user' | 'ref'): Sample | undefined {
  for (let i = samples.length - 1; i >= 0; i--) if (samples[i][key] !== null) return samples[i];
  return undefined;
}

/** One joint's angle over the rep — yours against the reference's, synced frame for frame — with a
 * playhead that follows the video. Tap or drag on the chart to seek there. */
export default function AngleGraph({ result, player }: { result: ApiJobResult; player: VideoPlayer }) {
  const joints = useMemo(() => measuredJoints(result.form_report).map(([name]) => name), [result]);
  const [joint, setJoint] = useState<string | null>(joints[0] ?? null);
  const [width, setWidth] = useState(0);
  const time = usePlaybackTime(player, 1 / 30);

  const samples: Sample[] = useMemo(
    () =>
      joint
        ? result.form_report.frames.map((f) => ({ t: frameTime(result, f.user_frame), user: f.user[joint], ref: f.ref[joint] }))
        : [],
    [result, joint]
  );

  const chart = useMemo(() => {
    const values = samples.flatMap((s) => [s.user, s.ref]).filter((v): v is number => v !== null);
    if (width <= 0 || values.length === 0) return null;
    const step = 10;
    const lo = Math.floor((Math.min(...values) - 5) / step) * step;
    const hi = Math.ceil((Math.max(...values) + 5) / step) * step;
    const t0 = samples[0].t;
    const t1 = Math.max(samples[samples.length - 1].t, t0 + 1e-3);
    const plotW = width - PAD.left - PAD.right;
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0)) * plotW;
    const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * plotH;
    // ~4 gridlines at a round step.
    const tickStep = Math.max(step, Math.ceil((hi - lo) / 4 / step) * step);
    const yTicks: number[] = [];
    for (let v = lo; v <= hi; v += tickStep) yTicks.push(v);
    return {
      x,
      y,
      t0,
      t1,
      yTicks,
      userPath: linePath(samples, 'user', x, y),
      refPath: linePath(samples, 'ref', x, y),
      userEnd: lastPoint(samples, 'user'),
      refEnd: lastPoint(samples, 'ref'),
    };
  }, [samples, width]);

  if (!joint) {
    return <Text style={styles.empty}>No joints were measured for this rep.</Text>;
  }

  const current = samples.length
    ? samples.reduce((best, s) => (Math.abs(s.t - time) < Math.abs(best.t - time) ? s : best), samples[0])
    : null;
  const delta = current && current.user !== null && current.ref !== null ? current.user - current.ref : null;
  const bottomT = frameTime(result, result.form_report.bottom_frame);

  const seekToTouch = (e: GestureResponderEvent) => {
    if (!chart) return;
    const px = Math.min(Math.max(e.nativeEvent.locationX, PAD.left), width - PAD.right);
    seekTo(player, chart.t0 + ((px - PAD.left) / (width - PAD.left - PAD.right)) * (chart.t1 - chart.t0));
  };

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {joints.map((j) => (
          <Pressable key={j} onPress={() => setJoint(j)} style={[styles.chip, j === joint && styles.chipActive]}>
            <Text style={[styles.chipText, j === joint && styles.chipTextActive]}>{formatJointName(j)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.readout}>
        <Text style={styles.readoutTime}>{formatTime(time)}</Text>
        <View style={styles.readoutItem}>
          <View style={[styles.swatch, { backgroundColor: USER_COLOR }]} />
          <Text style={styles.readoutText}>You {current?.user != null ? `${Math.round(current.user)}°` : '—'}</Text>
        </View>
        <View style={styles.readoutItem}>
          <View style={[styles.swatch, styles.swatchDashed]} />
          <Text style={styles.readoutText}>Ref {current?.ref != null ? `${Math.round(current.ref)}°` : '—'}</Text>
        </View>
        <Text style={styles.readoutDiff}>{formatDelta(delta)}</Text>
      </View>

      <View
        style={styles.chartBox}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={seekToTouch}
        onResponderMove={seekToTouch}
      >
        {chart && (
          <Svg width={width} height={HEIGHT} pointerEvents="none">
            {chart.yTicks.map((v) => (
              <G key={v}>
                <Line x1={PAD.left} x2={width - PAD.right} y1={chart.y(v)} y2={chart.y(v)} stroke={colors.s3} strokeWidth={1} />
                <SvgText x={PAD.left - 6} y={chart.y(v) + 4} fontSize={10} fill={colors.muted} textAnchor="end">
                  {`${v}°`}
                </SvgText>
              </G>
            ))}
            <SvgText x={PAD.left} y={HEIGHT - 6} fontSize={10} fill={colors.muted}>
              {formatTime(chart.t0)}
            </SvgText>
            <SvgText x={width - PAD.right} y={HEIGHT - 6} fontSize={10} fill={colors.muted} textAnchor="end">
              {formatTime(chart.t1)}
            </SvgText>

            <Line
              x1={chart.x(bottomT)}
              x2={chart.x(bottomT)}
              y1={PAD.top}
              y2={HEIGHT - PAD.bottom}
              stroke={colors.mutedDim}
              strokeWidth={1}
              strokeDasharray="2 3"
            />
            <SvgText x={chart.x(bottomT)} y={HEIGHT - 6} fontSize={10} fill={colors.muted} textAnchor="middle">
              bottom
            </SvgText>

            <Path d={chart.refPath} stroke={REF_COLOR} strokeWidth={2} strokeDasharray={REF_DASH} fill="none" strokeLinejoin="round" />
            <Path d={chart.userPath} stroke={USER_COLOR} strokeWidth={2} fill="none" strokeLinejoin="round" />
            {chart.refEnd && (
              <SvgText x={chart.x(chart.refEnd.t) + 4} y={chart.y(chart.refEnd.ref!) + 4} fontSize={10} fill={colors.muted}>
                Ref
              </SvgText>
            )}
            {chart.userEnd && (
              <SvgText x={chart.x(chart.userEnd.t) + 4} y={chart.y(chart.userEnd.user!) + 4} fontSize={10} fill={colors.text}>
                You
              </SvgText>
            )}

            {current && (
              <G>
                <Line x1={chart.x(current.t)} x2={chart.x(current.t)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke={colors.text} strokeWidth={1} />
                {current.ref !== null && (
                  <Circle cx={chart.x(current.t)} cy={chart.y(current.ref)} r={4.5} fill={REF_COLOR} stroke={colors.s1} strokeWidth={2} />
                )}
                {current.user !== null && (
                  <Circle cx={chart.x(current.t)} cy={chart.y(current.user)} r={4.5} fill={USER_COLOR} stroke={colors.s1} strokeWidth={2} />
                )}
              </G>
            )}
          </Svg>
        )}
      </View>
      <Text style={styles.caption}>Tap or drag on the chart to jump the video there.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { gap: 6, paddingBottom: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: colors.s2 },
  chipActive: { backgroundColor: colors.s3 },
  chipText: { color: colors.muted, fontSize: 12, fontFamily: font.semibold },
  chipTextActive: { color: colors.text },
  readout: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  readoutTime: { color: colors.muted, fontSize: 12, fontFamily: font.medium, fontVariant: ['tabular-nums'] },
  readoutItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 14, height: 2, borderRadius: 1 },
  swatchDashed: { borderTopWidth: 2, borderStyle: 'dashed', borderColor: REF_COLOR, height: 0 },
  readoutText: { color: colors.text, fontSize: 12.5, fontFamily: font.medium, fontVariant: ['tabular-nums'] },
  readoutDiff: { marginLeft: 'auto', color: colors.text, fontSize: 13, fontFamily: font.bold, fontVariant: ['tabular-nums'] },
  chartBox: { height: HEIGHT, backgroundColor: colors.s1, borderRadius: 14 },
  caption: { color: colors.mutedDim, fontSize: 11, fontFamily: font.regular, marginTop: 6 },
  empty: { color: colors.muted, fontSize: 12.5, fontFamily: font.regular, marginTop: 8 },
});
