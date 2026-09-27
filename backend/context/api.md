
## Your scope

- Build the FastAPI backend: project setup, storage, job runner, and **every API gate** (validation and guard checks) on every endpoint.
- Implement the real **prepare** step (ffprobe + ffmpeg). It is small and every upload depends on it.
- **Do not** implement MediaPipe, rep detection, DTW, alignment or scoring. Other people own those (M1 to M3). Build stubs with the exact signatures so their code drops in later.
- Work through the tasks below **in order**. After each task: run `pytest -q`, fix failures, then commit with message `backend: task N <name>`. Do not start the next task with failing tests.
- Ask before adding a dependency not listed here, changing a response shape, or changing a status code in the gate tables.

## Environment

- Python 3.11, FastAPI, Pydantic v2, uvicorn, python-multipart, pytest, httpx.
- ffmpeg and ffprobe must be on PATH. Fail fast at startup with a clear message if missing.
- Starlette must be a version whose `StaticFiles` supports HTTP Range (0.39+). Test for it (Task 9).

---

## Task 1: Scaffold

Create:

```
backend/
  app/
    __init__.py
    main.py            # app factory, CORS, routers, static mount, error handlers, startup checks
    config.py          # all env vars and paths, nothing else
    errors.py          # ApiError + handlers (Task 5)
    schemas.py         # Pydantic contracts (Task 2)
    catalogue.py       # categories + exercises (Task 3)
    storage.py         # library index + job records (Task 4)
    gates.py           # reusable validation dependencies (Task 6)
    media.py           # ffprobe / ffmpeg wrappers (Task 8)
    routers/
      __init__.py
      exercises.py
      references.py
      jobs.py
    pipeline/
      __init__.py
      interfaces.py    # function signatures M1-M3 implement
      stubs.py         # fake implementations
      real.py          # imports real modules; raises NotImplementedError until they land
      runner.py        # runs one job end to end
  scripts/
    __init__.py
    add_reference.py   # Task 10
  tests/
    conftest.py
    fixtures/          # generated test videos (gitignored), see Task 11
  data/                # gitignored
  requirements.txt
  requirements-dev.txt
  .gitignore
  README.md
```

`config.py` env vars (all optional):

| Var | Default | Use |
| --- | --- | --- |
| `TASKMASTER_DATA` | `backend/data` | Root for uploads, library, outputs |
| `TASKMASTER_STUB` | `1` | `1` = stub pipeline, `0` = real |
| `TASKMASTER_MAX_UPLOAD_MB` | `100` | Upload size cap |
| `TASKMASTER_MAX_DURATION_S` | `15` | Video length cap |
| `TASKMASTER_MIN_DURATION_S` | `1` | Reject near-empty clips |
| `TASKMASTER_MAX_CONCURRENT_JOBS` | `2` | Jobs processed at once; extras wait in `queued` |
| `TASKMASTER_CORS` | `*` | Allowed origins (native app does not need CORS; keep `*` for testing tools) |
| `TASKMASTER_STUB_DELAY_S` | `0.5` | Sleep per stage in stub mode so the app's progress screen is visible; tests set `0` |

Create `data/uploads`, `data/library`, `data/outputs` on startup.

`GET /health` returns `{ok: true, stub: bool, ffmpeg: bool, version: "0.1.0"}`.

**Done when:** `uvicorn app.main:app` starts, `/health` and `/docs` load, one test hits `/health`.

---

## Task 2: Schemas

Implement every model from the root `CLAUDE.md` "Data contracts" section in `schemas.py`, exactly as named. Plus these API models:

- `Category {id, name}`, `Exercise {id, name, category}`
- `ReferenceOut {id, name, exercise, source, video_url, thumbnail_url}` (URLs only, never disk paths)
- `JobCreated {job_id}`
- `JobStatusOut {job_id, status, progress, error, exercise, reference_id, created_at}`
- `CreateReferenceIn {job_id: str, name: str, consent: bool}`
- `JobStatus` enum: `queued, preparing, extracting, syncing, scoring, done, failed`
- `ErrorBody {error: {code: str, message: str, details: dict | None}}`

Rules: use `Field` constraints for ranges (`progress` 0 to 1, landmarks length 33, each landmark length 4). `model_config = ConfigDict(extra="forbid")` on every request model.

**Done when:** a test round-trips each model through JSON and rejects a PoseSequence frame with 32 landmarks.

