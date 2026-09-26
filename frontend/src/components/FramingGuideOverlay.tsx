import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

/** Rule-of-thirds + a side-on framing capsule + floor line, styled to match the reference mockup. */
export default function FramingGuideOverlay() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.capsule} />
      <View style={[styles.vLine, { left: '33.333%' }]} />
      <View style={[styles.vLine, { left: '50%', opacity: 0.32 }]} />
      <View style={[styles.vLine, { left: '66.666%' }]} />
      <View style={[styles.hLine, { top: '33.333%' }]} />
      <View style={[styles.hLine, { top: '66.666%' }]} />
      <View style={styles.floorLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  capsule: {
    position: 'absolute',
    left: '24%',
    right: '24%',
    top: '30%',
    bottom: '18%',
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: colors.lime,
    borderStyle: 'dashed',
    opacity: 0.7,
  },
  vLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  hLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  floorLine: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    bottom: '18%',
    height: 2,
    backgroundColor: colors.lime,
    opacity: 0.8,
  },
});
