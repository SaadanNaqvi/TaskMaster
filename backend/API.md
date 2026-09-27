# TaskMaster API Documentation

This document describes the frontend-to-backend API gateway for TaskMaster. It covers the current endpoints, payloads, response shapes, and the expected integration flow for the mobile/web client.

Base URL:

- Local development: http://localhost:8000
- Production/demo: set by deployment environment

## Common conventions

- All non-2xx responses use the same error envelope:

```json
{
  "error": {
    "code": "unknown_exercise",
    "message": "Exercise 'bench' does not exist",
    "details": {
      "exercise": "bench"
    }
  }
}
```

- JSON request validation failures return HTTP 422 with code `invalid_request`.
- File uploads are multipart form data.
- Static media files are served under `/files`.
- The API uses the same exercise and reference ids across the frontend and backend.

## Error codes

| Code | Status | Meaning |
| --- | --- | --- |
| `invalid_request` | 422 | Request validation failed |
| `unknown_category` | 404 | Category id is not valid |
| `unknown_exercise` | 404 | Exercise id is not valid |
| `unknown_reference` | 404 | Reference id does not exist |
| `reference_exercise_mismatch` | 422 | Reference does not belong to the selected exercise |
| `unsupported_media_type` | 415 | Upload is not a supported video format |
| `not_a_video` | 415 | File is not valid video media |
| `file_too_large` | 413 | Upload exceeds the configured max size |
| `video_too_long` | 413 | Video exceeds allowed duration |
| `video_too_short` | 422 | Video is shorter than allowed minimum |
| `unknown_job` | 404 | Job id is invalid or missing |
| `job_not_finished` | 409 | Job still processing |
| `job_failed` | 500 | Job failed during processing |
| `consent_required` | 400 | Consent required to promote a user reference |
| `already_promoted` | 409 | Job was already promoted to a library reference |
| `internal_error` | 500 | Unexpected server error |

## Content types

### Exercise models

```json
{
  "id": "lift",
  "name": "Lift"
}
```

```json
{
  "id": "squat",
  "name": "Squat",
  "category": "lift"
}
```

### Reference model

```json
{
  "id": "coach_sam_7f3b2a",
  "name": "Coach Sam",
  "exercise": "squat",
  "source": "pro",
  "video_url": "/files/library/coach_sam_7f3b2a/video.mp4",
  "thumbnail_url": "/files/library/coach_sam_7f3b2a/thumbnail.jpg"
}
```

### Job status model

```json
{
  "job_id": "8f3d9c5e1a2b",
  "status": "done",
  "progress": 1.0,
  "error": null,
  "exercise": "squat",
  "reference_id": "pro_squat_1",
  "created_at": "2026-09-26T12:00:00Z"
}
```

## Endpoint reference

### GET /health

Health check for service availability.

Response:

```json
{
  "ok": true,
  "stub": true,
  "ffmpeg": true,
  "version": "0.1.0"
}
```

Status codes:

- 200 OK

---

### GET /exercises

List the supported exercise categories.

Response:

```json
[
  {
    "id": "lift",
    "name": "Lift"
  }
]
```

Status codes:

- 200 OK

---

### GET /exercises/{category}

List exercises within a category.

Example:

```http
GET /exercises/lift
```

Response:

```json
[
  {
    "id": "squat",
    "name": "Squat",
    "category": "lift"
  },
  {
    "id": "deadlift",
    "name": "Deadlift",
    "category": "lift"
  }
]
```

Status codes:

- 200 OK
- 404 unknown_category

---

### GET /references?exercise=squat

List library references for the required exercise.

Query params:

- `exercise` (required)

Example:

```http
GET /references?exercise=squat
```

Response:

```json
[
  {
    "id": "pro_squat_1",
    "name": "Coach Sam",
    "exercise": "squat",
    "source": "pro",
    "video_url": "/files/library/pro_squat_1/video.mp4",
    "thumbnail_url": "/files/library/pro_squat_1/thumbnail.jpg"
  }
]
```

Notes:

- User-created references are hidden unless consent is true.
- Pro references are returned before user references.
- An empty list is valid and returns HTTP 200.

Status codes:

- 200 OK
- 404 unknown_exercise
- 422 invalid_request if `exercise` is missing

---

### POST /jobs

Submit a user video and create a processing job.

Multipart form fields:

- `video` (required file upload)
- `exercise` (required string)
- `reference_id` (required string)

Example:

```bash
curl -X POST http://localhost:8000/jobs \
  -F "video=@/path/to/user_clip.mov" \
  -F "exercise=squat" \
  -F "reference_id=pro_squat_1"
```

