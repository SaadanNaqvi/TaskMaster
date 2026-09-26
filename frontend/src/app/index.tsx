import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import ExerciseListScreen from '../screens/ExerciseListScreen';
import { ExerciseClip, loadClips } from '../services/clipLibrary';
import { Exercise } from '../models/exercise';

export default function Index() {
  const router = useRouter();
  const [clips, setClips] = useState<ExerciseClip[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadClips().then(setClips);
    }, [])
  );

  const handleSelect = (exercise: Exercise) => {
    router.push(`/record/${encodeURIComponent(exercise)}`);
  };

  return <ExerciseListScreen clips={clips} onSelectExercise={handleSelect} />;
}
