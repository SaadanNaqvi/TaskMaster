import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { colors } from '../theme/colors';
import { font } from '../theme/typography';

interface Props {
  uri: string | null;
  onClose: () => void;
}

export default function VideoPlayerModal({ uri, onClose }: Props) {
  return (
    <Modal visible={!!uri} animationType="slide" onRequestClose={onClose}>
      {uri && <Player uri={uri} onClose={onClose} />}
    </Modal>
  );
}

function Player({ uri, onClose }: { uri: string; onClose: () => void }) {
  const player = useVideoPlayer(uri, (p) => {
    p.play();
  });

  return (
    <View style={styles.container}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" />
      <Pressable style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeText}>Close</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  closeText: { color: colors.text, fontSize: 14, fontFamily: font.semibold },
});
