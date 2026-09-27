import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '../../theme/colors';
import { font } from '../../theme/typography';

interface Props {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  /** Options shown greyed out and not selectable. */
  disabled?: string[];
}

export default function SegmentedControl({ options, value, onChange, disabled = [] }: Props) {
  return (
    <View style={styles.track}>
      {options.map((opt) => {
        const active = opt === value;
        const off = disabled.includes(opt);
        return (
          <Pressable
            key={opt}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(opt)}
            disabled={off}
          >
            <Text style={[styles.label, active ? styles.labelActive : off ? styles.labelDisabled : styles.labelInactive]}>{opt}</Text>
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
  labelDisabled: { color: colors.mutedDim },
});
