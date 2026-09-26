import React, { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg from 'react-native-svg';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Chip from '../../components/ui/Chip';
import PrimaryButton from '../../components/ui/PrimaryButton';
import { CheckIcon, CloseIcon } from '../../components/icons/MiscIcons';
import GymBackdrop from '../../components/anatomy/GymBackdrop';
import LifterSilhouette from '../../components/anatomy/LifterSilhouette';
import Skeleton from '../../components/anatomy/Skeleton';
import { USER_JOINTS } from '../../components/anatomy/joints';
import { ApiJobStatus, getJobResult, getJobStatus } from '../../services/apiGateway';
import { useAnalysis } from '../../state/AnalysisContext';
import { colors, radii } from '../../theme/colors';
import { font } from '../../theme/typography';

const STEP_ORDER: ApiJobStatus['status'][] = ['queued', 'preparing', 'extracting', 'syncing', 'scoring', 'done'];

const STEP_LABEL: Record<string, { title: string; detail: string }> = {
  queued: { title: 'Queued', detail: 'Waiting for a processing slot' },
  preparing: { title: 'Preparing clip', detail: 'Normalising your upload' },
  extracting: { title: 'Extracting pose', detail: 'Locating joints frame by frame' },
  syncing: { title: 'Syncing to reference', detail: 'Aligning your rep to theirs' },
  scoring: { title: 'Scoring & rendering', detail: 'Building the form report' },
  done: { title: 'Done', detail: '' },
};

const POLL_MS = 1200;

export default function ProcessingRoute() {
  const { jobId, exercise, exerciseName, referenceId, referenceName } = useLocalSearchParams<{
    jobId: string;
    exercise?: string;
    exerciseName?: string;
    referenceId?: string;
    referenceName?: string;
  }>();
  const router = useRouter();
  const { addJob } = useAnalysis();

  const [status, setStatus] = useState<ApiJobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress] = useState(() => new Animated.Value(0));
  const [progressPct, setProgressPct] = useState(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    const id = progress.addListener(({ value }) => setProgressPct(Math.round(value * 100)));
    return () => progress.removeListener(id);
  }, [progress]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      try {
        const next = await getJobStatus(jobId);
        if (cancelled) return;
        setStatus(next);
        Animated.timing(progress, {
          toValue: next.progress,
          duration: POLL_MS * 0.9,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }).start();

        if (next.status === 'failed') {
          setError(next.error ?? 'Processing failed on the server.');
          return;
        }
        if (next.status === 'done') {
          if (finishedRef.current) return;
          finishedRef.current = true;
          const result = await getJobResult(jobId);
          addJob({
            jobId,
            exerciseId: exercise ?? result.exercise,
            exerciseName: exerciseName ?? result.exercise,
            referenceId: referenceId ?? '',
            referenceName: referenceName ?? 'reference',
            createdAt: new Date().toISOString(),
            result,
          });
          router.replace(`/results/${jobId}`);
          return;
        }
        timer = setTimeout(tick, POLL_MS);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Lost connection to the server.');
      }
    };

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const stepIndex = status ? Math.max(0, STEP_ORDER.indexOf(status.status)) : 0;

  if (error) {
    return (
      <Screen>
        <ScreenHeader
          title="Something went wrong"
          right={
            <Pressable style={styles.closeBtn} onPress={() => router.back()} hitSlop={12}>
              <CloseIcon size={16} />
            </Pressable>
          }
        />
        <View style={styles.pad}>
          <Text style={styles.errorTitle}>Processing failed</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <PrimaryButton label="Back to camera" onPress={() => router.back()} style={{ marginTop: 24 }} />
        </View>
      </Screen>
    );
  }

  const widthInterpolated = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Screen>
      <ScreenHeader
        title={`Analysing your ${(exerciseName ?? exercise ?? 'set').toLowerCase()}`}
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
          {status ? STEP_LABEL[status.status]?.title ?? status.status : 'Connecting…'}
        </Chip>
      </View>

      <View style={styles.pad}>
        <View style={styles.overallRow}>
          <View>
            <Text style={styles.overallLabel}>Overall</Text>
            <Text style={styles.overallValue}>{progressPct}%</Text>
          </View>
        </View>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: widthInterpolated }]} />
        </View>

        <View style={{ marginTop: 18 }}>
          {STEP_ORDER.slice(0, 5).map((key, i) => {
            const label = STEP_LABEL[key];
            const state = i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'pending';
            return (
              <View key={key} style={styles.stepRow}>
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
                  <Text style={[styles.stepTitle, state === 'pending' && styles.stepTitleMuted]}>{label.title}</Text>
                  {state !== 'pending' && <Text style={styles.stepDetail}>{label.detail}</Text>}
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
  errorTitle: { color: colors.red, fontSize: 17, fontFamily: font.bold, marginTop: 8 },
  errorBody: { color: colors.muted, fontSize: 13, fontFamily: font.regular, marginTop: 8, lineHeight: 19 },
});
