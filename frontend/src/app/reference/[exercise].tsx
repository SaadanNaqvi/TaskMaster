import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg from 'react-native-svg';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import SegmentedControl from '../../components/ui/SegmentedControl';
import Chip from '../../components/ui/Chip';
import PrimaryButton from '../../components/ui/PrimaryButton';
import { CheckIcon } from '../../components/icons/MiscIcons';
import GymBackdrop from '../../components/anatomy/GymBackdrop';
import LifterSilhouette from '../../components/anatomy/LifterSilhouette';
import Skeleton from '../../components/anatomy/Skeleton';
import { REF_JOINTS } from '../../components/anatomy/joints';
import { getExerciseAccent } from '../../components/icons/ExerciseIcons';
import { ApiReference, getReferences, mediaUrl } from '../../services/apiGateway';
import { colors, radii } from '../../theme/colors';
import { font } from '../../theme/typography';

type Tab = 'Pro' | 'My clips';

export default function ReferencePickerScreen() {
  const { exercise, name } = useLocalSearchParams<{ exercise: string; name?: string }>();
  const router = useRouter();
  const exerciseName = name ?? exercise;
  const accent = getExerciseAccent(exercise);

  const [all, setAll] = useState<ApiReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('Pro');
  const [selectedId, setSelectedId] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    getReferences(exercise)
      .then((refs) => {
        if (cancelled) return;
        setAll(refs);
        setSelectedId(refs[0]?.id);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load references');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [exercise]);

  const visible = all.filter((r) => (tab === 'Pro' ? r.source === 'pro' : r.source === 'user'));
  const selected = all.find((r) => r.id === selectedId);

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader
        onBack={() => router.back()}
        right={
          <Chip dot={accent} background={colors.s2}>
            {exerciseName}
          </Chip>
        }
      />
      <View style={styles.pad}>
        <Text style={styles.heading}>{'Who do you want\nto move like?'}</Text>

        <View style={{ marginTop: 16 }}>
          <SegmentedControl options={['Pro', 'My clips']} value={tab} onChange={(v) => setTab(v as Tab)} />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.lime} style={{ marginTop: 32 }} />
        ) : error ? (
          <View style={{ marginTop: 24 }}>
            <Text style={styles.errorText}>Can’t reach the TaskMaster server.</Text>
            <Text style={styles.errorDetail}>{error}</Text>
          </View>
        ) : (
          <FlatList
            data={visible}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 100 }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {all.length === 0
                  ? `No references exist for ${exerciseName} yet. Seed one on the backend with scripts/add_reference.py --seed.`
                  : `No ${tab.toLowerCase()} references for ${exerciseName} yet.`}
              </Text>
            }
            renderItem={({ item }) => {
              const isSelected = item.id === selectedId;
              const thumb = mediaUrl(item.thumbnail_url);
              return (
                <Pressable
                  style={[styles.card, isSelected && styles.cardSelected]}
                  onPress={() => setSelectedId(item.id)}
                >
                  <View style={styles.thumb}>
                    {thumb ? (
                      <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    ) : (
                      <Svg viewBox="60 100 250 360" width={78} height={92} preserveAspectRatio="xMidYMid slice">
                        <GymBackdrop />
                        <LifterSilhouette joints={REF_JOINTS} />
                        <Skeleton joints={REF_JOINTS} color={isSelected ? colors.lime : colors.muted} strokeWidth={6} glow={false} />
                      </Svg>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.tagline}>{item.source === 'pro' ? 'Professional reference' : 'From your clips'}</Text>
                  </View>
                  <View style={[styles.radio, isSelected && styles.radioSelected]}>
                    {isSelected && <CheckIcon />}
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </View>

      {selected && (
        <View style={styles.footer}>
          <PrimaryButton
            label={`Continue with ${selected.name.split(' ')[0]} →`}
            onPress={() =>
              router.push(
                `/record/${exercise}?referenceId=${selected.id}&referenceName=${encodeURIComponent(selected.name)}&exerciseName=${encodeURIComponent(exerciseName)}`
              )
            }
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { flex: 1, paddingHorizontal: 20 },
  heading: { color: colors.text, fontSize: 26, fontFamily: font.extrabold, letterSpacing: -0.4, marginTop: 6, lineHeight: 31 },
  emptyText: { color: colors.muted, fontSize: 13, fontFamily: font.regular, marginTop: 24, textAlign: 'center', lineHeight: 19 },
  errorText: { color: colors.red, fontSize: 14, fontFamily: font.bold },
  errorDetail: { color: colors.muted, fontSize: 12, fontFamily: font.regular, marginTop: 6 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    marginTop: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.s1,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardSelected: { borderWidth: 1.5, borderColor: colors.lime },
  thumb: { width: 78, height: 92, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.s2 },
  name: { color: colors.text, fontSize: 15, fontFamily: font.bold },
  tagline: { color: colors.muted, fontSize: 11.5, fontFamily: font.medium, marginTop: 3 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3a404a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { backgroundColor: colors.lime, borderWidth: 0 },
  footer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 32,
  },
});
