import React, { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Animated, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import Svg from 'react-native-svg';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Chip from '../../components/ui/Chip';
import Card from '../../components/ui/Card';
import ScoreRing from '../../components/ui/ScoreRing';
import { PlayIcon, PauseIcon, ShareIcon } from '../../components/icons/MiscIcons';
import GymBackdrop from '../../components/anatomy/GymBackdrop';
import LifterSilhouette from '../../components/anatomy/LifterSilhouette';
import Skeleton from '../../components/anatomy/Skeleton';
import FlagCallout from '../../components/anatomy/FlagCallout';
import { REF_JOINTS, REF_JOINTS_DEEP, USER_JOINTS, lerpJoints } from '../../components/anatomy/joints';
import { EXERCISES, Exercise } from '../../models/exercise';
import { findReference } from '../../models/reference';
import { generateMockAnalysis, Severity } from '../../models/analysis';
import { useAnalysis } from '../../state/AnalysisContext';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';

const SEVERITY_COLOR: Record<Severity, string> = { red: colors.red, amber: colors.amber, lime: colors.lime };

const CALLOUT_OFFSETS: [number, number][] = [
  [-30, 70],
  [-50, -40],
  [40, -30],
];

export default function ResultsRoute() {
  const { exercise: exerciseParam, referenceId, clipId } = useLocalSearchParams<{
    exercise: string;
    referenceId?: string;
    clipId?: string;
  }>();
  const router = useRouter();
  const { lastAnalysis, setLastAnalysis } = useAnalysis();

  const exercise = (EXERCISES.find((e) => e === exerciseParam) ?? EXERCISES[0]) as Exercise;
  const reference = findReference(exercise, referenceId);
  const seedKey = clipId ?? 'demo';
  const expectedId = `${exercise}-${reference.id}-${seedKey}`;

  const analysis = useMemo(() => {
    if (lastAnalysis && lastAnalysis.id === expectedId) return lastAnalysis;
    const generated = generateMockAnalysis(exercise, reference, seedKey);
    setLastAnalysis(generated);
    return generated;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expectedId]);

  const [ghostPct, setGhostPct] = useState(40);
  const [isPlaying, setIsPlaying] = useState(false);
  const [repIndex, setRepIndex] = useState(0);
  const [anim] = useState(() => new Animated.Value(0));
  const [t, setT] = useState(0);

  useEffect(() => {
    const id = anim.addListener(({ value }) => setT(value));
    return () => anim.removeListener(id);
  }, [anim]);

  useEffect(() => {
    if (!isPlaying) return;
    anim.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: false }),
      ])
    );
    const repTimer = setInterval(() => {
      setRepIndex((r) => (r + 1) % analysis.scoreByRep.length);
    }, 1800);
    loop.start();
    return () => {
      loop.stop();
      clearInterval(repTimer);
    };
  }, [isPlaying, anim, analysis.scoreByRep.length]);

  const animatedRef = lerpJoints(REF_JOINTS, REF_JOINTS_DEEP, t * 0.6);

  const issueReps = useMemo(() => {
    const flagged = analysis.deviations.filter((d) => d.severity !== 'lime');
    return flagged.length ? `reps ${flagged.map((_, i) => i + 1).slice(0, 2).join('–')}` : 'no reps';
  }, [analysis.deviations]);

  const handleShare = () => {
    Share.share({
      message: `My ${exercise} form score vs ${reference.name}: ${analysis.overallScore}/100 on TaskMaster.`,
    }).catch(() => undefined);
  };

  return (
    <Screen>
      <ScreenHeader
        onBack={() => router.back()}
        title={`${exercise} · Rep ${repIndex + 1}`}
        subtitle={`vs ${reference.name}`}
        right={
          <Pressable style={styles.shareBtn} onPress={handleShare} hitSlop={12}>
            <ShareIcon size={17} />
          </Pressable>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.overlayWrap}>
          <Svg viewBox="0 95 360 350" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
            <GymBackdrop />
            <LifterSilhouette joints={USER_JOINTS} />
            <Skeleton joints={USER_JOINTS} color={colors.cyan} strokeWidth={3} glow={false} />
            <Skeleton joints={animatedRef} color={colors.lime} strokeWidth={4.5} opacity={ghostPct / 100 + 0.55} />
            {analysis.flags.slice(0, 3).map((flag, i) => {
              const [dx, dy] = CALLOUT_OFFSETS[i] ?? [-30, 70];
              return (
                <FlagCallout
                  key={`${flag.joint}-${i}`}
                  point={USER_JOINTS[flag.jointKey]}
                  label={flag.severity === 'lime' ? `${flag.joint} OK` : `${flag.joint} ${flag.degrees}°`}
                  dx={dx}
                  dy={dy}
                  color={SEVERITY_COLOR[flag.severity]}
                />
              );
            })}
          </Svg>
          <View style={styles.legendRow}>
            <Chip background="rgba(0,0,0,0.6)" dot={colors.lime}>{reference.name.split(' ')[0]}</Chip>
            <Chip background="rgba(0,0,0,0.6)" dot={colors.cyan}>You</Chip>
          </View>
          <Pressable onPress={() => setGhostPct((p) => (p === 40 ? 65 : p === 65 ? 20 : 40))} style={styles.ghostChip}>
            <Chip background="rgba(0,0,0,0.6)">Ghost {ghostPct}%</Chip>
          </Pressable>
        </View>

        <View style={styles.pad}>
          <View style={styles.timelineRow}>
            <Pressable style={styles.playBtn} onPress={() => setIsPlaying((p) => !p)}>
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </Pressable>
            <View style={styles.timelineTrack}>
              <View style={styles.timelineBase} />
              <View style={[styles.timelineFill, { width: `${((repIndex + 1) / analysis.scoreByRep.length) * 100}%` }]} />
              {analysis.scoreByRep.map((score, i) => {
                const pct = ((i + 0.5) / analysis.scoreByRep.length) * 100;
                const color = score >= 75 ? colors.lime : score >= 60 ? colors.amber : colors.red;
                return (
                  <View key={i} style={[styles.repMarker, { left: `${pct}%`, backgroundColor: color }]}>
                    <Text style={styles.repLabel}>{`R${i + 1}`}</Text>
                  </View>
                );
              })}
            </View>
            <Text style={styles.timeText}>{analysis.flags[0]?.time ?? '0:00'}</Text>
          </View>

          <Card style={styles.scoreCard}>
            <ScoreRing score={analysis.overallScore} />
            <View style={{ flex: 1 }}>
              <Text style={styles.scoreTitle}>Form score</Text>
              <Text style={styles.scoreSubtitle}>
                {analysis.deviations.filter((d) => d.severity !== 'lime').length} issues on {issueReps}
                {' · '}tempo {analysis.tempoMatched ? 'matched' : 'off'}
              </Text>
            </View>
          </Card>

          {analysis.flags.map((flag, i) => (
            <View key={i} style={styles.flagRow}>
              <View style={[styles.flagTime, { backgroundColor: `${SEVERITY_COLOR[flag.severity]}22` }]}>
                <Text style={[styles.flagTimeText, { color: SEVERITY_COLOR[flag.severity] }]}>{flag.time}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.flagJoint}>{flag.joint}</Text>
                <Text style={styles.flagMessage}>{flag.message}</Text>
              </View>
            </View>
          ))}

          <Pressable style={styles.formMapLink} onPress={() => router.push('/(tabs)/form-map')}>
            <Text style={styles.formMapLinkText}>View full Form Map →</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  shareBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayWrap: { height: 380 },
  legendRow: { position: 'absolute', left: 12, top: 12, flexDirection: 'row', gap: 6 },
  ghostChip: { position: 'absolute', right: 12, top: 12 },
  pad: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineTrack: { flex: 1, height: 34, position: 'relative' },
  timelineBase: { position: 'absolute', top: 15, left: 0, right: 0, height: 4, borderRadius: 2, backgroundColor: colors.s3 },
  timelineFill: { position: 'absolute', top: 15, left: 0, height: 4, borderRadius: 2, backgroundColor: '#fff' },
  repMarker: {
    position: 'absolute',
    top: 12,
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: -5,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: 'center',
  },
  repLabel: { position: 'absolute', top: -14, fontSize: 9.5, color: colors.muted, fontFamily: font.semibold, width: 24, textAlign: 'center', left: -7 },
  timeText: { color: colors.muted, fontSize: 12, fontFamily: font.medium },
  scoreCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, marginTop: 18 },
  scoreTitle: { color: colors.text, fontSize: 15, fontFamily: font.bold },
  scoreSubtitle: { color: colors.muted, fontSize: 11.5, fontFamily: font.medium, marginTop: 3 },
  flagRow: { flexDirection: 'row', gap: 12, marginTop: 12, alignItems: 'flex-start' },
  flagTime: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  flagTimeText: { fontSize: 11, fontFamily: font.bold },
  flagJoint: { color: colors.text, fontSize: 13.5, fontFamily: font.bold },
  flagMessage: { color: colors.muted, fontSize: 11.5, fontFamily: font.regular, marginTop: 1, lineHeight: 16 },
  formMapLink: { alignItems: 'center', marginTop: 22, paddingVertical: 10 },
  formMapLinkText: { color: colors.lime, fontSize: 13.5, fontFamily: font.semibold },
});
