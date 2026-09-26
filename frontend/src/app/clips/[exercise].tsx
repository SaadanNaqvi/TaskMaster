import React, { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import ClipListScreen from '../../screens/ClipListScreen';
import Screen from '../../components/ui/Screen';
import { ApiRequestError } from '../../services/apiGateway';
import { startJobFromClip } from '../../services/jobs';
import { ExerciseClip, loadClips } from '../../services/clipLibrary';
import { colors } from '../../theme/colors';

export default function ClipsRoute() {
  const { exercise, mode, referenceId, referenceName, exerciseName } = useLocalSearchParams<{
    exercise: string;
    mode?: string;
    referenceId?: string;
    referenceName?: string;
    exerciseName?: string;
  }>();
  const router = useRouter();
  const [clips, setClips] = useState<ExerciseClip[]>([]);
  const [uploading, setUploading] = useState(false);

  const isPicking = mode === 'pick';

  const refresh = useCallback(async () => {
    const all = await loadClips();
    setClips(all.filter((c) => c.exercise === exercise));
  }, [exercise]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handlePick = async (clip: ExerciseClip) => {
    if (!referenceId) return;
    setUploading(true);
    try {
      const jobId = await startJobFromClip(clip, referenceId);
      router.replace(
        `/processing/${jobId}?exercise=${exercise}&exerciseName=${encodeURIComponent(exerciseName ?? exercise)}&referenceId=${referenceId}&referenceName=${encodeURIComponent(referenceName ?? '')}`
      );
    } catch (err) {
      setUploading(false);
      const message = err instanceof ApiRequestError ? err.message : err instanceof Error ? err.message : String(err);
      Alert.alert('Upload failed', message);
    }
  };

  return (
    <Screen>
      <ClipListScreen
        exercise={exercise}
        clips={clips}
        onBack={() => router.back()}
        onDeleted={refresh}
        mode={isPicking ? 'pick' : 'view'}
        onPick={handlePick}
      />
      {uploading && (
        <View style={styles.overlay}>
          <ActivityIndicator color={colors.lime} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11,13,16,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
