import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { colors, radii } from '../../theme/colors';

export default function Card({ style, ...rest }: ViewProps) {
  return <View style={[styles.card, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.s1,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
