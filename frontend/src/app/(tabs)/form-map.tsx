import React from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Card from '../../components/ui/Card';
import Chip from '../../components/ui/Chip';
import PrimaryButton from '../../components/ui/PrimaryButton';
import LifterSilhouette from '../../components/anatomy/LifterSilhouette';
import Skeleton from '../../components/anatomy/Skeleton';
import { FormMapIcon } from '../../components/icons/TabIcons';
import { USER_JOINTS } from '../../components/anatomy/joints';
import { useAnalysis } from '../../state/AnalysisContext';
import { formatJointName, jointNameToKey } from '../../utils/jointNames';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';

function severityColor(degrees: number): string {
  if (degrees >= 10) return colors.red;
  if (degrees >= 5) return colors.amber;
  return colors.lime;
}

function severityRadius(degrees: number): number {
  if (degrees >= 10) return 34;
  if (degrees >= 5) return 24;
  return 0;
}

export default function FormMapScreen() {
  const router = useRouter();
  const { lastJob } = useAnalysis();

  const perJoint = lastJob ? Object.entries(lastJob.result.form_report.per_joint) : [];

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title="Form Map"
        right={lastJob ? <Chip>{Math.round(lastJob.result.form_report.score)}</Chip> : <View style={{ width: 38 }} />}
      />

      {!lastJob ? (
        <View style={styles.empty}>
          <FormMapIcon size={40} color={colors.mutedDim} />
          <Text style={styles.emptyTitle}>No analysis yet</Text>
          <Text style={styles.emptyBody}>Complete a form check from the Train tab to see where your form breaks down, joint by joint.</Text>
          <PrimaryButton label="Start a check" onPress={() => router.push('/(tabs)')} style={{ marginTop: 20, minWidth: 200 }} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.pad} showsVerticalScrollIndicator={false}>
          <Text style={styles.subtitle}>{lastJob.exerciseName} vs {lastJob.referenceName}</Text>
          <Card style={styles.heatCard}>
            <Svg viewBox="70 110 230 350" width="100%" height={280}>
              <LifterSilhouette joints={USER_JOINTS} fill="#1E232A" />
              {perJoint.map(([name, dev]) => {
                const r = severityRadius(dev.max_diff_deg);
                if (!r) return null;
                const [x, y] = USER_JOINTS[jointNameToKey(name)];
                return <Circle key={`glow-${name}`} cx={x} cy={y} r={r} fill={severityColor(dev.max_diff_deg)} opacity={0.25} />;
              })}
              <Skeleton joints={USER_JOINTS} color={colors.mutedDim} strokeWidth={3} glow={false} />
              {perJoint.map(([name, dev]) => {
                const [x, y] = USER_JOINTS[jointNameToKey(name)];
                return (
                  <Circle
                    key={`dot-${name}`}
                    cx={x}
                    cy={y}
                    r={7}
                    fill={severityColor(dev.max_diff_deg)}
                    stroke={colors.bg}
                    strokeWidth={2}
                  />
                );
              })}
            </Svg>
            <View style={styles.legend}>
              <View style={styles.legendRow}><View style={[styles.dot, { backgroundColor: colors.red }]} /><Text style={styles.legendText}>Needs work</Text></View>
              <View style={styles.legendRow}><View style={[styles.dot, { backgroundColor: colors.amber }]} /><Text style={styles.legendText}>Watch</Text></View>
              <View style={styles.legendRow}><View style={[styles.dot, { backgroundColor: colors.lime }]} /><Text style={styles.legendText}>Matches pro</Text></View>
            </View>
          </Card>

          <Text style={styles.sectionTitle}>Max deviation vs {lastJob.referenceName}</Text>
          {perJoint.length === 0 ? (
            <Text style={styles.emptyText}>No per-joint data returned for this job.</Text>
          ) : (
            perJoint
              .sort((a, b) => b[1].max_diff_deg - a[1].max_diff_deg)
              .map(([name, dev]) => (
                <View key={name} style={styles.devRow}>
                  <View style={styles.devLabelRow}>
                    <Text style={styles.devName}>{formatJointName(name)}</Text>
                    <Text style={styles.devValue}>
                      <Text style={{ color: severityColor(dev.max_diff_deg), fontFamily: font.bold }}>{dev.max_diff_deg}°</Text>
                      <Text style={styles.devReps}> · {dev.frames_flagged.length} frame{dev.frames_flagged.length === 1 ? '' : 's'} flagged</Text>
                    </Text>
                  </View>
                  <View style={styles.devTrack}>
                    <View style={[styles.devFill, { width: `${Math.min(100, (dev.max_diff_deg / 16) * 100)}%`, backgroundColor: severityColor(dev.max_diff_deg) }]} />
                  </View>
                </View>
              ))
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  emptyTitle: { color: colors.text, fontSize: 16, fontFamily: font.bold, marginTop: 14 },
  emptyBody: { color: colors.muted, fontSize: 13, fontFamily: font.regular, textAlign: 'center', marginTop: 8, lineHeight: 19 },
  pad: { paddingHorizontal: 20, paddingBottom: 40 },
  subtitle: { color: colors.muted, fontSize: 12.5, fontFamily: font.medium, marginBottom: 10 },
  heatCard: { padding: 12, overflow: 'hidden' },
  legend: { position: 'absolute', right: 12, bottom: 12, gap: 5 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: colors.text, fontSize: 11.5, fontFamily: font.medium },
  sectionTitle: { color: colors.text, fontSize: 16, fontFamily: font.bold, marginTop: 20, marginBottom: 4 },
  emptyText: { color: colors.muted, fontSize: 12.5, fontFamily: font.regular, marginTop: 8 },
  devRow: { marginTop: 12 },
  devLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  devName: { color: colors.text, fontSize: 13, fontFamily: font.bold },
  devValue: { fontSize: 12.5 },
  devReps: { color: colors.muted, fontFamily: font.medium },
  devTrack: { height: 6, backgroundColor: colors.s2, borderRadius: 3, marginTop: 6 },
  devFill: { height: '100%', borderRadius: 3 },
});
