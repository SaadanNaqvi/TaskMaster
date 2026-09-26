import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import Card from '../components/ui/Card';
import ScreenHeader from '../components/ui/ScreenHeader';
import { ShareIcon, CheckIcon } from '../components/icons/MiscIcons';
import VideoPlayerModal from '../components/VideoPlayerModal';
import { Exercise } from '../models/exercise';
import { ExerciseClip, clipFileUri, deleteClip } from '../services/clipLibrary';
import { colors } from '../theme/colors';
import { font } from '../theme/typography';

interface Props {
  exercise: Exercise;
  clips: ExerciseClip[];
  onBack: () => void;
  onDeleted: () => Promise<void> | void;
  mode?: 'view' | 'pick';
  onPick?: (clip: ExerciseClip) => void;
}

export default function ClipListScreen({ exercise, clips, onBack, onDeleted, mode = 'view', onPick }: Props) {
  const [playingUri, setPlayingUri] = useState<string | null>(null);
  const isPicking = mode === 'pick';

  return (
    <View style={styles.container}>
      <ScreenHeader onBack={onBack} title={`${exercise} clips`} subtitle={isPicking ? 'Tap a clip to use it' : undefined} />

      {clips.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {isPicking
              ? 'No saved clips for this lift yet — go back and record one instead.'
              : 'No clips yet. Record one from the camera screen.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={clips}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Card style={styles.row}>
              <Pressable
                style={styles.rowMain}
                onPress={() => (isPicking ? onPick?.(item) : setPlayingUri(clipFileUri(item)))}
              >
                <View>
                  <Text style={styles.rowTitle}>{new Date(item.dateRecorded).toLocaleString()}</Text>
                  <Text style={styles.rowSubtitle}>{item.durationSeconds.toFixed(1)}s</Text>
                </View>
                {isPicking && (
                  <View style={styles.pickBadge}>
                    <CheckIcon />
                  </View>
                )}
              </Pressable>
              {!isPicking && (
                <View style={styles.rowActions}>
                  <Pressable
                    onPress={async () => {
                      const uri = clipFileUri(item);
                      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
                    }}
                    hitSlop={10}
                  >
                    <ShareIcon size={16} color={colors.muted} />
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      await deleteClip(item);
                      await onDeleted();
                    }}
                    hitSlop={10}
                  >
                    <Text style={styles.deleteText}>Delete</Text>
                  </Pressable>
                </View>
              )}
            </Card>
          )}
        />
      )}

      <VideoPlayerModal uri={playingUri} onClose={() => setPlayingUri(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { paddingHorizontal: 20, paddingBottom: 24 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { color: colors.muted, fontSize: 13, fontFamily: font.regular, textAlign: 'center', lineHeight: 19 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 10,
  },
  rowMain: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowTitle: { color: colors.text, fontSize: 14.5, fontFamily: font.semibold },
  rowSubtitle: { color: colors.muted, fontSize: 12, fontFamily: font.medium, marginTop: 2 },
  rowActions: { flexDirection: 'row', gap: 18, alignItems: 'center', marginLeft: 12 },
  deleteText: { color: colors.red, fontSize: 13, fontFamily: font.semibold },
  pickBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