---

## Task 3: Catalogue

`catalogue.py` holds a static structure:

```python
CATEGORIES = [
  {"id": "lift", "name": "Lift", "exercises": [
     {"id": "squat", "name": "Squat"},
     {"id": "deadlift", "name": "Deadlift"},
  ]},
]
```

Helpers: `get_category(id)`, `get_exercise(id)`, `list_categories()`. Ids are lowercase snake_case; add a test that enforces it and that exercise ids are unique across categories.

Only Lift for MVP. Adding a category later must require editing this file only.

---

## Task 4: Storage

`storage.py` is the only module with mutable state.

**Library** (`data/library/index.json`, list of `LibraryEntry`):
- `list_references(exercise)`, `get_reference(id)`, `add_reference(entry)`.
- Writes are atomic: write to `index.json.tmp`, then `os.replace`. Guard with a `threading.Lock`.
- If `index.json` is missing, treat as empty. If corrupt, log an error and raise at startup (do not silently wipe it).

**Jobs** (in-memory dict mirrored to `data/outputs/<job_id>/job.json`):
- `create_job(...)`, `get_job(id)`, `update_job(id, **fields)`, `job_dir(id)`.
- On startup, load all `job.json` files. Any job not in `done` or `failed` is set to `failed` with error `"Server restarted during processing"`.
- Job ids: `uuid4().hex[:12]`.
- Track `created_at`, `updated_at` (UTC ISO strings).
- `promoted_reference_id` on a job, set when it becomes a reference (used by a gate in Task 7).

**Done when:** tests cover atomic write, reload after restart, and interrupted-job recovery.

---

## Task 5: Error format

Every non-2xx response uses one shape:

```json
{"error": {"code": "unknown_exercise", "message": "Exercise 'bench' does not exist", "details": {"exercise": "bench"}}}
```

- `errors.py`: `class ApiError(Exception)` with `status`, `code`, `message`, `details`. Register a handler that renders `ErrorBody`.
- Override FastAPI's `RequestValidationError` handler to return **422** with code `invalid_request` and the Pydantic errors in `details.errors`.
- Unhandled exceptions: **500**, code `internal_error`, log the traceback, never leak it in the body.

Error codes (the app switches on these, keep them stable):

| Code | Status |
| --- | --- |
| `invalid_request` | 422 |
| `unknown_category` | 404 |
| `unknown_exercise` | 404 |
| `unknown_reference` | 404 |
| `reference_exercise_mismatch` | 422 |
| `unsupported_media_type` | 415 |
| `not_a_video` | 415 |
| `file_too_large` | 413 |
| `video_too_long` | 413 |
| `video_too_short` | 422 |
| `unknown_job` | 404 |
| `job_not_finished` | 409 |
| `job_failed` | 500 |
| `consent_required` | 400 |
| `already_promoted` | 409 |
| `internal_error` | 500 |

---

## Task 6: Gates

A **gate** is a check that runs before an endpoint does any work and raises an `ApiError` on failure. Put reusable ones in `gates.py` as plain functions or FastAPI dependencies. Endpoints call gates **in the order listed** in Task 7 so the cheapest checks fail first.

| Gate | Checks | Fails with |
| --- | --- | --- |
| `require_category(id)` | exists in catalogue | `unknown_category` 404 |
| `require_exercise(id)` | exists in catalogue | `unknown_exercise` 404 |
| `require_reference(id)` | exists in library and (`source == "pro"` or `consent == true`) | `unknown_reference` 404 |
| `require_reference_matches(ref, exercise)` | `ref.exercise == exercise` | `reference_exercise_mismatch` 422 |
| `require_video_upload(file)` | content type in `{video/mp4, video/quicktime, video/x-m4v}` **or** extension in `{.mp4, .mov, .m4v}` (iOS sometimes sends `application/octet-stream`) | `unsupported_media_type` 415 |
| `save_upload_capped(file, dest)` | streams to disk in 1 MB chunks, aborts and deletes partial file past `MAX_UPLOAD_MB` | `file_too_large` 413 |
| `require_probe_ok(path)` | ffprobe finds at least one video stream; returns duration, width, height, rotation, codec | `not_a_video` 415 |
| `require_duration(probe)` | `MIN_DURATION_S <= duration <= MAX_DURATION_S + 0.5` | `video_too_short` 422 / `video_too_long` 413 |
| `require_job(id)` | id matches `^[0-9a-f]{12}$` and job exists (malformed id = same 404, never 422) | `unknown_job` 404 |
| `require_job_done(job)` | `status == done`; if `failed`, raise `job_failed` 500 with the job's error in `details` | `job_not_finished` 409 / `job_failed` 500 |
| `require_consent(body)` | `consent is True` | `consent_required` 400 |
| `require_not_promoted(job)` | `promoted_reference_id is None` | `already_promoted` 409 |

