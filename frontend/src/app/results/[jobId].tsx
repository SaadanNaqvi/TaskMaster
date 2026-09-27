import React, { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Card from '../../components/ui/Card';
import Chip from '../../components/ui/Chip';
import ScoreRing from '../../components/ui/ScoreRing';
import { PlayIcon, ShareIcon } from '../../components/icons/MiscIcons';
import Smpl3DOverlay from '../../components/three/Smpl3DOverlay';
import { ApiJobResult, getJobResult, getJobStatus, getReferences, mediaUrl } from '../../services/apiGateway';
import { useCatalogue, findExerciseName } from '../../services/catalogue';
import { useAnalysis } from '../../state/AnalysisContext';
import { formatJointName } from '../../utils/jointNames';
import { colors, radii } from '../../theme/colors';
import { font } from '../../theme/typography';

export default function ResultsRoute() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const { getJob } = useAnalysis();
  const { exercises } = useCatalogue();

  const cached = getJob(jobId);
  const [result, setResult] = useState<ApiJobResult | null>(cached?.result ?? null);
  const [error, setError] = useState<string | null>(null);
  const [fallbackReferenceName, setFallbackReferenceName] = useState<string | null>(null);

  useEffect(() => {
    if (result) return;
    getJobResult(jobId)
      .then(setResult)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load result'));
  }, [jobId, result]);

  // Only needed when this screen is opened cold (deep link, or history from a previous app session) —
  // the normal navigation flow already carries the reference name along as a param.
  useEffect(() => {
    if (cached || !result) return;
    let cancelled = false;
    (async () => {
      try {
        const status = await getJobStatus(jobId);
        if (!status.reference_id) return;
        const refs = await getReferences(result.exercise);
        const match = refs.find((r) => r.id === status.reference_id);
        if (!cancelled && match) setFallbackReferenceName(match.name);
      } catch {
        // best-effort only — falls back to the generic "reference" label
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cached, result, jobId]);

  const exerciseName = cached?.exerciseName ?? findExerciseName(exercises, result?.exercise);
  const referenceName = cached?.referenceName ?? fallbackReferenceName ?? 'reference';
  const videoUri = mediaUrl(result?.video_url);

  const player = useVideoPlayer(videoUri ?? null, (p) => {
    p.loop = true;
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);

  const handleShare = () => {
    if (!result) return;
    Share.share({
      message: `My ${exerciseName} form score vs ${referenceName}: ${Math.round(result.form_report.score)}/100 on TaskMaster.`,
    }).catch(() => undefined);
  };

  const sortedFlags = useMemo(
    () => (result ? [...result.form_report.flags].sort((a, b) => b.diff_deg - a.diff_deg) : []),
    [result]
  );

  if (error) {
    return (
      <Screen>
        <ScreenHeader onBack={() => router.back()} title="Results" />
        <View style={styles.pad}>
          <Text style={styles.errorTitle}>Couldn’t load this result</Text>
          <Text style={styles.errorBody}>{error}</Text>
        </View>
      </Screen>
    );
  }

  if (!result) {
    return (
      <Screen>
        <ScreenHeader onBack={() => router.back()} title="Results" />
        <ActivityIndicator color={colors.lime} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  const score = Math.round(result.form_report.score);

  return (
    <Screen>
      <ScreenHeader
        onBack={() => router.back()}
        title={exerciseName}
        subtitle={`vs ${referenceName}`}
        right={
          <Pressable style={styles.shareBtn} onPress={handleShare} hitSlop={12}>
            <ShareIcon size={17} />
          </Pressable>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.videoWrap}>
          {videoUri ? (
            <>
              <VideoView
                player={player}
                style={[StyleSheet.absoluteFill, styles.video]}
                contentFit="cover"
              />
              {showOverlay && (
                <View style={styles.overlaySvgWrap} pointerEvents="none">
                  <Smpl3DOverlay opacity={0.85} />
                </View>
              )}
              <Pressable
                style={styles.playOverlay}
                onPress={() => {
                  if (isPlaying) {
                    player.pause();
                  } else {
                    player.play();
                  }
                  setIsPlaying(!isPlaying);
                }}
              >
                {!isPlaying && (
                  <View style={styles.playBtnBig}>
                    <PlayIcon size={20} />
                  </View>
                )}
              </Pressable>
              <Pressable style={styles.overlayToggle} onPress={() => setShowOverlay((v) => !v)}>
                <Chip background="rgba(0,0,0,0.6)" dot={colors.lime}>
                  {showOverlay ? '3D preview overlay · placeholder' : 'Overlay hidden'}
                </Chip>
              </Pressable>
              <Pressable style={styles.viewerButton} onPress={() => router.push('/viewer')}>
                <Chip background="rgba(0,0,0,0.6)">Open 3D view ↗</Chip>
              </Pressable>
            </>
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.videoFallback]}>
              <Text style={styles.videoFallbackText}>No prepared video for this job</Text>
            </View>
          )}
        </View>

        <View style={styles.pad}>
          <Card style={styles.scoreCard}>
            <ScoreRing score={score} />
            <View style={{ flex: 1 }}>
              <Text style={styles.scoreTitle}>Form score</Text>
              <Text style={styles.scoreSubtitle}>
                {result.form_report.flags.length} issue{result.form_report.flags.length === 1 ? '' : 's'} flagged
              </Text>
            </View>
          </Card>

          {sortedFlags.length === 0 ? (
            <Text style={styles.emptyText}>No form issues flagged for this rep.</Text>
          ) : (
            sortedFlags.map((flag, i) => {
              const color = flag.diff_deg >= 10 ? colors.red : flag.diff_deg >= 5 ? colors.amber : colors.lime;
              return (
                <View key={i} style={styles.flagRow}>
                  <View style={[styles.flagTime, { backgroundColor: `${color}22` }]}>
                    <Text style={[styles.flagTimeText, { color }]}>frame {flag.frame}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.flagJoint}>
                      {formatJointName(flag.joint)} <Text style={{ color }}>· {flag.diff_deg}°</Text>
                    </Text>
                    <Text style={styles.flagMessage}>{flag.message}</Text>
                  </View>
                </View>
              );
            })
          )}

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
  videoWrap: { height: 320, marginHorizontal: 20, borderRadius: radii.xl, overflow: 'hidden', backgroundColor: colors.s1 },
  video: { width: '100%', height: '100%' },
  overlaySvgWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  overlayToggle: { position: 'absolute', left: 12, bottom: 12 },
  viewerButton: { position: 'absolute', right: 12, bottom: 12 },
  playOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  playBtnBig: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoFallback: { alignItems: 'center', justifyContent: 'center' },
  videoFallbackText: { color: colors.muted, fontSize: 12.5, fontFamily: font.medium },
  pad: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40 },
  scoreCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  scoreTitle: { color: colors.text, fontSize: 15, fontFamily: font.bold },
  scoreSubtitle: { color: colors.muted, fontSize: 11.5, fontFamily: font.medium, marginTop: 3 },
  emptyText: { color: colors.muted, fontSize: 13, fontFamily: font.regular, marginTop: 16, textAlign: 'center' },
  flagRow: { flexDirection: 'row', gap: 12, marginTop: 14, alignItems: 'flex-start' },
  flagTime: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  flagTimeText: { fontSize: 11, fontFamily: font.bold },
  flagJoint: { color: colors.text, fontSize: 13.5, fontFamily: font.bold },
  flagMessage: { color: colors.muted, fontSize: 11.5, fontFamily: font.regular, marginTop: 1, lineHeight: 16 },
  errorTitle: { color: colors.red, fontSize: 16, fontFamily: font.bold, marginTop: 8 },
  errorBody: { color: colors.muted, fontSize: 13, fontFamily: font.regular, marginTop: 8, lineHeight: 19 },
  formMapLink: { alignItems: 'center', marginTop: 22, paddingVertical: 10 },
  formMapLinkText: { color: colors.lime, fontSize: 13.5, fontFamily: font.semibold },
});
