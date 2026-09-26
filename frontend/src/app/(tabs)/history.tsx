import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg from 'react-native-svg';
import * as Sharing from 'expo-sharing';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Card from '../../components/ui/Card';
import { ShareIcon } from '../../components/icons/MiscIcons';
import Skeleton from '../../components/anatomy/Skeleton';
import { USER_JOINTS } from '../../components/anatomy/joints';
import VideoPlayerModal from '../../components/VideoPlayerModal';
import { ExerciseClip, clipFileUri, loadClips } from '../../services/clipLibrary';
import { useAnalysis } from '../../state/AnalysisContext';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';

export default function HistoryScreen() {
  const router = useRouter();
  const { history } = useAnalysis();
  const [clips, setClips] = useState<ExerciseClip[]>([]);
  const [playingUri, setPlayingUri] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadClips().then((all) => setClips([...all].sort((a, b) => b.dateRecorded.localeCompare(a.dateRecorded))));
    }, [])
  );

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="History" />
      <FlatList
        contentContainerStyle={styles.pad}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <Text style={styles.sectionTitle}>Checked sessions</Text>
            {history.length === 0 ? (
              <Text style={styles.emptyText}>Sessions you run through the full form check show up here.</Text>
            ) : (
              history.map((item) => {
                const scoreColor = item.overallScore >= 75 ? colors.lime : item.overallScore >= 60 ? colors.amber : colors.red;
                return (
                  <Pressable
                    key={item.id}
                    style={styles.sessionRow}
                    onPress={() =>
                      router.push(`/results/${encodeURIComponent(item.exercise)}?referenceId=${item.reference.id}&clipId=${encodeURIComponent(item.id)}`)
                    }
                  >
                    <View style={styles.sessionThumb}>
                      <Svg viewBox="100 110 170 340" width={44} height={44}>
                        <Skeleton joints={USER_JOINTS} color={colors.cyan} strokeWidth={7} glow={false} />
                      </Svg>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sessionTitle}>{item.exercise} vs {item.reference.name}</Text>
                      <Text style={styles.sessionSubtitle}>{new Date(item.createdAt).toLocaleString()} · {item.repCount} reps</Text>
                    </View>
                    <Text style={[styles.sessionScore, { color: scoreColor }]}>{item.overallScore}</Text>
                  </Pressable>
                );
              })
            )}

            <Text style={styles.sectionTitle}>Recorded clips</Text>
            {clips.length === 0 && <Text style={styles.emptyText}>Clips you record from the camera screen show up here.</Text>}
          </>
        }
        data={clips}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={null}
        renderItem={({ item }) => (
          <Card style={styles.clipRow}>
            <Pressable style={styles.clipMain} onPress={() => setPlayingUri(clipFileUri(item))}>
              <View>
                <Text style={styles.clipTitle}>{item.exercise}</Text>
                <Text style={styles.clipSubtitle}>
                  {new Date(item.dateRecorded).toLocaleString()} · {item.durationSeconds.toFixed(1)}s
                </Text>
              </View>
            </Pressable>
            <Pressable
              hitSlop={10}
              onPress={async () => {
                const uri = clipFileUri(item);
                if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
              }}
            >
              <ShareIcon size={17} color={colors.muted} />
            </Pressable>
          </Card>
        )}
      />
      <VideoPlayerModal uri={playingUri} onClose={() => setPlayingUri(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionTitle: { color: colors.text, fontSize: 16, fontFamily: font.bold, marginTop: 18, marginBottom: 4 },
  emptyText: { color: colors.muted, fontSize: 12.5, fontFamily: font.regular, marginTop: 8, lineHeight: 18 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  sessionThumb: { width: 44, height: 44, borderRadius: 11, backgroundColor: colors.s2, overflow: 'hidden' },
  sessionTitle: { color: colors.text, fontSize: 13.5, fontFamily: font.bold },
  sessionSubtitle: { color: colors.muted, fontSize: 11, fontFamily: font.medium, marginTop: 1 },
  sessionScore: { fontSize: 16, fontFamily: font.extrabold },
  clipRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, marginTop: 10 },
  clipMain: { flex: 1 },
  clipTitle: { color: colors.text, fontSize: 14, fontFamily: font.bold },
  clipSubtitle: { color: colors.muted, fontSize: 11.5, fontFamily: font.medium, marginTop: 2 },
});
