import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

interface Props {
  /** Whether the subject/phone is well-positioned — brightens the capsule border when true. */
  isGoodFraming?: boolean;
}

/**
 * Rule-of-thirds + a side-on framing capsule + floor line, styled to match the reference mockup.
 * The area outside the capsule is masked out to make it visually unambiguous that only that zone
 * is what gets analysed — everything outside it is dead space to the pipeline.
 */
export default function FramingGuideOverlay({ isGoodFraming = true }: Props) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.maskTop} />
      <View style={styles.maskBottom} />
      <View style={styles.maskLeft} />
      <View style={styles.maskRight} />

      <View
        style={[
          styles.capsule,
          { borderColor: isGoodFraming ? colors.lime : colors.amber, opacity: isGoodFraming ? 0.7 : 0.9 },
        ]}
      />
      <View style={[styles.vLine, { left: '33.333%' }]} />
      <View style={[styles.vLine, { left: '50%', opacity: 0.32 }]} />
      <View style={[styles.vLine, { left: '66.666%' }]} />
      <View style={[styles.hLine, { top: '33.333%' }]} />
      <View style={[styles.hLine, { top: '66.666%' }]} />
      <View style={styles.floorLine} />
    </View>
  );
}

const MASK_COLOR = 'rgba(0,0,0,0.55)';

const styles = StyleSheet.create({
  maskTop: { position: 'absolute', top: 0, left: 0, right: 0, height: '30%', backgroundColor: MASK_COLOR },
  maskBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '18%', backgroundColor: MASK_COLOR },
  maskLeft: { position: 'absolute', top: '30%', bottom: '18%', left: 0, width: '24%', backgroundColor: MASK_COLOR },
  maskRight: { position: 'absolute', top: '30%', bottom: '18%', right: 0, width: '24%', backgroundColor: MASK_COLOR },
  capsule: {
    position: 'absolute',
    left: '24%',
    right: '24%',
    top: '30%',
    bottom: '18%',
    borderRadius: 999,
    borderWidth: 2.5,
    borderStyle: 'dashed',
  },
  vLine: {
    position: 'absolute',
    top: '30%',
    bottom: '18%',
    left: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  hLine: {
    position: 'absolute',
    left: '24%',
    right: '24%',
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
