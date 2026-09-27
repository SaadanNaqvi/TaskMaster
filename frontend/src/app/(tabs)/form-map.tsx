import React from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Card from '../../components/ui/Card';
import PrimaryButton from '../../components/ui/PrimaryButton';
import LifterSilhouette from '../../components/anatomy/LifterSilhouette';
import Skeleton from '../../components/anatomy/Skeleton';
import { FormMapIcon } from '../../components/icons/TabIcons';
import { Point, USER_JOINTS } from '../../components/anatomy/joints';
import { useAnalysis } from '../../state/AnalysisContext';
import { formatJointName, jointNameToKey } from '../../utils/jointNames';
import { formatDelta, measuredJoints } from '../../utils/angleDeltas';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';

/** Where a joint's number sits on the stick figure — trunk lean goes mid-torso rather than on a joint. */
function jointPoint(name: string): Point {
  if (name === 'trunk') {
    const [sx, sy] = USER_JOINTS.sh;
    const [hx, hy] = USER_JOINTS.hip;
    return [(sx + hx) / 2, (sy + hy) / 2];
  }
  return USER_JOINTS[jointNameToKey(name)];
}

export default function FormMapScreen() {
  const router = useRouter();
  const { lastJob } = useAnalysis();

  const perJoint = lastJob ? Object.entries(lastJob.result.form_report.per_joint) : [];
  const measured = lastJob ? measuredJoints(lastJob.result.form_report) : [];

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title="Form Map"
        right={<View style={{ width: 38 }} />}
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
              <Skeleton joints={USER_JOINTS} color={colors.mutedDim} strokeWidth={3} glow={false} />
              {measured.map(([name, dev]) => {
                const [x, y] = jointPoint(name);
                return (
                  <React.Fragment key={name}>
                    <Circle cx={x} cy={y} r={6} fill={colors.text} stroke={colors.bg} strokeWidth={2} />
                    <SvgText x={x + 12} y={y + 5} fill={colors.text} fontSize={15} fontWeight="bold">
                      {formatDelta(dev.max_delta)}
                    </SvgText>
                  </React.Fragment>
                );
              })}
            </Svg>
          </Card>

          <Text style={styles.sectionTitle}>Largest difference vs {lastJob.referenceName}</Text>
          <Text style={styles.sectionSubtitle}>Your joint angle minus the reference&apos;s, in degrees</Text>
          {perJoint.length === 0 ? (
            <Text style={styles.emptyText}>No per-joint data returned for this job.</Text>
          ) : (
            perJoint.map(([name, dev]) => (
              <View key={name} style={styles.devRow}>
                <View style={styles.devLabelRow}>
                  <Text style={styles.devName}>{formatJointName(name)}</Text>
                  <Text style={styles.devValue}>{formatDelta(dev.max_delta)}</Text>
                </View>
                <Text style={styles.devMessage}>{dev.message ?? 'Not visible enough to measure'}</Text>
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
  sectionTitle: { color: colors.text, fontSize: 16, fontFamily: font.bold, marginTop: 20 },
  sectionSubtitle: { color: colors.muted, fontSize: 11.5, fontFamily: font.medium, marginTop: 3, marginBottom: 4 },
  emptyText: { color: colors.muted, fontSize: 12.5, fontFamily: font.regular, marginTop: 8 },
  devRow: { marginTop: 12 },
  devLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  devName: { color: colors.text, fontSize: 13, fontFamily: font.bold },
  devValue: { color: colors.text, fontSize: 13, fontFamily: font.bold },
  devMessage: { color: colors.muted, fontSize: 11.5, fontFamily: font.regular, marginTop: 2 },
});
