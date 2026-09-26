import React, { ReactNode } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radii } from '../../theme/colors';
import { font } from '../../theme/typography';

interface Props {
  children: ReactNode;
  color?: string;
  background?: string;
  style?: ViewStyle;
  dot?: string;
}

export default function Chip({ children, color = colors.text, background = colors.s2, style, dot }: Props) {
  return (
    <View style={[styles.chip, { backgroundColor: background }, style]}>
      {dot && <View style={[styles.dot, { backgroundColor: dot }]} />}
      <Text style={[styles.text, { color }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 12, fontFamily: font.semibold },
});
