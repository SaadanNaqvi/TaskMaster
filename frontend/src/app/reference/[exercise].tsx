import React, { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { EXERCISES, Exercise } from '../../models/exercise';
import { EXERCISE_ACCENTS } from '../../components/icons/ExerciseIcons';
import { ReferenceCategory, referencesFor } from '../../models/reference';
import { colors, radii } from '../../theme/colors';
import { font } from '../../theme/typography';

const CATEGORIES: ReferenceCategory[] = ['Pros', 'Friends', 'My best'];

export default function ReferencePickerScreen() {
  const { exercise: exerciseParam } = useLocalSearchParams<{ exercise: string }>();
  const router = useRouter();
  const exercise = (EXERCISES.find((e) => e === exerciseParam) ?? EXERCISES[0]) as Exercise;
  const all = useMemo(() => referencesFor(exercise), [exercise]);

  const [category, setCategory] = useState<ReferenceCategory>('Pros');
  const [selectedId, setSelectedId] = useState(all[0]?.id);

  const visible = all.filter((r) => r.category === category);
  const selected = all.find((r) => r.id === selectedId);
  const accent = EXERCISE_ACCENTS[exercise];

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader
        onBack={() => router.back()}
        right={
          <Chip dot={accent} background={colors.s2}>
            {exercise}
          </Chip>
        }
      />
      <View style={styles.pad}>
        <Text style={styles.heading}>{'Who do you want\nto move like?'}</Text>

        <View style={{ marginTop: 16 }}>
          <SegmentedControl options={CATEGORIES} value={category} onChange={(v) => setCategory(v as ReferenceCategory)} />
        </View>

        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 100 }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No {category.toLowerCase()} saved for {exercise} yet.</Text>
          }
          renderItem={({ item }) => {
            const isSelected = item.id === selectedId;
            return (
              <Pressable
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => setSelectedId(item.id)}
              >
                <View style={styles.thumb}>
                  <Svg viewBox="60 100 250 360" width={78} height={92} preserveAspectRatio="xMidYMid slice">
                    <GymBackdrop />
                    <LifterSilhouette joints={REF_JOINTS} />
                    <Skeleton joints={REF_JOINTS} color={isSelected ? colors.lime : colors.muted} strokeWidth={6} glow={false} />
                  </Svg>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.tagline}>{item.tagline}</Text>
                  <Text style={styles.meta}>{item.meta}</Text>
                </View>
                <View style={[styles.radio, isSelected && styles.radioSelected]}>
                  {isSelected && <CheckIcon />}
                </View>
              </Pressable>
            );
          }}
        />
      </View>

      {selected && (
        <View style={styles.footer}>
          <PrimaryButton
            label={`Continue with ${selected.name.split(' ')[0]} →`}
            onPress={() =>
              router.push(`/record/${encodeURIComponent(exercise)}?referenceId=${selected.id}`)
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
  emptyText: { color: colors.muted, fontSize: 13, fontFamily: font.regular, marginTop: 24, textAlign: 'center' },
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
  thumb: { width: 78, height: 92, borderRadius: 12, overflow: 'hidden' },
  name: { color: colors.text, fontSize: 15, fontFamily: font.bold },
  tagline: { color: colors.muted, fontSize: 11.5, fontFamily: font.medium, marginTop: 3 },
  meta: { color: '#C5CBD3', fontSize: 11.5, fontFamily: font.medium, marginTop: 8 },
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
