import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { VideoPlayer } from 'expo-video';
import { ApiJobResult } from '../../services/apiGateway';
import { useComparisonIndex } from '../../lib/skeleton/playback';
import { formatDelta } from '../../utils/angleDeltas';
import { formatJointName } from '../../utils/jointNames';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';

function deg(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : `${Math.round(v)}°`;
}

/** Your angle, the reference's and the difference for every joint at the video's current frame. */
export default function FrameReadout({ result, player }: { result: ApiJobResult; player: VideoPlayer }) {
  const index = useComparisonIndex(result, player);
  const frame = result.form_report.frames[index];
  if (!frame) return null;

  const rows = Object.keys(result.form_report.per_joint).filter(
    (joint) => frame.user[joint] !== null || frame.ref[joint] !== null
  );

  return (
    <View>
      <View style={styles.row}>
        <Text style={[styles.head, styles.name]}>Joint</Text>
        <Text style={styles.head}>You</Text>
        <Text style={styles.head}>Ref</Text>
        <Text style={styles.head}>Diff</Text>
      </View>
      {rows.length === 0 ? (
        <Text style={styles.empty}>No joints visible in this frame</Text>
      ) : (
        rows.map((joint) => (
          <View key={joint} style={styles.row}>
            <Text style={[styles.cell, styles.name]}>{formatJointName(joint)}</Text>
            <Text style={styles.cell}>{deg(frame.user[joint])}</Text>
            <Text style={[styles.cell, styles.muted]}>{deg(frame.ref[joint])}</Text>
            <Text style={[styles.cell, styles.diff]}>{formatDelta(frame.deltas[joint])}</Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  name: { flex: 2.2, textAlign: 'left' },
  head: { flex: 1, color: colors.muted, fontSize: 11, fontFamily: font.semibold, textAlign: 'right' },
  cell: { flex: 1, color: colors.text, fontSize: 13, fontFamily: font.medium, textAlign: 'right', fontVariant: ['tabular-nums'] },
  muted: { color: colors.muted },
  diff: { fontFamily: font.bold },
  empty: { color: colors.muted, fontSize: 12.5, fontFamily: font.regular, marginTop: 6 },
});
