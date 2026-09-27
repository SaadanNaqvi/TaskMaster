import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VideoPlayer, VideoView } from 'expo-video';
import { ApiJobResult } from '../../services/apiGateway';
import { SkeletonOverlay } from '../skeleton/SkeletonCompare';
import FrameReadout from '../skeleton/FrameReadout';
import PlaybackControls from './PlaybackControls';
import { CloseIcon, PlayIcon } from '../icons/MiscIcons';
import { useIsPlaying } from '../../lib/skeleton/playback';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';

interface Props {
  visible: boolean;
  onClose: () => void;
  player: VideoPlayer;
  result: ApiJobResult;
  showSkeleton: boolean;
}

/** Full-screen analysis: the whole video frame (contain, not cropped), the skeleton overlay, the
 * transport controls, and this frame's angles underneath. Shares the results screen's player, so
 * position and play state carry over both ways — the caller must unmount its own inline VideoView
 * while this is open, since a player drives one view at a time. */
export default function FullscreenAnalysis({ visible, onClose, player, result, showSkeleton }: Props) {
  const playing = useIsPlaying(player);

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>{showSkeleton ? 'Skeleton comparison' : 'Video'}</Text>
          <Pressable onPress={onClose} hitSlop={12} style={styles.close}>
            <CloseIcon size={18} />
          </Pressable>
        </View>

        <Pressable style={styles.video} onPress={() => (playing ? player.pause() : player.play())}>
          <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
          {showSkeleton && <SkeletonOverlay result={result} player={player} fit="contain" />}
          {!playing && (
            <View style={styles.playBadge} pointerEvents="none">
              <PlayIcon size={20} />
            </View>
          )}
        </Pressable>

        <View style={styles.controls}>
          <PlaybackControls player={player} result={result} />
        </View>
        <ScrollView style={styles.readout} contentContainerStyle={styles.readoutContent}>
          <FrameReadout result={result} player={player} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  title: { color: colors.text, fontSize: 15, fontFamily: font.bold },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.s2, alignItems: 'center', justifyContent: 'center' },
  video: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  playBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: { paddingHorizontal: 16, paddingTop: 10 },
  readout: { maxHeight: 190, marginTop: 6 },
  readoutContent: { paddingHorizontal: 16, paddingBottom: 8 },
});
