import React, { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import SmplViewer from '../../components/three/SmplViewer';
import { SmplPose } from '../../lib/smpl/types';

// First real pose sequence, produced by backend/pose/video_to_smpl_pose.py from an actual
// recorded squat — MediaPipe landmarks converted to SMPL axis-angle rotations, no learned model.
const demoSequenceJson = require('../../../assets/pose-sequences/demo_squat.json');

/**
 * Full free-orbit 3D view — one-finger drag to rotate, pinch to zoom. Plays back a real
 * MediaPipe-derived pose sequence instead of the placeholder stand/squat loop.
 */
export default function ViewerRoute() {
  const router = useRouter();

  const { poseSequence, fps } = useMemo(() => {
    const frames: SmplPose[] = demoSequenceJson.frames.map((f: number[]) => Float32Array.from(f));
    return { poseSequence: frames, fps: demoSequenceJson.fps as number };
  }, []);

  return (
    <Screen edges={['top']}>
      <ScreenHeader onBack={() => router.back()} title="3D View" subtitle="Real squat clip · drag to look around" />
      <View style={{ flex: 1 }}>
        <SmplViewer poseSequence={poseSequence} fps={fps} />
      </View>
    </Screen>
  );
}
