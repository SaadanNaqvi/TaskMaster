import React, { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import RecordScreen from '../../screens/RecordScreen';
import { EXERCISES, Exercise } from '../../models/exercise';
import { loadClips } from '../../services/clipLibrary';

export default function RecordRoute() {
  const { exercise: exerciseParam } = useLocalSearchParams<{ exercise: string }>();
  const router = useRouter();
  const [clipCount, setClipCount] = useState(0);

  const exercise = (EXERCISES.find((e) => e === exerciseParam) ?? EXERCISES[0]) as Exercise;

  const refreshCount = useCallback(async () => {
    const clips = await loadClips();
    setClipCount(clips.filter((c) => c.exercise === exercise).length);
  }, [exercise]);

  useFocusEffect(
    useCallback(() => {
      refreshCount();
    }, [refreshCount])
  );

  return (
    <RecordScreen
      exercise={exercise}
      clipCount={clipCount}
      onBack={() => router.back()}
      onOpenClips={() => router.push(`/clips/${encodeURIComponent(exercise)}`)}
      onSaved={refreshCount}
    />
  );
}
