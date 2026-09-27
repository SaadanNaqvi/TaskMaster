import React, { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import SmplViewer from '../../components/three/SmplViewer';
import { SmplPose } from '../../lib/smpl/types';
import { mediaUrl } from '../../services/apiGateway';
import { colors } from '../../theme/colors';

// Fallback demo when opened with no reference (e.g. a bookmark) — an old MediaPipe-geometric pose
// sequence, kept only so this route always has *something* to show standalone.
const demoSequenceJson = require('../../../assets/pose-sequences/demo_squat.json');

function parseSequence(json: { fps: number; frames: { pose: number[]; trans: [number, number, number] }[] }) {
  return {
    poseSequence: json.frames.map((f) => Float32Array.from(f.pose)) as SmplPose[],
    translations: json.frames.map((f) => f.trans),
    fps: json.fps,
  };
}

/**
 * Full free-orbit 3D view — one-finger drag to rotate, pinch to zoom. Plays the reference's real
 * ROMP-derived pose sequence when opened from a result (via the smplPoseUrl param), otherwise
 * falls back to a bundled demo clip.
 */
export default function ViewerRoute() {
  const router = useRouter();
  const { smplPoseUrl, referenceName } = useLocalSearchParams<{ smplPoseUrl?: string; referenceName?: string }>();

  const demo = useMemo(() => parseSequence(demoSequenceJson), []);
  const [fetched, setFetched] = useState<ReturnType<typeof parseSequence> | null>(null);
  const [loading, setLoading] = useState(!!smplPoseUrl);

  useEffect(() => {
    if (!smplPoseUrl) return;
    let cancelled = false;
    setLoading(true);
    fetch(mediaUrl(smplPoseUrl)!)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setFetched(parseSequence(json));
      })
      .catch(() => {
        // best-effort — falls back to the demo clip below
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [smplPoseUrl]);

  const { poseSequence, translations, fps } = fetched ?? demo;
  const subtitle = fetched ? `vs ${referenceName ?? 'reference'} · drag to look around` : 'Real squat clip · drag to look around';

  return (
    <Screen edges={['top']}>
      <ScreenHeader onBack={() => router.back()} title="3D View" subtitle={subtitle} />
      <View style={{ flex: 1 }}>
        {loading && !fetched ? (
          <ActivityIndicator color={colors.lime} style={{ marginTop: 40 }} />
        ) : (
          <SmplViewer poseSequence={poseSequence} translations={translations} fps={fps} />
        )}
      </View>
    </Screen>
  );
}
