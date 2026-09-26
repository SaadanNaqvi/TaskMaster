import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import RecordScreen from '../../screens/RecordScreen';
import Screen from '../../components/ui/Screen';

export default function RecordRoute() {
  const { exercise, referenceId, referenceName, exerciseName } = useLocalSearchParams<{
    exercise: string;
    referenceId: string;
    referenceName: string;
    exerciseName?: string;
  }>();
  const router = useRouter();

  return (
    <Screen bare edges={[]}>
      <RecordScreen
        exercise={exercise}
        exerciseName={exerciseName ?? exercise}
        referenceId={referenceId}
        referenceName={referenceName ?? 'the reference'}
        onBack={() => router.back()}
        onOpenLibrary={() =>
          router.push(
            `/clips/${exercise}?mode=pick&referenceId=${referenceId}&referenceName=${encodeURIComponent(referenceName ?? '')}&exerciseName=${encodeURIComponent(exerciseName ?? exercise)}`
          )
        }
        onJobStarted={(jobId) =>
          router.replace(
            `/processing/${jobId}?exercise=${exercise}&exerciseName=${encodeURIComponent(exerciseName ?? exercise)}&referenceId=${referenceId}&referenceName=${encodeURIComponent(referenceName ?? '')}`
          )
        }
      />
    </Screen>
  );
}
