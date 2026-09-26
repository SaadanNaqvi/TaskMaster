import React, { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import ClipListScreen from '../../screens/ClipListScreen';
import { EXERCISES, Exercise } from '../../models/exercise';
import { ExerciseClip, loadClips } from '../../services/clipLibrary';

export default function ClipsRoute() {
  const { exercise: exerciseParam } = useLocalSearchParams<{ exercise: string }>();
  const router = useRouter();
  const [clips, setClips] = useState<ExerciseClip[]>([]);

  const exercise = (EXERCISES.find((e) => e === exerciseParam) ?? EXERCISES[0]) as Exercise;

  const refresh = useCallback(async () => {
    const all = await loadClips();
    setClips(all.filter((c) => c.exercise === exercise));
  }, [exercise]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return (
    <ClipListScreen exercise={exercise} clips={clips} onBack={() => router.back()} onDeleted={refresh} />
  );
}
