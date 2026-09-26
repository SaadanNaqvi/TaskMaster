import type { File } from 'expo-file-system';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

/** Backend returns root-relative paths like "/files/library/x/thumb.jpg" — resolve them against the API host. */
export function mediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

export type ApiCategory = {
  id: string;
  name: string;
};

export type ApiExercise = {
  id: string;
  name: string;
  category: string;
};

export type ApiReference = {
  id: string;
  name: string;
  exercise: string;
  source: 'pro' | 'user';
  video_url: string;
  thumbnail_url: string;
};

export type ApiJobStatus = {
  job_id: string;
  status: 'queued' | 'preparing' | 'extracting' | 'syncing' | 'scoring' | 'done' | 'failed';
  progress: number;
  error?: string | null;
  exercise?: string | null;
  reference_id?: string | null;
  created_at: string;
};

export type ApiFormFlag = {
  frame: number;
  joint: string;
  diff_deg: number;
  message: string;
};

export type ApiFormReport = {
  score: number;
  per_joint: Record<string, { max_diff_deg: number; frames_flagged: number[] }>;
  flags: ApiFormFlag[];
};

export type ApiJobResult = {
  job_id: string;
  video_url: string;
  form_report: ApiFormReport;
  user_pose: unknown;
  ref_pose: unknown;
  alignment: unknown[];
  exercise: string;
};

export class ApiRequestError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.error?.message === 'string' ? payload.error.message : 'Request failed';
    const code = typeof payload?.error?.code === 'string' ? payload.error.code : undefined;
    throw new ApiRequestError(message, code, response.status);
  }
  return payload as T;
}

export async function getCategories(): Promise<ApiCategory[]> {
  const response = await fetch(`${API_BASE_URL}/exercises`);
  return parseJson<ApiCategory[]>(response);
}

export async function getExercisesInCategory(categoryId: string): Promise<ApiExercise[]> {
  const response = await fetch(`${API_BASE_URL}/exercises/${encodeURIComponent(categoryId)}`);
  return parseJson<ApiExercise[]>(response);
}

export async function getReferences(exercise: string): Promise<ApiReference[]> {
  const response = await fetch(`${API_BASE_URL}/references?exercise=${encodeURIComponent(exercise)}`);
  return parseJson<ApiReference[]>(response);
}

export async function createJob(video: File, exercise: string, referenceId: string): Promise<{ job_id: string }> {
  const form = new FormData();
  // Expo's fetch/FormData only accepts a real Blob-like (has .bytes()) — a plain {uri,name,type}
  // descriptor throws "Unsupported FormDataPart implementation".
  form.append('video', video as unknown as Blob);
  form.append('exercise', exercise);
  form.append('reference_id', referenceId);

  const response = await fetch(`${API_BASE_URL}/jobs`, {
    method: 'POST',
    body: form,
  });

  return parseJson<{ job_id: string }>(response);
}

export async function getJobStatus(jobId: string): Promise<ApiJobStatus> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`);
  return parseJson<ApiJobStatus>(response);
}

export async function getJobResult(jobId: string): Promise<ApiJobResult> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/result`);
  return parseJson<ApiJobResult>(response);
}

export async function createReference(jobId: string, name: string, consent: boolean): Promise<ApiReference> {
  const response = await fetch(`${API_BASE_URL}/references`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ job_id: jobId, name, consent }),
  });

  return parseJson<ApiReference>(response);
}
