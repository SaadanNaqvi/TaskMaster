const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

export type ApiExercise = {
  id: string;
  name: string;
  category?: string;
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

export type ApiJobResult = {
  job_id: string;
  video_url: string;
  form_report: unknown;
  user_pose: unknown;
  ref_pose: unknown;
  alignment: unknown[];
  exercise: string;
};

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.error?.message === 'string' ? payload.error.message : 'Request failed';
    throw new Error(message);
  }
  return payload as T;
}

export async function getExercises(): Promise<ApiExercise[]> {
  const response = await fetch(`${API_BASE_URL}/exercises`);
  return parseJson<ApiExercise[]>(response);
}

export async function getReferences(exercise: string): Promise<ApiReference[]> {
  const response = await fetch(`${API_BASE_URL}/references?exercise=${encodeURIComponent(exercise)}`);
  return parseJson<ApiReference[]>(response);
}

export async function createJob(video: Blob | File, exercise: string, referenceId: string): Promise<{ job_id: string }> {
  const form = new FormData();
  form.append('video', video, video.name || 'video.mp4');
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
