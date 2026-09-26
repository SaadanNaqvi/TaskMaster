# TaskMaster: Tech Stack and Module Split

Sep 26, 2026 · @Tony

## Overview

A web app where a user picks an exercise, uploads a side-on video of themselves doing it, picks a reference (a pro or another user), and gets back their video with the reference skeleton overlaid, anchored to their body and synced rep by rep, with joints that deviate highlighted.

End-to-end pipeline:

1. **Upload**: user picks exercise + reference, uploads video (web frontend).
2. **Pose extraction**: MediaPipe runs on every frame and outputs 33 landmarks per frame as JSON.
3. **Rep segmentation**: split the user's pose series into individual reps.
4. **Temporal sync**: match each user rep to the reference rep with DTW, producing a frame-to-frame mapping.
5. **Spatial alignment**: anchor the reference skeleton at the user's hip midpoint, scale by torso length only.
6. **Form scoring**: joint-angle differences per frame, flag anything past a threshold.
7. **Render**: draw the reference skeleton (and later the ghost cutout) onto the user's video, output mp4 + score JSON.
8. **Results view**: play the video, show the flagged moments and per-joint feedback.

Reference clips go through steps 2, 3 (and the optional cutout) once, offline, and are stored in the library.

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | React + Vite + TypeScript, Tailwind | Fast to scaffold, everyone knows it |
| Video playback / overlay preview | HTML5 video + canvas | Can draw skeleton client-side from JSON if server render is slow |
| Backend API | FastAPI (Python) | Same language as the CV code, async, auto docs at /docs |
| Job handling | FastAPI BackgroundTasks, job status polled by frontend | No Celery/Redis needed for a hackathon |
| Pose estimation | MediaPipe Pose Landmarker (heavy model) | 33 landmarks, CPU-friendly, good side-on accuracy |
| Maths | NumPy, SciPy (smoothing), fastdtw or tslearn (DTW) | Standard, no custom solvers |
| Rendering | OpenCV, encode with ffmpeg (H.264) | OpenCV's default mp4 codec won't play in browsers, so re-encode with ffmpeg |
| Ghost cutout (stretch) | Robust Video Matting or SAM 2, run offline | Only needed for library clips, precomputed once |
| Storage | Local disk: uploads/, library/, outputs/ + one JSON index | No database needed for MVP |
| Deploy for demo | Run locally on the demo laptop; optional ngrok | Avoids cloud GPU and upload-size problems on the day |
| Repo | One monorepo: /frontend, /backend, /library, /scripts | One place, simple CI-free setup |

## Shared contracts (agree these in hour one)

If these are locked early, every module can be built against fake data and plugged together later. Commit them as `backend/schemas.py` (Pydantic) and `frontend/src/types.ts`.

**PoseSequence** (output of pose extraction, input to everything downstream):

