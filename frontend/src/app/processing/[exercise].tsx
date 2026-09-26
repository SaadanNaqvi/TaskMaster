import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg from 'react-native-svg';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Chip from '../../components/ui/Chip';
import { CheckIcon, CloseIcon } from '../../components/icons/MiscIcons';
import GymBackdrop from '../../components/anatomy/GymBackdrop';
import LifterSilhouette from '../../components/anatomy/LifterSilhouette';
import Skeleton from '../../components/anatomy/Skeleton';
import { USER_JOINTS } from '../../components/anatomy/joints';
import { EXERCISES, Exercise } from '../../models/exercise';
import { findReference } from '../../models/reference';
import { generateMockAnalysis } from '../../models/analysis';
import { useAnalysis } from '../../state/AnalysisContext';
import { colors, radii } from '../../theme/colors';
import { font } from '../../theme/typography';

interface Step {
  title: string;
  detail: string;
  durationMs: number;
}

export default function ProcessingRoute() {
  const { exercise: exerciseParam, referenceId, clipId } = useLocalSearchParams<{
    exercise: string;
    referenceId?: string;
    clipId?: string;
  }>();
  const router = useRouter();
  const { setLastAnalysis } = useAnalysis();

  const exercise = (EXERCISES.find((e) => e === exerciseParam) ?? EXERCISES[0]) as Exercise;
  const reference = findReference(exercise, referenceId);
  const seedKey = clipId ?? 'demo';

  const steps: Step[] = [
    { title: 'Uploading clip', detail: 'Preparing your recording', durationMs: 700 },
    { title: 'Extracting pose', detail: 'Locating joints frame by frame', durationMs: 1100 },
    { title: 'Detecting reps', detail: 'Splitting the set into reps', durationMs: 900 },
    { title: `Syncing to ${reference.name.split(' ')[0]}`, detail: 'Aligning tempo, rep by rep', durationMs: 1000 },
    { title: 'Scoring & rendering', detail: 'Building the overlay', durationMs: 900 },
  ];

  const [stepIndex, setStepIndex] = useState(0);
  const [progress] = useState(() => new Animated.Value(0));
  const [progressPct, setProgressPct] = useState(0);

  useEffect(() => {
    const id = progress.addListener(({ value }) => setProgressPct(Math.round(value * 100)));
    return () => progress.removeListener(id);
  }, [progress]);

  useEffect(() => {
    let cancelled = false;
    let cumulative = 0;

    const total = steps.reduce((s, st) => s + st.durationMs, 0);
    const run = async () => {
      for (let i = 0; i < steps.length; i++) {
        if (cancelled) return;
        setStepIndex(i);
        cumulative += steps[i].durationMs;
        await new Promise<void>((resolve) => {
          Animated.timing(progress, {
            toValue: cumulative / total,
            duration: steps[i].durationMs,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
          }).start(() => resolve());
        });
      }
      if (cancelled) return;
      const analysis = generateMockAnalysis(exercise, reference, seedKey);
      setLastAnalysis(analysis);
      router.replace(
        `/results/${encodeURIComponent(exercise)}?referenceId=${reference.id}&clipId=${encodeURIComponent(seedKey)}`
      );
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const widthInterpolated = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const secondsLeft = Math.max(0, Math.round((steps.reduce((s, st) => s + st.durationMs, 0) * (1 - progressPct / 100)) / 1000));

  return (
    <Screen>
      <ScreenHeader
        title={`Analysing your ${exercise.toLowerCase()}`}
        right={
          <Pressable style={styles.closeBtn} onPress={() => router.back()} hitSlop={12}>
            <CloseIcon size={16} />
          </Pressable>
        }
      />

      <View style={styles.previewWrap}>
        <Svg viewBox="0 100 360 340" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
          <GymBackdrop />
          <LifterSilhouette joints={USER_JOINTS} fill="#2d333c" />
          <Skeleton joints={USER_JOINTS} color={colors.cyan} strokeWidth={3.5} />
        </Svg>
        <Chip background="rgba(0,0,0,0.55)" style={styles.frameChip}>
          {`frame ${Math.min(214, Math.round((progressPct / 100) * 214))} / 214`}
        </Chip>
      </View>

      <View style={styles.pad}>
        <View style={styles.overallRow}>
          <View>
            <Text style={styles.overallLabel}>Overall</Text>
            <Text style={styles.overallValue}>{progressPct}%</Text>
          </View>
          <Text style={styles.timeLeft}>~{secondsLeft}s left</Text>
        </View>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: widthInterpolated }]} />
        </View>

        <View style={{ marginTop: 18 }}>
          {steps.map((step, i) => {
            const state = i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'pending';
            return (
              <View key={step.title} style={styles.stepRow}>
                <View
                  style={[
                    styles.stepDot,
                    state === 'done' && styles.stepDotDone,
                    state === 'active' && styles.stepDotActive,
                  ]}
                >
                  {state === 'done' && <CheckIcon />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepTitle, state === 'pending' && styles.stepTitleMuted]}>{step.title}</Text>
                  {state !== 'pending' && <Text style={styles.stepDetail}>{step.detail}</Text>}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewWrap: {
    marginHorizontal: 20,
    marginTop: 6,
    height: 300,
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  frameChip: { position: 'absolute', top: 12, left: 12 },
  pad: { paddingHorizontal: 20, marginTop: 22 },
  overallRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  overallLabel: { color: colors.muted, fontSize: 11.5, fontFamily: font.medium },
  overallValue: { color: colors.text, fontSize: 34, fontFamily: font.extrabold, letterSpacing: -1 },
  timeLeft: { color: colors.muted, fontSize: 13, fontFamily: font.medium },
  track: { height: 8, backgroundColor: colors.s2, borderRadius: 4, marginTop: 8, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.lime, borderRadius: 4 },
  stepRow: { flexDirection: 'row', gap: 14, paddingVertical: 10, alignItems: 'flex-start' },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#333a44',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepDotActive: { borderWidth: 3, borderColor: colors.lime, borderRightColor: 'transparent' },
  stepDotDone: { backgroundColor: colors.lime, borderWidth: 0 },
  stepTitle: { color: colors.text, fontSize: 14.5, fontFamily: font.semibold },
  stepTitleMuted: { color: colors.muted },
  stepDetail: { color: colors.muted, fontSize: 11.5, fontFamily: font.medium, marginTop: 2 },
});
