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
  /** SMPL/ROMP pose sequence URL for the 3D mesh overlay — absent if extraction wasn't run or failed. */
  smpl_pose_url?: string | null;
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

/** One joint's user-minus-reference angle difference in degrees — backend/app/schemas.py::JointDelta.
 * Positive means the user's angle is larger (e.g. knee straighter); null where it wasn't measurable. */
export type ApiJointDelta = {
  delta_at_bottom: number | null;
  user_at_bottom: number | null;
  ref_at_bottom: number | null;
  max_delta: number | null;
  max_delta_frame: number | null;
  measured_fraction: number;
  message: string | null;
};

export type ApiFrameDelta = {
  user_frame: number;
  ref_frame: number;
  deltas: Record<string, number | null>;
  /** Raw angles behind each delta, for graphing. `ref` is the reference joint on the same side of
   * the picture as the user's (see backend score()). */
  user: Record<string, number | null>;
  ref: Record<string, number | null>;
};

/** backend/app/schemas.py::FormReport — the skeleton angle comparison. No overall score by design.
 * Joint keys are 'trunk' plus e.g. 'knee_l' / 'knee_r' (the user's own left and right). */
export type ApiFormReport = {
  user_side: 'left' | 'right';
  ref_side: 'left' | 'right';
  bottom_frame: number;
  /** Ordered by largest |max_delta| first, unmeasurable joints last. */
  per_joint: Record<string, ApiJointDelta>;
  frames: ApiFrameDelta[];
};

/** backend/app/schemas.py::AlignmentFrame — a reference landmark p maps onto the user's video at
 * anchor + scale * (p - ref_anchor), with its x offset negated first when mirror is set. */
export type ApiAlignmentFrame = {
  user_frame: number;
  ref_frame: number;
  anchor: [number, number];
  ref_anchor: [number, number];
  scale: number;
  mirror: boolean;
};

/** One frame of MediaPipe's 33-landmark pose (pixel coords, matching the video it was extracted
 * from) — backend/app/schemas.py::PoseFrame. */
export type ApiPoseFrame = {
  t: number;
  landmarks: (number[] | null)[];
};

/** backend/app/schemas.py::PoseSequence. */
export type ApiPoseSequence = {
  fps: number;
  width: number;
  height: number;
  frames: ApiPoseFrame[];
};

export type ApiJobResult = {
  job_id: string;
  video_url: string;
  feedback: string;
  form_report: ApiFormReport;
  user_pose: ApiPoseSequence;
  ref_pose: ApiPoseSequence;
  alignment: ApiAlignmentFrame[];
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