Rules:
- Never use the client's filename on disk. Save as `data/uploads/<job_id><ext>` with ext from the allow-list.
- Any gate that fails after a file is written must delete that file.
- Each gate gets unit tests for pass and fail cases.

---

## Task 7: Endpoints

Implement each router. Gate order is mandatory.

### `GET /exercises`
Returns `list[Category]` (id, name only). No gates.

### `GET /exercises/{category}`
1. `require_category`
Returns `list[Exercise]`.

### `GET /references?exercise=squat`
1. `exercise` query param required (missing = 422 `invalid_request`, automatic)
2. `require_exercise`
Returns `list[ReferenceOut]` for that exercise, only pro entries and consented user entries, pros first, then by name. Empty list is valid (200).

### `POST /jobs` (multipart: `video`, `exercise`, `reference_id`)
1. `require_exercise(exercise)`
2. `require_reference(reference_id)`
3. `require_reference_matches`
4. `require_video_upload`
5. Generate `job_id`, `save_upload_capped`
6. `require_probe_ok`
7. `require_duration`
8. `storage.create_job(status=queued, progress=0)`, schedule `runner.run_job(job_id)` via `BackgroundTasks`
Returns **202** `{job_id}`.

### `GET /jobs/{job_id}`
1. `require_job`
Returns `JobStatusOut`. Must be cheap (no disk reads beyond the in-memory dict); the app calls it every second.

### `GET /jobs/{job_id}/result`
1. `require_job`
2. `require_job_done`
Returns `JobResult` read from `data/outputs/<job_id>/result.json`. `video_url` points at the **prepared** video, not the raw upload.

### `POST /references` (JSON `CreateReferenceIn`)
1. Body validation (automatic 422)
2. `require_consent`
3. `name` stripped, 1 to 40 chars after strip (else 422 `invalid_request`)
4. `require_job`
5. `require_job_done`
6. `require_not_promoted`
7. Copy prepared video + user pose into `data/library/<ref_id>/`, generate thumbnail (ffmpeg frame at `rep.bottom_t`, 480 px wide JPEG), build `LibraryEntry(source="user", consent=True, rep=job's rep)`, `add_reference`, set job's `promoted_reference_id`.
Returns **201** `ReferenceOut`. `ref_id` = slug of name + `_` + 6 hex chars.

---

## Task 8: Media + job runner

### `media.py`
- `probe(path) -> ProbeInfo(duration_s, width, height, rotation_deg, codec, fps)` via `ffprobe -v error -print_format json -show_streams -show_format`. Read rotation from both `tags.rotate` and `side_data_list[].rotation` (iPhone uses the latter).
- `prepare(src, dst)`: one ffmpeg call producing upright H.264 mp4:
  `-vf "scale='min(1280,iw)':-2,fps=30" -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p -movflags +faststart -an`
  ffmpeg auto-rotates by default; confirm the output has no rotation metadata and width/height reflect the upright frame. Return a fresh `ProbeInfo` of the output.
- `thumbnail(src, t, dst)`.
- All subprocess calls: timeout 60 s, capture stderr, raise `MediaError` with the stderr tail on failure.

### `pipeline/interfaces.py`
Exact signatures (from root CLAUDE.md):

```python
extract_pose(video_path: Path) -> PoseSequence
find_rep(pose: PoseSequence, exercise: str) -> RepWindow
sync(user: PoseSequence, user_rep: RepWindow, ref: PoseSequence, ref_rep: RepWindow) -> list[tuple[int, int]]
align(user: PoseSequence, ref: PoseSequence, pairs: list[tuple[int, int]]) -> list[AlignmentFrame]
score(user: PoseSequence, ref: PoseSequence, alignment: list[AlignmentFrame], user_rep: RepWindow) -> FormReport
```

### `pipeline/stubs.py`
Fake but believable: a side-on skeleton doing one squat and a rep window around it. Output must pass schema validation. Sync/align/score have no stubs: the skeleton angle comparison (`pipeline/angles.py`) always runs for real.

