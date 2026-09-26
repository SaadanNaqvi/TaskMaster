import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { EXERCISES, Exercise } from '../models/exercise';
import { ExerciseClip } from '../services/clipLibrary';

interface Props {
  clips: ExerciseClip[];
  onSelectExercise: (exercise: Exercise) => void;
}

export default function ExerciseListScreen({ clips, onSelectExercise }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reference Library</Text>
      <FlatList
        data={EXERCISES}
        keyExtractor={(item) => item}
        renderItem={({ item }) => {
          const count = clips.filter((c) => c.exercise === item).length;
          return (
            <Pressable style={styles.row} onPress={() => onSelectExercise(item)}>
              <View>
                <Text style={styles.rowTitle}>{item}</Text>
                <Text style={styles.rowSubtitle}>{count} clip(s)</Text>
              </View>
              <Text style={styles.chevron}>{'›'}</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 12 },
  title: { fontSize: 28, fontWeight: '700', paddingHorizontal: 16, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  rowTitle: { fontSize: 17, fontWeight: '600' },
  rowSubtitle: { fontSize: 13, color: '#666', marginTop: 2 },
  chevron: { fontSize: 22, color: '#999' },
});