- `fps`: float, `width`, `height`: int
- `frames`: list of `{ t: seconds, landmarks: [[x, y, z, visibility] x 33] | null }`
- Coordinates in pixels (not MediaPipe's 0 to 1 normalised), so rendering needs no conversion

**Reps**: list of `{ start: frame_idx, end: frame_idx, bottom: frame_idx }`

**Alignment**: for every user frame, `{ user_frame, ref_frame, anchor: [x, y], scale: float }`

**FormReport**: `{ score: 0-100, per_joint: { knee_l: { max_diff_deg, frames_flagged } ... }, flags: [{ frame, joint, diff_deg, message }] }`

**Library entry** (`library/index.json`): `{ id, name, exercise, pose_path, video_path, cutout_path | null, reps }`

API endpoints:

| Method | Path | Does |
| --- | --- | --- |
| GET | /exercises | List supported exercises |
| GET | /references?exercise=squat | List library entries for an exercise |
| POST | /jobs | Multipart upload: video + exercise + reference\_id, returns job\_id |
| GET | /jobs/{id} | Status (queued, extracting, syncing, rendering, done, failed) + progress |
| GET | /jobs/{id}/result | video\_url, form\_report, user pose, ref pose, alignment |
| POST | /references | Save a processed user upload as a new reference ("compare against another user") |

## Modules

| # | Module | Scope | In, out | Done when | Owner |
| --- | --- | --- | --- | --- | --- |
| M1 | Pose extraction | MediaPipe per frame, smoothing (Savitzky-Golay or One Euro), fill short dropouts, pixel coords | video, PoseSequence | Squat clip gives a smooth, stable skeleton when drawn back on | TBD |
| M2 | Rep segmentation + temporal sync | Detect reps from hip height or knee angle signal (scipy find\_peaks), DTW each user rep against a ref rep on joint-angle vectors | 2x PoseSequence, Reps + frame mapping | Fast and slow squats both line up at the bottom of each rep | TBD |
| M3 | Spatial alignment + form scoring | Hip-midpoint anchor, torso-length scale, joint angles (knee, hip, back, elbow), per-exercise thresholds and messages | poses + mapping, Alignment + FormReport | Knee-cave or shallow-depth clip gets flagged with a sensible message | TBD |
| M4 | Renderer | Draw ref skeleton (one colour), user skeleton (optional, another colour), red joints on flagged frames, ffmpeg H.264 encode | video + Alignment + FormReport, mp4 | Output plays in Chrome and Safari | TBD |
| M5 | Backend API + job runner | FastAPI endpoints from the contracts, file storage, background job wiring M1 to M4, status updates, CORS | HTTP, JSON + files | End-to-end curl upload returns a playable result | TBD |
| M6 | Frontend | Exercise picker, reference picker (thumbnails), upload with progress, polling screen, results page with video, score, flags list that seeks the video | API, UI | Full flow works on the demo laptop without touching a terminal | TBD |
| M7 | Reference library | Record 3 exercises x 1 to 2 "pros" (side-on, fixed tripod, plain background), run M1 + M2 offline, write index.json, recording guidelines for users | raw clips, library/ | Every exercise has at least one clean reference with detected reps | TBD |
| M8 | Ghost cutout (stretch) | RVM or SAM 2 on library clips offline, store alpha video, renderer toggle to blend at about 40% | library clips, cutout files | Toggle on shows a clean translucent pro on the user | TBD |
| M9 | Demo + pitch | Demo script, backup pre-rendered results, slides, a bad-form vs good-form test video | everything, demo | Demo runs in under 3 min with an offline fallback | TBD |

## Build order and milestones

Milestones are relative to kickoff, so stretch or squash them to fit the hackathon length.

1. **Kickoff (first 1 to 2 hrs)**: lock contracts, set up monorepo, record the first squat reference clip plus one good and one bad user clip. Everyone builds against these same 3 clips.
2. **Walking skeleton (about 25% in)**: M1 on real video, M2 and M3 stubbed (frame i to frame i, no scaling), M4 draws it, M5 serves it, M6 shows it. Ugly but works end to end.
3. **Real alignment (about 50% in)**: hip anchor + torso scale and DTW sync replace the stubs. Overlay actually tracks the user.
4. **Feedback (about 70% in)**: form scoring, red joints, flags list in the UI, second and third exercises in the library.
5. **Polish + stretch (about 85% in)**: ghost cutout toggle, UI polish, "compare against another user".
6. **Freeze (last 10%)**: no new features. Pre-render backup results, rehearse the demo twice.

## Risks and cut lines

| Risk | Mitigation |
| --- | --- |
| DTW sync looks jittery | Sync only on rep boundaries and the bottom of each rep, then interpolate linearly between them |
| Rep detection fails on messy clips | Fallback: user trims the video to a single rep, sync that one rep |
| Pose jitter or dropouts (occlusion, baggy clothes) | Smoothing in M1, film demo clips in fitted clothes against a plain wall |
| Camera angle mismatch | Enforce side-on in the UI with an example thumbnail, only support side-on at MVP |
| Processing too slow for live demo | Downsample to 15 fps and 720p before extraction, keep pre-rendered backups |
| Browser won't play output mp4 | Always re-encode with ffmpeg libx264 + yuv420p + faststart |

If you run out of time, cut in this order: M8 ghost cutout, "compare against another user", third exercise, form scoring messages (keep the red joints). **Never cut sync and anchoring**: without them the overlay is meaningless.
