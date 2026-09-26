import React, { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as Sharing from 'expo-sharing';
import { Exercise } from '../models/exercise';
import { ExerciseClip, clipFileUri, deleteClip } from '../services/clipLibrary';

interface Props {
  exercise: Exercise;
  clips: ExerciseClip[];
  onBack: () => void;
  onDeleted: () => Promise<void> | void;
}

export default function ClipListScreen({ exercise, clips, onBack, onDeleted }: Props) {
  const [playingClip, setPlayingClip] = useState<ExerciseClip | null>(null);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.backText}>{'‹ Back'}</Text>
        </Pressable>
        <Text style={styles.title}>{exercise} Clips</Text>
        <View style={styles.topBarSpacer} />
      </View>

      {clips.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No clips yet. Record one from the camera screen.</Text>
        </View>
      ) : (
        <FlatList
          data={clips}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => setPlayingClip(item)}>
              <View>
                <Text style={styles.rowTitle}>{new Date(item.dateRecorded).toLocaleString()}</Text>
                <Text style={styles.rowSubtitle}>{item.durationSeconds.toFixed(1)}s</Text>
              </View>
              <View style={styles.rowActions}>
                <Pressable
                  onPress={async () => {
                    const uri = clipFileUri(item);
                    if (await Sharing.isAvailableAsync()) {
                      await Sharing.shareAsync(uri);
                    }
                  }}
                  hitSlop={12}
                >
                  <Text style={styles.shareText}>Share</Text>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    await deleteClip(item);
                    await onDeleted();
                  }}
                  hitSlop={12}
                >
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </View>
            </Pressable>
          )}
        />
      )}

      <Modal visible={!!playingClip} animationType="slide" onRequestClose={() => setPlayingClip(null)}>
        {playingClip && (
          <ClipPlayer uri={clipFileUri(playingClip)} onClose={() => setPlayingClip(null)} />
        )}
      </Modal>
    </View>
  );
}

function ClipPlayer({ uri, onClose }: { uri: string; onClose: () => void }) {
  const player = useVideoPlayer(uri, (p) => {
    p.play();
  });

  return (
    <View style={styles.playerContainer}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" />
      <Pressable style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeText}>Close</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  topBarSpacer: { width: 50 },
  backText: { fontSize: 16, color: '#007AFF' },
  title: { fontSize: 17, fontWeight: '600' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: '#666', textAlign: 'center' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  rowTitle: { fontSize: 15, fontWeight: '500' },
  rowSubtitle: { fontSize: 13, color: '#666', marginTop: 2 },
  rowActions: { flexDirection: 'row', gap: 20 },
  shareText: { color: '#007AFF', fontSize: 14 },
  deleteText: { color: '#FF3B30', fontSize: 14 },
  playerContainer: { flex: 1, backgroundColor: '#000' },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  closeText: { color: '#fff', fontSize: 14 },
});