Response (202 Accepted):

```json
{
  "job_id": "8f3d9c5e1a2b"
}
```

Status codes:

- 202 Accepted
- 404 unknown_exercise
- 404 unknown_reference
- 422 reference_exercise_mismatch
- 415 unsupported_media_type
- 413 file_too_large
- 415 not_a_video
- 413 video_too_long
- 422 video_too_short

---

### GET /jobs/{job_id}

Fetch the current status of a job.

Example:

```http
GET /jobs/8f3d9c5e1a2b
```

Response:

```json
{
  "job_id": "8f3d9c5e1a2b",
  "status": "queued",
  "progress": 0.2,
  "error": null,
  "exercise": "squat",
  "reference_id": "pro_squat_1",
  "created_at": "2026-09-26T12:00:00Z"
}
```

Status codes:

- 200 OK
- 404 unknown_job

---

### GET /jobs/{job_id}/result

Fetch the completed processing output for a finished job.

Example:

```http
GET /jobs/8f3d9c5e1a2b/result
```

Response:

```json
{
  "job_id": "8f3d9c5e1a2b",
  "video_url": "/files/outputs/8f3d9c5e1a2b/prepared.mp4",
  "form_report": {
    "user_side": "left",
    "ref_side": "right",
    "bottom_frame": 42,
    "per_joint": {
      "knee": {
        "delta_at_bottom": -11.8,
        "user_at_bottom": 78.2,
        "ref_at_bottom": 90.0,
        "max_delta": -12.4,
        "max_delta_frame": 45,
        "measured_fraction": 0.97,
        "message": "Knee: 12° more bent than reference"
      }
    },
    "frames": [
      {
        "user_frame": 0,
        "ref_frame": 0,
        "deltas": {"trunk": 1.2, "shoulder": -0.4, "elbow": null, "hip": 2.1, "knee": 0.3, "ankle": -1.0}
      }
    ]
  },
  "user_pose": {},
  "ref_pose": {},
  "alignment": [
    {"user_frame": 0, "ref_frame": 0, "anchor": [312.0, 540.5], "ref_anchor": [640.2, 510.0], "scale": 0.92, "mirror": true}
  ],
  "exercise": "squat"
}
```

`form_report` is the skeleton comparison: 2D joint angles measured on the camera-facing side of each
body (`user_side` / `ref_side`), synced so both reps hit their bottom together. Every number is a
signed difference in degrees, user minus reference; positive means the user's angle is larger (knee
or elbow straighter, hip more open, shoulder more raised, shin more upright, trunk leaning more).
Trunk is lean from vertical rather than a three-point angle. `null` means the joint wasn't visible
enough to measure; `measured_fraction` is how much of the rep it was measured over. `per_joint` is
ordered by largest `|max_delta|` first. There is no overall score.

`frames` has one entry per user frame in the rep, paired with the matching reference frame, for
labelling joints during playback. `alignment` lays the reference skeleton over the user's for
display: a reference landmark `p` maps to `anchor + scale * (p - ref_anchor)`, negating the x offset
first when `mirror` is true.

Status codes:

- 200 OK
- 404 unknown_job
- 409 job_not_finished
- 500 job_failed

---

### POST /references

Promote a finished user job into the reference library.

Request body:

```json
{
  "job_id": "8f3d9c5e1a2b",
  "name": "Coach Sam",
  "consent": true
}
```

Response (201 Created):

```json
{
  "id": "coach_sam_7f3b2a",
  "name": "Coach Sam",
  "exercise": "squat",
  "source": "user",
  "video_url": "/files/library/coach_sam_7f3b2a/video.mp4",
  "thumbnail_url": "/files/library/coach_sam_7f3b2a/thumbnail.jpg"
}
```

Status codes:

- 201 Created
- 400 consent_required
- 422 invalid_request for invalid or blank names
- 404 unknown_job
- 409 job_not_finished
- 409 already_promoted

---

## Static assets

Prepared and uploaded media are exposed through the static route:

```http
GET /files/<relative-path-under-data-root>
```

Examples:

- `/files/uploads/user_clip.mp4`
- `/files/outputs/job_123/prepared.mp4`
- `/files/library/reference_id/thumbnail.jpg`

Range requests are supported for video playback and seeking.

## Frontend flow

A typical client flow is:

1. `GET /exercises`
2. `GET /references?exercise=squat`
3. `POST /jobs` with a multipart video upload
4. Poll `GET /jobs/{job_id}` until `status == done`
5. `GET /jobs/{job_id}/result`
6. Optional: `POST /references` to save a user clip as a reusable reference

This is the API contract the mobile and web clients should follow.
