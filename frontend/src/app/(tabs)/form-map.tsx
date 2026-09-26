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
import { Severity } from '../../models/analysis';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';

const SEVERITY_COLOR: Record<Severity, string> = { red: colors.red, amber: colors.amber, lime: colors.lime };
const SEVERITY_RADIUS: Record<Severity, number> = { red: 34, amber: 24, lime: 0 };

export default function FormMapScreen() {
  const router = useRouter();
  const { lastAnalysis } = useAnalysis();

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title="Form Map"
        right={lastAnalysis ? <Chip>{lastAnalysis.repCount} reps</Chip> : <View style={{ width: 38 }} />}
      />

      {!lastAnalysis ? (
        <View style={styles.empty}>
          <FormMapIcon size={40} color={colors.mutedDim} />
          <Text style={styles.emptyTitle}>No analysis yet</Text>
          <Text style={styles.emptyBody}>Complete a form check from the Train tab to see where your form breaks down, joint by joint.</Text>
          <PrimaryButton label="Start a check" onPress={() => router.push('/(tabs)')} style={{ marginTop: 20, minWidth: 200 }} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.pad} showsVerticalScrollIndicator={false}>
          <Text style={styles.subtitle}>{lastAnalysis.exercise} vs {lastAnalysis.reference.name}</Text>
          <Card style={styles.heatCard}>
            <Svg viewBox="70 110 230 350" width="100%" height={280}>
              <LifterSilhouette joints={USER_JOINTS} fill="#1E232A" />
              {lastAnalysis.deviations.map((d) => {
                const r = SEVERITY_RADIUS[d.severity];
                if (!r) return null;
                const [x, y] = USER_JOINTS[d.jointKey];
                return <Circle key={`glow-${d.jointKey}`} cx={x} cy={y} r={r} fill={SEVERITY_COLOR[d.severity]} opacity={0.25} />;
              })}
              <Skeleton joints={USER_JOINTS} color={colors.mutedDim} strokeWidth={3} glow={false} />
              {lastAnalysis.deviations.map((d) => {
                const [x, y] = USER_JOINTS[d.jointKey];
                return (
                  <Circle
                    key={`dot-${d.jointKey}`}
                    cx={x}
                    cy={y}
                    r={7}
                    fill={SEVERITY_COLOR[d.severity]}
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

          <Text style={styles.sectionTitle}>Max deviation vs {lastAnalysis.reference.name.split(' ')[0]}</Text>
          {lastAnalysis.deviations.map((d) => (
            <View key={d.name} style={styles.devRow}>
              <View style={styles.devLabelRow}>
                <Text style={styles.devName}>{d.name}</Text>
                <Text style={styles.devValue}>
                  <Text style={{ color: SEVERITY_COLOR[d.severity], fontFamily: font.bold }}>{d.degrees}°</Text>
                  <Text style={styles.devReps}> · {d.reps}</Text>
                </Text>
              </View>
              <View style={styles.devTrack}>
                <View style={[styles.devFill, { width: `${Math.min(100, (d.degrees / 16) * 100)}%`, backgroundColor: SEVERITY_COLOR[d.severity] }]} />
              </View>
            </View>
          ))}

          <Text style={styles.sectionTitle}>Score by rep</Text>
          <View style={styles.barsRow}>
            {lastAnalysis.scoreByRep.map((v, i) => {
              const color = v < 65 ? colors.red : v < 75 ? colors.amber : colors.lime;
              return (
                <View key={i} style={styles.barCol}>
                  <Text style={styles.barValue}>{v}</Text>
                  <View style={[styles.bar, { height: Math.max(8, (v - 35) * 1.1), backgroundColor: color }]} />
                  <Text style={styles.barRepLabel}>R{i + 1}</Text>
                </View>
              );
            })}
          </View>
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
  devRow: { marginTop: 12 },
  devLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  devName: { color: colors.text, fontSize: 13, fontFamily: font.bold },
  devValue: { fontSize: 12.5 },
  devReps: { color: colors.muted, fontFamily: font.medium },
  devTrack: { height: 6, backgroundColor: colors.s2, borderRadius: 3, marginTop: 6 },
  devFill: { height: '100%', borderRadius: 3 },
  barsRow: { flexDirection: 'row', gap: 10, marginTop: 10, alignItems: 'flex-end', height: 90 },
  barCol: { flex: 1, alignItems: 'center' },
  barValue: { color: colors.text, fontSize: 11.5, fontFamily: font.bold, marginBottom: 4 },
  bar: { width: '100%', borderRadius: 6 },
  barRepLabel: { color: colors.muted, fontSize: 10, fontFamily: font.medium, marginTop: 6 },
});
