import { useEffect, useState } from 'react';
import { useEvent } from 'expo';
import { VideoPlayer } from 'expo-video';
import { ApiJobResult } from '../../services/apiGateway';

/** The player's current time in seconds, polled once per animation frame so seeks while paused are
 * picked up too (timeUpdate events don't reliably fire for those). Re-renders only when it moves by
 * more than `step` seconds. */
export function usePlaybackTime(player: VideoPlayer, step = 1 / 60): number {
  const [time, setTime] = useState(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const t = player.currentTime ?? 0;
      setTime((prev) => (Math.abs(prev - t) >= step ? t : prev));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [player, step]);
  return time;
}

export function useIsPlaying(player: VideoPlayer): boolean {
  return useEvent(player, 'playingChange', { isPlaying: player.playing }).isPlaying;
}

/** Index into result.alignment / form_report.frames for a playback time. */
export function comparisonIndexAt(result: ApiJobResult, time: number): number {
  const count = result.alignment.length;
  const first = result.alignment[0]?.user_frame ?? 0;
  const userFrame = Math.round(time * result.user_pose.fps);
  return Math.min(Math.max(userFrame - first, 0), Math.max(count - 1, 0));
}

export function useComparisonIndex(result: ApiJobResult, player: VideoPlayer): number {
  return comparisonIndexAt(result, usePlaybackTime(player));
}

/** Time in seconds of a user video frame. */
export function frameTime(result: ApiJobResult, frame: number): number {
  return result.user_pose.frames[frame]?.t ?? frame / result.user_pose.fps;
}

/** Pauses and jumps to `seconds` (clamped to the clip). seekBy rather than assigning currentTime,
 * which the React Compiler lint rejects as mutating a hook's return value. */
export function seekTo(player: VideoPlayer, seconds: number) {
  const end = player.duration > 0 ? player.duration : seconds;
  player.pause();
  player.seekBy(Math.min(Math.max(seconds, 0), end) - player.currentTime);
}

/** e.g. 1.234 -> "0:01.2" */
export function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rest = (s - m * 60).toFixed(1).padStart(4, '0');
  return `${m}:${rest}`;
}