### `pipeline/runner.py`
- A module-level `threading.Semaphore(MAX_CONCURRENT_JOBS)`; job stays `queued` until it acquires.
- Stages and progress:

| Status | Progress on entry | Work |
| --- | --- | --- |
| `preparing` | 0.05 | `media.prepare` (real, even in stub mode) |
| `extracting` | 0.20 | `extract_pose` on user video; load ref pose from library |
| `syncing` | 0.60 | `find_rep` on user and ref |
| `scoring` | 0.80 | `sync`, `align`, `score` (angle comparison) |
| `done` | 1.0 | write `result.json` + `user_pose.json` |

- Wrap the whole job in try/except: on any exception set `failed`, store a short user-safe `error` message, write the traceback to `error.log` in the job dir.
- Implementation chosen by `TASKMASTER_STUB`. `real.py` imports M1 to M3 modules when they exist and raises `NotImplementedError` otherwise.

**Done when:** a job submitted in stub mode walks every status in order and ends `done` with a valid `JobResult`.

---

## Task 9: Static files

Mount `StaticFiles(directory=DATA_DIR)` at `/files`. Test: `GET` a prepared video with header `Range: bytes=0-99` returns **206** and 100 bytes. Add a helper `to_url(path)` that converts a path under `DATA_DIR` to `/files/...` and raises if the path is outside it.

---

## Task 10: Reference library script

`python -m scripts.add_reference --video path.mov --exercise squat --name "Coach Sam"`:
1. Validate exercise.
2. `media.prepare` into `data/library/<ref_id>/video.mp4`.
3. `extract_pose` + `find_rep` (stub or real per env).
4. Thumbnail at `bottom_t`.
5. Write `pose.json`, add `LibraryEntry(source="pro", consent=True)`.

Also `--seed` flag: generate a placeholder squat reference from an ffmpeg test pattern so the API is usable with zero real clips.

---

## Task 11: Test suite

`conftest.py`:
- Session fixture sets `TASKMASTER_DATA` to a tmp dir, `TASKMASTER_STUB=1`, `TASKMASTER_STUB_DELAY_S=0`, then imports the app.
- Generates fixture videos with ffmpeg `testsrc`: `ok_5s.mp4`, `ok_rotated.mov` (with a 90 deg rotation tag, HEVC if the local ffmpeg has `libx265`, else H.264), `too_long_20s.mp4`, `too_short_0_5s.mp4`, `not_video.mp4` (random bytes), and a file just over the size cap (set cap to 1 MB via env for that test).
- Seeds one pro squat reference.
- Helper `wait_for_job(client, id, timeout=10)`.

Required tests (one per gate failure, plus happy paths):

| Area | Cases |
| --- | --- |
| Exercises | list categories; list lift; unknown category 404 |
| References | squat list; unknown exercise 404; missing param 422; unconsented user ref hidden |
| POST /jobs | happy path 202; unknown exercise; unknown reference; mismatched reference; wrong content type; octet-stream with .mov accepted; too large (partial file deleted); not a video; too long; too short |
| Job status | valid id; malformed id 404; unknown id 404; statuses progress monotonically |
| Result | before done 409; failed job 500 with details; done returns valid JobResult; video_url is the prepared file |
| Rotation | rotated upload: prepared output has no rotation tag and width < height for portrait |
| POST /references | happy path 201 and appears in list; consent false 400; blank name 422; job not done 409; promoted twice 409 |
| Robustness | restart recovery marks in-flight job failed; concurrency cap keeps third job `queued` while two run |
| Static | Range request returns 206 |

---

## Task 12: README + handover

README: setup (venv, pip, ffmpeg install for macOS `brew install ffmpeg`), run (`uvicorn app.main:app --host 0.0.0.0 --port 8000` so the phone can reach it), seeding, env vars, error code table, how pipeline owners plug in (`real.py` + `TASKMASTER_STUB=0`), and a curl walkthrough of the full flow.

## Definition of done (whole backend)

- All tests pass with `pytest -q`.
- From a phone on the same Wi-Fi: upload a real iPhone portrait `.mov`, poll to `done`, fetch the result, play `video_url` with seeking.
- Every error the app can hit returns the `ErrorBody` shape with a stable code.
- No endpoint touches the disk before its cheap gates pass (except the upload stream itself).