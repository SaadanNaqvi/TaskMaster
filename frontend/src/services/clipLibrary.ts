import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { File } from 'expo-file-system';

/** expo-file-system's legacy API has no web implementation at all (it throws on every call),
 * so every entry point here short-circuits on web instead of crashing the screen that calls it. */
const IS_WEB = Platform.OS === 'web';

export interface ExerciseClip {
  id: string;
  /** Backend exercise id, e.g. "squat". */
  exercise: string;
  fileName: string;
  dateRecorded: string;
  durationSeconds: number;
}

const CLIPS_DIR = `${FileSystem.documentDirectory}ReferenceClips/`;
const INDEX_PATH = `${CLIPS_DIR}index.json`;

async function ensureDir(): Promise<void> {
  if (IS_WEB) return;
  const info = await FileSystem.getInfoAsync(CLIPS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CLIPS_DIR, { intermediates: true });
  }
}

export async function loadClips(): Promise<ExerciseClip[]> {
  if (IS_WEB) return [];
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

/**
 * A real `File` (from expo-file-system's modern API, not the legacy one) around a saved clip.
 * Expo's fetch/FormData implementation rejects plain `{uri,name,type}` descriptors outright
 * ("Unsupported FormDataPart implementation") — it only accepts a Blob or something with
 * `.bytes()`, which this class provides.
 */
export function clipUploadFile(clip: ExerciseClip): File {
  return new File(clipFileUri(clip));
}

/** Moves a just-recorded temp file into the library and appends it to index.json. */
export async function addClip(
  tempUri: string,
  exercise: string,
  durationSeconds: number
): Promise<ExerciseClip> {
  if (IS_WEB) throw new Error('Recording clips is not supported on web — use the Expo Go app on your phone.');
  await ensureDir();
  const sourceExt = tempUri.split('.').pop()?.toLowerCase();
  const ext = sourceExt && ['mov', 'mp4', 'm4v'].includes(sourceExt) ? sourceExt : 'mp4';
  const fileName = `${exercise}_${Date.now()}.${ext}`;
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
  if (IS_WEB) return;
  await FileSystem.deleteAsync(clipFileUri(clip), { idempotent: true });
  const clips = (await loadClips()).filter((c) => c.id !== clip.id);
  await saveClips(clips);
}
