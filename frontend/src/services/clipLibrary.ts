import * as FileSystem from 'expo-file-system/legacy';
import { Exercise } from '../models/exercise';

export interface ExerciseClip {
  id: string;
  exercise: Exercise;
  fileName: string;
  dateRecorded: string;
  durationSeconds: number;
}

const CLIPS_DIR = `${FileSystem.documentDirectory}ReferenceClips/`;
const INDEX_PATH = `${CLIPS_DIR}index.json`;

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(CLIPS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CLIPS_DIR, { intermediates: true });
  }
}

export async function loadClips(): Promise<ExerciseClip[]> {
  await ensureDir();
  const info = await FileSystem.getInfoAsync(INDEX_PATH);
  if (!info.exists) return [];
  const raw = await FileSystem.readAsStringAsync(INDEX_PATH);
  try {
    return JSON.parse(raw) as ExerciseClip[];
  } catch {
    return [];
  }
}

async function saveClips(clips: ExerciseClip[]): Promise<void> {
  await FileSystem.writeAsStringAsync(INDEX_PATH, JSON.stringify(clips, null, 2));
}

export function clipFileUri(clip: ExerciseClip): string {
  return `${CLIPS_DIR}${clip.fileName}`;
}

/** Moves a just-recorded temp file into the library and appends it to index.json. */
export async function addClip(
  tempUri: string,
  exercise: Exercise,
  durationSeconds: number
): Promise<ExerciseClip> {
  await ensureDir();
  const fileName = `${exercise.replace(/\s+/g, '_')}_${Date.now()}.mov`;
  const destination = `${CLIPS_DIR}${fileName}`;
  await FileSystem.moveAsync({ from: tempUri, to: destination });

  const clip: ExerciseClip = {
    id: `${Date.now()}`,
    exercise,
    fileName,
    dateRecorded: new Date().toISOString(),
    durationSeconds,
  };

  const clips = await loadClips();
  clips.push(clip);
  await saveClips(clips);
  return clip;
}

export async function deleteClip(clip: ExerciseClip): Promise<void> {
  await FileSystem.deleteAsync(clipFileUri(clip), { idempotent: true });
  const clips = (await loadClips()).filter((c) => c.id !== clip.id);
  await saveClips(clips);
}
