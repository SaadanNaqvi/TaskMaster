import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg from 'react-native-svg';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import { getExerciseAccent, getExerciseIcon } from '../../components/icons/ExerciseIcons';
import { useCatalogue } from '../../services/catalogue';
import { ExerciseClip, loadClips } from '../../services/clipLibrary';
import { useAnalysis } from '../../state/AnalysisContext';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import Skeleton from '../../components/anatomy/Skeleton';
import { USER_JOINTS } from '../../components/anatomy/joints';
import { ChevronRight } from '../../components/icons/MiscIcons';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function TrainScreen() {
  const router = useRouter();
  const { history } = useAnalysis();
  const { exercises, loading, error, reload } = useCatalogue();
  const [clips, setClips] = useState<ExerciseClip[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadClips().then(setClips);
    }, [])
  );

  const clipCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    clips.forEach((c) => {
      counts[c.exercise] = (counts[c.exercise] ?? 0) + 1;
    });
    return counts;
  }, [clips]);

  const latest = history[0];

  return (
    <Screen edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>T</Text>
            </View>
            <Text style={styles.brandName}>TaskMaster</Text>
          </View>
          <LinearGradient
            colors={[colors.cyan, colors.lime]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatar}
          />
        </View>

        <Text style={styles.greeting}>{greeting()}</Text>
        <Text style={styles.heading}>{'What are we\nlifting today?'}</Text>

        {latest ? (
          <Pressable onPress={() => router.push(`/results/${latest.jobId}`)}>
            <LinearGradient
              colors={['#1d2a0c', colors.s1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.scoreCard}
            >
              <Text style={styles.scoreValue}>{Math.round(latest.result.form_report.score)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.scoreTitle}>Last {latest.exerciseName.toLowerCase()} form score</Text>
                <Text style={styles.scoreSubtitle}>vs {latest.referenceName}</Text>
              </View>
              <ChevronRight color={colors.lime} />
            </LinearGradient>
          </Pressable>
        ) : (
          <Card style={styles.welcomeCard}>
            <Text style={styles.welcomeTitle}>Run your first form check</Text>
            <Text style={styles.welcomeBody}>Pick a lift below, choose who to compare against, then record a set.</Text>
          </Card>
        )}

        {loading ? (
          <ActivityIndicator color={colors.lime} style={{ marginTop: 24 }} />
        ) : error ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorTitle}>Can’t reach TaskMaster server</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <Pressable onPress={reload}>
              <Text style={styles.retryText}>Tap to retry</Text>
            </Pressable>
          </Card>
        ) : exercises.length === 0 ? (
          <Text style={styles.emptyText}>No exercises configured on the server yet.</Text>
        ) : (
          <View style={styles.grid}>
            {exercises.map((exercise) => {
              const Icon = getExerciseIcon(exercise.id);
              const accent = getExerciseAccent(exercise.id);
              const selected = latest?.exerciseId === exercise.id;
              const clipCount = clipCounts[exercise.id] ?? 0;
              return (
                <Pressable
                  key={exercise.id}
                  style={[styles.exerciseCard, selected && styles.exerciseCardSelected]}
                  onPress={() => router.push(`/reference/${exercise.id}?name=${encodeURIComponent(exercise.name)}`)}
                >
                  <View style={[styles.exerciseIconWrap, { backgroundColor: `${accent}1f` }]}>
                    <Icon color={accent} size={24} />
                  </View>
                  <View>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <Text style={styles.exerciseMeta}>
                      {clipCount} clip{clipCount === 1 ? '' : 's'} recorded · side-on
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Recent sessions</Text>
          {history.length > 0 && (
            <Pressable onPress={() => router.push('/(tabs)/history')}>
              <Text style={styles.sectionAction}>See all</Text>
            </Pressable>
          )}
        </View>

        {history.length === 0 ? (
          <Text style={styles.emptyText}>Your completed checks will show up here.</Text>
        ) : (
          <FlatList
            data={history.slice(0, 4)}
            keyExtractor={(item) => item.jobId}
            scrollEnabled={false}
            renderItem={({ item }) => {
              const score = Math.round(item.result.form_report.score);
              const scoreColor = score >= 75 ? colors.lime : score >= 60 ? colors.amber : colors.red;
              return (
                <Pressable style={styles.sessionRow} onPress={() => router.push(`/results/${item.jobId}`)}>
                  <View style={styles.sessionThumb}>
                    <Svg viewBox="100 110 170 340" width={48} height={48}>
                      <Skeleton joints={USER_JOINTS} color={colors.cyan} strokeWidth={8} glow={false} />
                    </Svg>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sessionTitle}>{item.exerciseName} vs {item.referenceName}</Text>
                    <Text style={styles.sessionSubtitle}>
                      {new Date(item.createdAt).toLocaleDateString(undefined, { weekday: 'short' })}
                    </Text>
                  </View>
                  <Text style={[styles.sessionScore, { color: scoreColor }]}>{score}</Text>
                </Pressable>
              );
            }}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandMark: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: { color: colors.bg, fontFamily: font.extrabold, fontSize: 15 },
  brandName: { color: colors.text, fontSize: 17, fontFamily: font.bold, letterSpacing: -0.3 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  greeting: { color: colors.muted, fontSize: 13, fontFamily: font.medium, marginTop: 22 },
  heading: { color: colors.text, fontSize: 30, fontFamily: font.extrabold, letterSpacing: -0.6, marginTop: 4, lineHeight: 34 },
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2e3d14',
  },
  scoreValue: { color: colors.lime, fontSize: 26, fontFamily: font.extrabold },
  scoreTitle: { color: colors.text, fontSize: 14, fontFamily: font.bold },
  scoreSubtitle: { color: colors.muted, fontSize: 11.5, fontFamily: font.medium, marginTop: 2 },
  welcomeCard: { marginTop: 18, padding: 16 },
  welcomeTitle: { color: colors.text, fontSize: 15, fontFamily: font.bold },
  welcomeBody: { color: colors.muted, fontSize: 12.5, fontFamily: font.regular, marginTop: 6, lineHeight: 18 },
  errorCard: { marginTop: 18, padding: 16 },
  errorTitle: { color: colors.red, fontSize: 14, fontFamily: font.bold },
  errorBody: { color: colors.muted, fontSize: 12, fontFamily: font.regular, marginTop: 6, lineHeight: 17 },
  retryText: { color: colors.lime, fontSize: 12.5, fontFamily: font.semibold, marginTop: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  exerciseCard: {
    width: '47.5%',
    height: 124,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.s1,
    padding: 16,
    justifyContent: 'space-between',
  },
  exerciseCardSelected: { borderWidth: 1.5, borderColor: colors.lime, backgroundColor: colors.limeDeep },
  exerciseIconWrap: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  exerciseName: { color: colors.text, fontSize: 16, fontFamily: font.bold },
  exerciseMeta: { color: colors.muted, fontSize: 11, fontFamily: font.medium, marginTop: 3 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22 },
  sectionTitle: { color: colors.text, fontSize: 17, fontFamily: font.bold },
  sectionAction: { color: colors.muted, fontSize: 13, fontFamily: font.medium },
  emptyText: { color: colors.muted, fontSize: 13, fontFamily: font.regular, marginTop: 14, lineHeight: 18 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  sessionThumb: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.s2, overflow: 'hidden' },
  sessionTitle: { color: colors.text, fontSize: 14, fontFamily: font.bold },
  sessionSubtitle: { color: colors.muted, fontSize: 11, fontFamily: font.medium, marginTop: 1 },
  sessionScore: { fontSize: 17, fontFamily: font.extrabold },
});
