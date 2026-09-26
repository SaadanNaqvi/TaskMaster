import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Exercise, framingHint } from '../models/exercise';
import { ReferenceOption } from '../models/reference';
import { addClip } from '../services/clipLibrary';
import FramingGuideOverlay from '../components/FramingGuideOverlay';
import ScreenHeader from '../components/ui/ScreenHeader';
import Chip from '../components/ui/Chip';
import { colors } from '../theme/colors';
import { font } from '../theme/typography';
import Skeleton from '../components/anatomy/Skeleton';
import { REF_JOINTS } from '../components/anatomy/joints';
import Svg from 'react-native-svg';

interface Props {
  exercise: Exercise;
  reference: ReferenceOption;
  onBack: () => void;
  onOpenLibrary: () => void;
  onRecorded: (clipId: string) => void;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function RecordScreen({ exercise, reference, onBack, onOpenLibrary, onRecorded }: Props) {
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [zoomedIn, setZoomedIn] = useState(false);
  const recordingStartedAt = useRef(0);

  useEffect(() => {
    if (!cameraPermission?.granted) requestCameraPermission();
    if (!micPermission?.granted) requestMicPermission();
  }, [cameraPermission, micPermission, requestCameraPermission, requestMicPermission]);

  useEffect(() => {
    if (!isRecording) return;
    const id = setInterval(() => {
      setElapsed((Date.now() - recordingStartedAt.current) / 1000);
    }, 200);
    return () => clearInterval(id);
  }, [isRecording]);

  const handlePress = async () => {
    if (isRecording) {
      cameraRef.current?.stopRecording();
      return;
    }
    if (!cameraRef.current) return;

    setIsRecording(true);
    setElapsed(0);
    recordingStartedAt.current = Date.now();
    try {
      const result = await cameraRef.current.recordAsync();
      setIsRecording(false);
      if (result?.uri) {
        setIsSaving(true);
        const durationSeconds = (Date.now() - recordingStartedAt.current) / 1000;
        const clip = await addClip(result.uri, exercise, durationSeconds);
        setIsSaving(false);
        onRecorded(clip.id);
      }
    } catch (error) {
      setIsRecording(false);
      setIsSaving(false);
      Alert.alert('Recording failed', error instanceof Error ? error.message : String(error));
    }
  };

  if (!cameraPermission?.granted || !micPermission?.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Svg viewBox="100 110 170 340" width={72} height={72} style={{ marginBottom: 16 }}>
          <Skeleton joints={REF_JOINTS} color={colors.muted} strokeWidth={7} glow={false} />
        </Svg>
        <Text style={styles.permissionTitle}>Camera access needed</Text>
        <Text style={styles.permissionText}>
          TaskMaster needs your camera and microphone to record a side-on set to compare against {reference.name}.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" mode="video" zoom={zoomedIn ? 0.35 : 0} />
      <FramingGuideOverlay />

      <View style={styles.topOverlay}>
        <ScreenHeader
          onBack={onBack}
          title={exercise}
          transparent
          right={
            <Chip background="rgba(0,0,0,0.5)" color={isRecording ? colors.red : colors.text} dot={isRecording ? colors.red : undefined}>
              {isRecording ? formatElapsed(elapsed) : `vs ${reference.name.split(' ')[0]}`}
            </Chip>
          }
        />
        <Text style={styles.hint}>{framingHint(exercise)}</Text>
        <View style={styles.tipRow}>
          <Chip background="rgba(200,245,60,0.16)" color={colors.lime}>Side-on</Chip>
          <Chip background="rgba(200,245,60,0.16)" color={colors.lime}>Full body + bar</Chip>
        </View>
      </View>

      <View style={styles.bottomOverlay}>
        <View style={styles.bottomBar}>
          <Pressable style={styles.sideButton} onPress={onOpenLibrary} disabled={isRecording}>
            <View style={styles.sideIconBox}>
              <Svg viewBox="100 110 170 340" width={30} height={30}>
                <Skeleton joints={REF_JOINTS} color={colors.muted} strokeWidth={8} glow={false} />
              </Svg>
            </View>
            <Text style={styles.sideLabel}>Upload</Text>
          </Pressable>

          <Pressable style={styles.recordButton} onPress={handlePress} disabled={isSaving}>
            <View style={isRecording ? styles.stopIcon : styles.recordIcon} />
          </Pressable>

          <Pressable style={styles.sideButton} onPress={() => setZoomedIn((z) => !z)} disabled={isRecording}>
            <View style={styles.sideIconBox}>
              <Text style={styles.zoomText}>{zoomedIn ? '2×' : '1×'}</Text>
            </View>
            <Text style={styles.sideLabel}>Zoom</Text>
          </Pressable>
        </View>
      </View>

      {isSaving && (
        <View style={styles.savingOverlay}>
          <Text style={styles.savingText}>Saving clip…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  permissionContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  permissionTitle: { color: colors.text, fontSize: 17, fontFamily: font.bold, marginBottom: 8 },
  permissionText: { color: colors.muted, fontSize: 13, fontFamily: font.regular, textAlign: 'center', lineHeight: 19 },
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 4 },
  hint: {
    alignSelf: 'center',
    color: colors.text,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    fontSize: 12,
    fontFamily: font.medium,
    maxWidth: '90%',
    textAlign: 'center',
    marginTop: 8,
  },
  tipRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 10 },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 190,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 44,
    left: 28,
    right: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sideButton: { alignItems: 'center' },
  sideIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.s3,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  zoomText: { color: colors.text, fontSize: 12, fontFamily: font.bold },
  sideLabel: { color: colors.text, fontSize: 11, fontFamily: font.medium, marginTop: 6 },
  recordButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.red },
  stopIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: colors.red },
  savingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11,13,16,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savingText: { color: colors.text, fontSize: 15, fontFamily: font.semibold },
});
