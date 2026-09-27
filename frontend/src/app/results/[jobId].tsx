import React, { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, PanResponder, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Chip from '../../components/ui/Chip';
import { PlayIcon, ShareIcon } from '../../components/icons/MiscIcons';
import Smpl3DOverlay, { Smpl3DOverlayHandle } from '../../components/three/Smpl3DOverlay';
import { ApiJobResult, getJobResult, getJobStatus, getReferences, mediaUrl } from '../../services/apiGateway';
import { useCatalogue, findExerciseName } from '../../services/catalogue';
import { useAnalysis } from '../../state/AnalysisContext';
import { formatJointName } from '../../utils/jointNames';
import { formatDelta, summarizeDifferences } from '../../utils/angleDeltas';
import { SmplPose } from '../../lib/smpl/types';
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
  const [refSmplPose, setRefSmplPose] = useState<{
    poseSequence: SmplPose[];
    translations: [number, number, number][];
    fps: number;
  } | null>(null);
  const [refSmplPoseUrl, setRefSmplPoseUrl] = useState<string | null>(null);

  useEffect(() => {
    if (result) return;
    getJobResult(jobId)
      .then(setResult)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load result'));
  }, [jobId, result]);

  // Looks up the reference used for this job — always needed for the 3D overlay's real pose data,
  // and (when opened cold, e.g. a deep link) for the name too, since the normal navigation flow
  // already carries that along as a param instead.
  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    (async () => {
      try {
        const referenceId = cached?.referenceId ?? (await getJobStatus(jobId)).reference_id;
        if (!referenceId) return;
        const refs = await getReferences(result.exercise);
        const match = refs.find((r) => r.id === referenceId);
        if (!match || cancelled) return;
        if (!cached) setFallbackReferenceName(match.name);
        if (!match.smpl_pose_url) return;
        setRefSmplPoseUrl(match.smpl_pose_url);
        const response = await fetch(mediaUrl(match.smpl_pose_url)!);
        const json = await response.json();
        if (cancelled) return;
        setRefSmplPose({
          poseSequence: json.frames.map((f: { pose: number[] }) => Float32Array.from(f.pose)),
          translations: json.frames.map((f: { trans: [number, number, number] }) => f.trans),
          fps: json.fps,
        });
      } catch {
        // best-effort only — falls back to the generic name / placeholder overlay animation
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
  const overlayRef = useRef<Smpl3DOverlayHandle>(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const dragLastX = useRef(0);

  // Shares one touch target between tap-to-play/pause and drag-to-rotate-the-3D-overlay-while-
  // paused, rather than stacking a second responder on top of this one — reliably making plain
  // taps "fall through" a view that sits on top for drag purposes is fragile in RN's responder
  // system, so tap-vs-drag is disambiguated once, here, by total movement on release.
  // eslint-disable-next-line react-hooks/refs
  const [videoTouchResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragLastX.current = 0;
      },
      onPanResponderMove: (_evt, gesture) => {
        if (isPlayingRef.current) return;
        overlayRef.current?.rotateBy((gesture.dx - dragLastX.current) * 0.01);
        dragLastX.current = gesture.dx;
      },
      onPanResponderRelease: (_evt, gesture) => {
        const moved = Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4;
        if (moved) return;
        if (isPlayingRef.current) {
          player.pause();
        } else {
          player.play();
        }
        setIsPlaying(!isPlayingRef.current);
      },
    })
  );

  const handleShare = () => {
    if (!result) return;
    Share.share({
      message: `My ${exerciseName} vs ${referenceName} on TaskMaster: ${summarizeDifferences(result.form_report)}.`,
    }).catch(() => undefined);
  };

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
                  <Smpl3DOverlay
                    ref={overlayRef}
                    opacity={0.85}
                    poseSequence={refSmplPose?.poseSequence}
                    translations={refSmplPose?.translations}
                    fps={refSmplPose?.fps}
                    player={player}
                    userPoseFrames={result.user_pose.frames}
                    userVideoWidth={result.user_pose.width}
                    userVideoHeight={result.user_pose.height}
                  />
                </View>
              )}
              <View style={styles.playOverlay} {...videoTouchResponder.panHandlers}>
                {!isPlaying && (
                  <View style={styles.playBtnBig}>
                    <PlayIcon size={20} />
                  </View>
                )}
              </View>
              <Pressable style={styles.overlayToggle} onPress={() => setShowOverlay((v) => !v)}>
                <Chip background="rgba(0,0,0,0.6)" dot={colors.lime}>
                  {showOverlay
                    ? refSmplPose
                      ? `3D overlay · ${referenceName}`
                      : '3D preview overlay · placeholder'
                    : 'Overlay hidden'}
                </Chip>
              </Pressable>
              <Pressable
                style={styles.viewerButton}
                onPress={() =>
                  router.push(
                    refSmplPoseUrl
                      ? `/viewer?smplPoseUrl=${encodeURIComponent(refSmplPoseUrl)}&referenceName=${encodeURIComponent(referenceName)}`
                      : '/viewer'
                  )
                }
              >
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
          <Text style={styles.sectionTitle}>Differences vs {referenceName}</Text>
          <Text style={styles.sectionSubtitle}>Your joint angle minus the reference&apos;s, in degrees</Text>

          {Object.entries(result.form_report.per_joint).map(([name, joint]) => (
            <View key={name} style={styles.jointRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.jointName}>{formatJointName(name)}</Text>
                <Text style={styles.jointMessage}>{joint.message ?? 'Not visible enough to measure'}</Text>
              </View>
              {joint.max_delta !== null && (
                <View style={styles.jointNumbers}>
                  <Text style={styles.jointMax}>{formatDelta(joint.max_delta)}</Text>
                  <Text style={styles.jointBottom}>at bottom {formatDelta(joint.delta_at_bottom)}</Text>
                </View>
              )}
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
  sectionTitle: { color: colors.text, fontSize: 16, fontFamily: font.bold },
  sectionSubtitle: { color: colors.muted, fontSize: 11.5, fontFamily: font.medium, marginTop: 3 },
  jointRow: { flexDirection: 'row', gap: 12, marginTop: 14, alignItems: 'flex-start' },
  jointName: { color: colors.text, fontSize: 13.5, fontFamily: font.bold },
  jointMessage: { color: colors.muted, fontSize: 11.5, fontFamily: font.regular, marginTop: 1, lineHeight: 16 },
  jointNumbers: { alignItems: 'flex-end' },
  jointMax: { color: colors.text, fontSize: 17, fontFamily: font.extrabold },
  jointBottom: { color: colors.muted, fontSize: 11, fontFamily: font.medium, marginTop: 1 },
  errorTitle: { color: colors.red, fontSize: 16, fontFamily: font.bold, marginTop: 8 },
  errorBody: { color: colors.muted, fontSize: 13, fontFamily: font.regular, marginTop: 8, lineHeight: 19 },
  formMapLink: { alignItems: 'center', marginTop: 22, paddingVertical: 10 },
  formMapLinkText: { color: colors.lime, fontSize: 13.5, fontFamily: font.semibold },
});
