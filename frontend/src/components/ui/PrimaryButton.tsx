import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, radii } from '../../theme/colors';
import { font } from '../../theme/typography';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  variant?: 'primary' | 'secondary';
}

export default function PrimaryButton({ label, onPress, disabled, loading, style, variant = 'primary' }: Props) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        isPrimary ? styles.primary : styles.secondary,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.bg : colors.text} />
      ) : (
        <Text style={[styles.label, isPrimary ? styles.primaryLabel : styles.secondaryLabel]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 54,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primary: { backgroundColor: colors.lime },
  secondary: { backgroundColor: colors.s2, borderWidth: 1, borderColor: colors.border },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.85 },
  label: { fontSize: 16, fontFamily: font.bold },
  primaryLabel: { color: colors.bg },
  secondaryLabel: { color: colors.text },
});
