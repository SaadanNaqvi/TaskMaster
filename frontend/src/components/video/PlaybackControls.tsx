import React, { useState } from 'react';
import { GestureResponderEvent, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { VideoPlayer } from 'expo-video';
import { ApiJobResult } from '../../services/apiGateway';
import { formatTime, frameTime, seekTo, useIsPlaying, usePlaybackTime } from '../../lib/skeleton/playback';
import { PauseIcon, PlayIcon } from '../icons/MiscIcons';
import { colors, radii } from '../../theme/colors';
import { font } from '../../theme/typography';

const REWIND_SECONDS = 2;

interface Props {
  player: VideoPlayer;
  result: ApiJobResult;
}

/** Scrubber + transport for analysing a rep: drag to any moment, rewind, step single frames, and
 * jump to the bottom of the rep. Every skeleton view, graph and readout follows the player, so
 * they all land on the same frame. */
export default function PlaybackControls({ player, result }: Props) {
  const time = usePlaybackTime(player, 1 / 30);
  const playing = useIsPlaying(player);
  const [trackWidth, setTrackWidth] = useState(0);

  const fps = result.user_pose.fps;
  const lastFrameTime = frameTime(result, result.user_pose.frames.length - 1);
  const duration = player.duration > 0 ? player.duration : lastFrameTime;
  const bottomTime = frameTime(result, result.form_report.bottom_frame);
  const frame = Math.round(time * fps);
  const fraction = duration > 0 ? Math.min(1, Math.max(0, time / duration)) : 0;

  const seekToTouch = (e: GestureResponderEvent) => {
    if (trackWidth <= 0) return;
    const f = Math.min(1, Math.max(0, e.nativeEvent.locationX / trackWidth));
    seekTo(player, f * duration);
  };

  return (
    <View style={styles.wrap}>
      <View
        style={styles.trackHit}
        onLayout={(e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={seekToTouch}
        onResponderMove={seekToTouch}
      >
        <View style={styles.track} pointerEvents="none">
          <View style={[styles.fill, { width: `${fraction * 100}%` }]} />
        </View>
        {duration > 0 && (
          <View style={[styles.bottomTick, { left: `${(bottomTime / duration) * 100}%` }]} pointerEvents="none" />
        )}
        <View style={[styles.thumb, { left: `${fraction * 100}%` }]} pointerEvents="none" />
      </View>

      <View style={styles.timeRow}>
        <Text style={styles.time}>
          {formatTime(time)} / {formatTime(duration)}
        </Text>
        <Text style={styles.time}>frame {frame}</Text>
      </View>

      <View style={styles.buttons}>
        <ControlButton label={`−${REWIND_SECONDS}s`} onPress={() => player.seekBy(-Math.min(REWIND_SECONDS, player.currentTime))} />
        <ControlButton label="‹ Frame" onPress={() => seekTo(player, time - 1 / fps)} />
        <Pressable style={styles.playBtn} onPress={() => (playing ? player.pause() : player.play())} hitSlop={8}>
          {playing ? <PauseIcon size={16} color={colors.bg} /> : <PlayIcon size={16} color={colors.bg} />}
        </Pressable>
        <ControlButton label="Frame ›" onPress={() => seekTo(player, time + 1 / fps)} />
        <ControlButton label="Bottom" onPress={() => seekTo(player, bottomTime)} />
      </View>
    </View>
  );
}

function ControlButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.btn} onPress={onPress} hitSlop={6}>
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

const THUMB = 14;

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  trackHit: { height: 28, justifyContent: 'center', marginHorizontal: THUMB / 2 },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.s3, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.lime },
  bottomTick: { position: 'absolute', width: 2, height: 12, marginLeft: -1, top: 8, backgroundColor: colors.text },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    marginLeft: -THUMB / 2,
    top: (28 - THUMB) / 2,
    backgroundColor: colors.text,
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 2 },
  time: { color: colors.muted, fontSize: 11.5, fontFamily: font.medium, fontVariant: ['tabular-nums'] },
  buttons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  btn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: radii.sm, backgroundColor: colors.s2 },
  btnText: { color: colors.text, fontSize: 12, fontFamily: font.semibold },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
