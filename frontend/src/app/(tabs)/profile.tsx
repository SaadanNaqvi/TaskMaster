import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Card from '../../components/ui/Card';
import { loadClips } from '../../services/clipLibrary';
import { useAnalysis } from '../../state/AnalysisContext';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';

export default function ProfileScreen() {
  const { history } = useAnalysis();
  const [clipCount, setClipCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadClips().then((clips) => setClipCount(clips.length));
    }, [])
  );

  const bestScore = Math.round(history.reduce((max, h) => Math.max(max, h.result.form_report.score), 0));
  const exerciseCounts = history.reduce<Record<string, number>>((acc, h) => {
    acc[h.exerciseName] = (acc[h.exerciseName] ?? 0) + 1;
    return acc;
  }, {});
  const topExercise = Object.entries(exerciseCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Profile" />
      <ScrollView contentContainerStyle={styles.pad} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarRow}>
          <LinearGradient colors={[colors.cyan, colors.lime]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
            <Text style={styles.avatarInitial}>S</Text>
          </LinearGradient>
          <View>
            <Text style={styles.name}>Saadan</Text>
            <Text style={styles.handle}>Lifting since this session</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{history.length}</Text>
            <Text style={styles.statLabel}>Checks run</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{clipCount}</Text>
            <Text style={styles.statLabel}>Clips saved</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.lime }]}>{bestScore || '—'}</Text>
            <Text style={styles.statLabel}>Best score</Text>
          </Card>
        </View>

        <Card style={styles.infoCard}>
          <Text style={styles.infoLabel}>Most trained lift</Text>
          <Text style={styles.infoValue}>{topExercise}</Text>
        </Card>

        <Card style={styles.infoCard}>
          <Text style={styles.infoLabel}>About TaskMaster</Text>
          <Text style={styles.infoBody}>
            Record a set, pick a professional or a friend to compare against, and see exactly where your form
            differs — joint by joint, rep by rep.
          </Text>
          <Text style={styles.version}>Version {Constants.expoConfig?.version ?? '1.0.0'}</Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 20, paddingBottom: 40 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: colors.bg, fontSize: 26, fontFamily: font.extrabold },
  name: { color: colors.text, fontSize: 19, fontFamily: font.bold },
  handle: { color: colors.muted, fontSize: 12.5, fontFamily: font.medium, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 22 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statValue: { color: colors.text, fontSize: 22, fontFamily: font.extrabold },
  statLabel: { color: colors.muted, fontSize: 11, fontFamily: font.medium, marginTop: 4, textAlign: 'center' },
  infoCard: { padding: 16, marginTop: 14 },
  infoLabel: { color: colors.muted, fontSize: 11.5, fontFamily: font.semibold },
  infoValue: { color: colors.text, fontSize: 17, fontFamily: font.bold, marginTop: 4 },
  infoBody: { color: colors.text, fontSize: 13, fontFamily: font.regular, lineHeight: 19, marginTop: 4 },
  version: { color: colors.mutedDim, fontSize: 11, fontFamily: font.medium, marginTop: 12 },
});
