import React, { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';
import { VideoPlayer } from 'expo-video';
import { ApiJobResult } from '../../services/apiGateway';
import { coverFitPoint } from '../../lib/smpl/align';
import { Bone, jointPoint, median, Pt, refToUserSpace, skeletonBones } from '../../lib/skeleton/geometry';
import { formatDelta } from '../../utils/angleDeltas';
import { colors } from '../../theme/colors';

const USER_COLOR = colors.cyan;
const REF_COLOR = colors.muted;
/** The side facing away from the camera is drawn fainter — angles are only measured on the near side. */
const FAR_OPACITY = 0.45;

interface Props {
  result: ApiJobResult;
  player: VideoPlayer;
}

/** Index into result.alignment / form_report.frames for the video's current playback position.
 * Polls currentTime once per animation frame (same as Smpl3DOverlay) rather than relying on
 * timeUpdate events, so seeks while paused are picked up too; only re-renders when the index moves. */
function useComparisonIndex(result: ApiJobResult, player: VideoPlayer): number {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const count = result.alignment.length;
    const first = result.alignment[0]?.user_frame ?? 0;
    const fps = result.user_pose.fps;
    let raf = 0;
    const tick = () => {
      const userFrame = Math.round((player.currentTime ?? 0) * fps);
      setIndex(Math.min(Math.max(userFrame - first, 0), Math.max(count - 1, 0)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [result, player]);
  return index;
}

function useSize() {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev && prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  };
  return { size, onLayout };
}

function Figure({ bones, color, width }: { bones: Bone[]; color: string; width: number }) {
  return (
    <G>
      {bones.map(({ a, b, far }, i) => (
        <G key={i} opacity={far ? FAR_OPACITY : 1}>
          <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={width} strokeLinecap="round" />
          <Circle cx={a.x} cy={a.y} r={width * 0.9} fill={color} />
          <Circle cx={b.x} cy={b.y} r={width * 0.9} fill={color} />
        </G>
      ))}
    </G>
  );
}

/** Signed degree labels, outlined so they stay legible over video. */
function DeltaLabels({ labels }: { labels: { key: string; at: Pt; text: string }[] }) {
  return (
    <G>
      {labels.map(({ key, at, text }) => (
        <G key={key}>
          <SvgText x={at.x + 10} y={at.y + 4} fontSize={13} fontWeight="bold" stroke={colors.bg} strokeWidth={4} fill={colors.bg}>
            {text}
          </SvgText>
          <SvgText x={at.x + 10} y={at.y + 4} fontSize={13} fontWeight="bold" fill={colors.text}>
            {text}
          </SvgText>
        </G>
      ))}
    </G>
  );
}

function labelsFor(result: ApiJobResult, index: number, map: (p: Pt) => Pt) {
  const frame = result.form_report.frames[index];
  const userFrame = result.user_pose.frames[frame?.user_frame ?? 0];
  const labels: { key: string; at: Pt; text: string }[] = [];
  for (const [joint, delta] of Object.entries(frame?.deltas ?? {})) {
    if (delta === null) continue;
    const at = jointPoint(userFrame, joint, result.form_report.user_side);
    if (at) labels.push({ key: joint, at: map(at), text: formatDelta(delta) });
  }
  return labels;
}

/** Both skeletons drawn over the user's video (which must be shown with contentFit="cover"),
 * the reference laid onto the user via the backend's per-frame alignment. */
export function SkeletonOverlay({ result, player }: Props) {
  const { size, onLayout } = useSize();
  const index = useComparisonIndex(result, player);
  const a = result.alignment[index];

  let content = null;
  if (size && a) {
    const { width: vw, height: vh } = result.user_pose;
    const toScreen = (p: Pt) => coverFitPoint(p, vw, vh, size.w, size.h);
    const userBones = skeletonBones(result.user_pose.frames[a.user_frame], result.form_report.user_side, toScreen);
    const refBones = skeletonBones(result.ref_pose.frames[a.ref_frame], result.form_report.ref_side, (p) =>
      toScreen(refToUserSpace(p, a))
    );
    content = (
      <Svg width={size.w} height={size.h}>
        <Figure bones={refBones} color={REF_COLOR} width={4} />
        <Figure bones={userBones} color={USER_COLOR} width={4} />
        <DeltaLabels labels={labelsFor(result, index, toScreen)} />
      </Svg>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      {content}
    </View>
  );
}

/** The two skeletons next to each other on a plain background, at the same scale and facing the
 * same way. Each moves relative to its own clip-wide median hip, so the squat's motion reads
 * naturally instead of the hips being pinned in place. */
export function SkeletonSideBySide({ result, player }: Props) {
  const { size, onLayout } = useSize();
  const index = useComparisonIndex(result, player);
  const { alignment, user_pose, ref_pose, form_report } = result;

  // Clip-wide origins and extents, so the fit doesn't jump from frame to frame.
  const layout = useMemo(() => {
    if (alignment.length === 0) return null;
    const userOrigin = { x: median(alignment.map((a) => a.anchor[0])), y: median(alignment.map((a) => a.anchor[1])) };
    const refOrigin = { x: median(alignment.map((a) => a.ref_anchor[0])), y: median(alignment.map((a) => a.ref_anchor[1])) };
    const { scale, mirror } = alignment[0];
    const userRel = (p: Pt): Pt => ({ x: p.x - userOrigin.x, y: p.y - userOrigin.y });
    const refRel = (p: Pt): Pt => ({ x: (p.x - refOrigin.x) * scale * (mirror ? -1 : 1), y: (p.y - refOrigin.y) * scale });

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const grow = (p: Pt) => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
      return p;
    };
    for (const a of alignment) {
      skeletonBones(user_pose.frames[a.user_frame], form_report.user_side, (p) => grow(userRel(p)));
      skeletonBones(ref_pose.frames[a.ref_frame], form_report.ref_side, (p) => grow(refRel(p)));
    }
    if (!Number.isFinite(minX)) return null;
    return { userRel, refRel, minX, maxX, minY, maxY };
  }, [alignment, user_pose, ref_pose, form_report]);

  const a = alignment[index];
  let content = null;
  if (size && layout && a) {
    const { userRel, refRel, minX, maxX, minY, maxY } = layout;
    const half = size.w / 2;
    const fit = 0.85 * Math.min(half / Math.max(maxX - minX, 1), size.h / Math.max(maxY - minY, 1));
    const place = (centerX: number) => (p: Pt): Pt => ({
      x: centerX + (p.x - (minX + maxX) / 2) * fit,
      y: size.h / 2 + (p.y - (minY + maxY) / 2) * fit,
    });
    const userMap = (p: Pt) => place(half / 2)(userRel(p));
    const refMap = (p: Pt) => place(half + half / 2)(refRel(p));
    content = (
      <Svg width={size.w} height={size.h}>
        <Figure bones={skeletonBones(user_pose.frames[a.user_frame], form_report.user_side, userMap)} color={USER_COLOR} width={3.5} />
        <Figure bones={skeletonBones(ref_pose.frames[a.ref_frame], form_report.ref_side, refMap)} color={REF_COLOR} width={3.5} />
        <DeltaLabels labels={labelsFor(result, index, userMap)} />
      </Svg>
    );
  }

  return (
    <View style={styles.panel} onLayout={onLayout}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { height: 260, backgroundColor: colors.s1, borderRadius: 16, overflow: 'hidden' },
});
