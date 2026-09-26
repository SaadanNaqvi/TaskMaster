import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '../../theme/colors';
import { font } from '../../theme/typography';

interface Props {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}

export default function SegmentedControl({ options, value, onChange }: Props) {
  return (
    <View style={styles.track}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable key={opt} style={[styles.segment, active && styles.segmentActive]} onPress={() => onChange(opt)}>
            <Text style={[styles.label, active ? styles.labelActive : styles.labelInactive]}>{opt}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.s1,
    borderRadius: radii.sm,
    padding: 4,
  },
  segment: { flex: 1, paddingVertical: 8, borderRadius: radii.sm - 3, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.s3 },
  label: { fontSize: 13, fontFamily: font.semibold },
  labelActive: { color: colors.text },
  labelInactive: { color: colors.muted },
});
