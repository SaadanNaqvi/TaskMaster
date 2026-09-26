import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import RecordScreen from '../../screens/RecordScreen';
import { EXERCISES, Exercise } from '../../models/exercise';
import { findReference } from '../../models/reference';
import Screen from '../../components/ui/Screen';

export default function RecordRoute() {
  const { exercise: exerciseParam, referenceId } = useLocalSearchParams<{
    exercise: string;
    referenceId?: string;
  }>();
  const router = useRouter();

  const exercise = (EXERCISES.find((e) => e === exerciseParam) ?? EXERCISES[0]) as Exercise;
  const reference = findReference(exercise, referenceId);

  return (
    <Screen bare edges={[]}>
      <RecordScreen
        exercise={exercise}
        reference={reference}
        onBack={() => router.back()}
        onOpenLibrary={() =>
          router.push(`/clips/${encodeURIComponent(exercise)}?mode=pick&referenceId=${reference.id}`)
        }
        onRecorded={(clipId) =>
          router.replace(
            `/processing/${encodeURIComponent(exercise)}?referenceId=${reference.id}&clipId=${encodeURIComponent(clipId)}`
          )
        }
      />
    </Screen>
  );
}
