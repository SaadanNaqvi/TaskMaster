import React, { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from '../icons/MiscIcons';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';

interface Props {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  transparent?: boolean;
}

export default function ScreenHeader({ title, subtitle, onBack, right, transparent }: Props) {
  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={12}
          style={[styles.back, transparent && styles.backTransparent]}
        >
          <ChevronLeft />
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}
      <View style={styles.titleWrap}>
        {!!title && <Text style={styles.title}>{title}</Text>}
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {right ?? <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 54,
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backTransparent: { backgroundColor: 'rgba(0,0,0,0.45)' },
  spacer: { width: 38 },
  titleWrap: { flex: 1, alignItems: 'center' },
  title: { color: colors.text, fontSize: 16, fontFamily: font.semibold },
  subtitle: { color: colors.muted, fontSize: 11.5, fontFamily: font.medium, marginTop: 1 },
});
