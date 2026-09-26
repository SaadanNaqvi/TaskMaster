import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Exercise, framingHint } from '../models/exercise';
import { addClip } from '../services/clipLibrary';
import FramingGuideOverlay from '../components/FramingGuideOverlay';

interface Props {
  exercise: Exercise;
  clipCount: number;
  onBack: () => void;
  onOpenClips: () => void;
  onSaved: () => Promise<void> | void;
}

export default function RecordScreen({ exercise, clipCount, onBack, onOpenClips, onSaved }: Props) {
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [isRecording, setIsRecording] = useState(false);
  const recordingStartedAt = useRef(0);

  useEffect(() => {
    if (!cameraPermission?.granted) requestCameraPermission();
    if (!micPermission?.granted) requestMicPermission();
  }, [cameraPermission, micPermission, requestCameraPermission, requestMicPermission]);

  const handlePress = async () => {
    if (isRecording) {
      cameraRef.current?.stopRecording();
      return;
    }
    if (!cameraRef.current) return;

    setIsRecording(true);
    recordingStartedAt.current = Date.now();
    try {
      const result = await cameraRef.current.recordAsync();
      setIsRecording(false);
      if (result?.uri) {
        const durationSeconds = (Date.now() - recordingStartedAt.current) / 1000;
        await addClip(result.uri, exercise, durationSeconds);
        await onSaved();
      }
    } catch (error) {
      setIsRecording(false);
      Alert.alert('Recording failed', error instanceof Error ? error.message : String(error));
    }
  };

  if (!cameraPermission?.granted || !micPermission?.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Camera and microphone access needed to record</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" mode="video" />
      <FramingGuideOverlay />

      <View style={styles.topBar}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.backText}>{'‹ Library'}</Text>
        </Pressable>
        <Text style={styles.exerciseTitle}>{exercise}</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <Text style={styles.hint}>{framingHint(exercise)}</Text>

      <View style={styles.bottomBar}>
        <Pressable style={styles.clipsButton} onPress={onOpenClips}>
          <Text style={styles.clipsButtonText}>Clips ({clipCount})</Text>
        </Pressable>

        <Pressable style={styles.recordButton} onPress={handlePress}>
          <View style={isRecording ? styles.stopIcon : styles.recordIcon} />
        </Pressable>

        <View style={styles.bottomBarSpacer} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permissionText: { color: '#fff', textAlign: 'center' },
  topBar: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  topBarSpacer: { width: 70 },
  backText: { color: '#fff', fontSize: 16 },
  exerciseTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  hint: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    fontSize: 12,
    maxWidth: '90%',
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  bottomBarSpacer: { width: 90 },
  clipsButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  clipsButtonText: { color: '#fff', fontSize: 14 },
  recordButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'red' },
  stopIcon: { width: 30, height: 30, borderRadius: 6, backgroundColor: 'red' },
});
