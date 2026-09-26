import { createJob } from './apiGateway';
import { clipUploadFile, ExerciseClip } from './clipLibrary';

/** Uploads a locally saved clip to the backend and kicks off a processing job. */
export async function startJobFromClip(clip: ExerciseClip, referenceId: string): Promise<string> {
  const { job_id } = await createJob(clipUploadFile(clip), clip.exercise, referenceId);
  return job_id;
}
