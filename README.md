# TaskMaster

Overlay a chosen professional's (or another user's) movement on top of a
user's own exercise video, spatially aligned, so form differences are visible
directly. See [`CONTEXT.md`](./CONTEXT.md) for product background.

The project has two parts:

- **`backend/`** — FastAPI service that handles uploads, the pro/user
  reference library, and the pose-comparison pipeline.
- **`frontend/`** — Expo/React Native app (iOS via Expo Go, or web) that
  records/uploads clips and displays the overlay result.

This guide gets both running locally on **macOS** or **Windows**. It defaults
to **stub mode**, which needs no ML setup and works out of the box.

## Prerequisites

- Python 3.11+ and `pip`
- Node.js 20+ and `npm`
- [`ffmpeg`/`ffprobe`](https://ffmpeg.org/) on `PATH`
  - macOS: `brew install ffmpeg`
  - Windows: `winget install ffmpeg` (or `choco install ffmpeg`), then open a
    **new** terminal so `PATH` picks it up
- An iPhone/Android phone with the **Expo Go** app, if you want to run on a
  physical device (a web preview also works, see below)

## 1. Backend

macOS / Linux:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Windows (PowerShell):

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

> If `Activate.ps1` is blocked by execution policy, run PowerShell as
> Administrator once: `Set-ExecutionPolicy -Scope CurrentUser
> RemoteSigned`. Using `cmd.exe` instead? Activate with
> `.venv\Scripts\activate.bat`.

Check it's up: open `http://localhost:8000/health` (or `curl` it) →
`{"ok": true, ...}`.

Notes:

- **Stub mode is on by default** (`TASKMASTER_STUB=1`) — pose comparison runs
  against synthetic data so you can exercise the whole API/app without any ML
  environment. See "Real pose pipeline" below to turn it off.
- Uploaded videos, the reference library, and job outputs are written under
  `backend/data/` and served back at `/files/...`.
- Config is via env vars (see `backend/app/config.py`), e.g.
  `TASKMASTER_MAX_UPLOAD_MB`, `TASKMASTER_MAX_DURATION_S`,
  `TASKMASTER_CORS`. None are required to get started.
- Full endpoint docs: [`backend/API.md`](./backend/API.md).
- Run tests with `pytest` (from `backend/`, venv active).

## 2. Frontend (Expo app)

In a second terminal:

```bash
cd frontend
npm install
```

### Sign in to Expo (recommended)

Create a free account at [expo.dev](https://expo.dev) if you don't have one,
then sign in on **both** the CLI and the Expo Go app on your phone with the
same account:

```bash
npx expo login
```

- On the phone, open Expo Go → **Profile** tab → sign in with the same
  account.
- Being signed in on both sides isn't strictly required to run the project,
  but it means your dev server shows up under "Recently in development" in
  Expo Go so you can reopen it with one tap instead of rescanning the QR code
  every time — especially handy when using `--tunnel` below, since a tunnel
  URL is regenerated each time you restart the dev server.

Point the app at your backend. Edit `frontend/.env.local`:

```
EXPO_PUBLIC_API_BASE_URL=http://<your-computer-ip>:8000
```

- If you're running the app in a browser on the same machine as the backend,
  `http://localhost:8000` works.
- If you're running on a **physical phone via Expo Go**, `localhost` won't
  reach your computer — use its LAN IP, or expose the backend with a tunnel
  if your phone isn't on the same Wi-Fi / the network blocks
  phone-to-computer traffic (e.g. corporate/campus Wi-Fi with client
  isolation):
  - macOS: `ipconfig getifaddr en0`
  - Windows: `ipconfig` → look for "IPv4 Address" under your active adapter
  - Tunnel (either OS): `cloudflared tunnel --url http://localhost:8000` or
    `ngrok http 8000`

Start the dev server with `--tunnel` (same command on both OSes) — this
routes the connection through a public relay instead of plain LAN, so it
works even if your phone and computer aren't on the same Wi-Fi or the
network blocks phone-to-computer traffic (very common on corporate/campus/
hotel Wi-Fi):

```bash
npx expo start --tunnel
```

- First run installs `@expo/ngrok` if it isn't already present.
- Scan the printed QR code with your phone's camera → opens in Expo Go.
- Press `w` in the terminal (or run `npx expo start --web --tunnel`) to open
  a web preview instead.
- If you're sure phone and computer are on the same, unrestricted Wi-Fi, you
  can drop `--tunnel` for a slightly faster plain `npx expo start` — but
  `--tunnel` is the reliable default and what `EXPO_PUBLIC_API_BASE_URL`
  above assumes if you tunneled the backend too.

More detail on the Expo Go workflow: [`frontend/SETUP.md`](./frontend/SETUP.md).

## Typical end-to-end flow

1. Start the backend (`uvicorn ...`) and the frontend (`npx expo start`).
2. Open the app, pick an exercise, and record/upload a clip.
3. Choose a reference (pro or another user) for that exercise.
4. Submit — the app polls the job status and shows the aligned overlay once
   it's done.

## Real pose pipeline (optional)

By default the backend uses synthetic stub data for pose extraction. To use
the real MediaPipe-based pose extraction instead:

macOS / Linux:

```bash
cd backend
python3.11 -m venv .venv-pose
source .venv-pose/bin/activate
pip install -r pose/requirements-mediapipe.txt
```

Windows (PowerShell — assumes the [`py` launcher](https://docs.python.org/3/using/windows.html#launcher) has a 3.11 install registered):

```powershell
cd backend
py -3.11 -m venv .venv-pose
.venv-pose\Scripts\Activate.ps1
pip install -r pose/requirements-mediapipe.txt
```

The pipeline auto-detects `.venv-pose` and uses real pose extraction when
available — no env var needed to enable it. There's no separate "stub off"
switch for this part; `TASKMASTER_STUB` only affects the rest of the mocked
pipeline. See the comments in `backend/app/pipeline/runner.py` for how the
fallback works.

ROMP/SMPL-based 3D body fitting (`pose/requirements-romp.txt`) is a further
optional, heavier layer — requires Python 3.11 specifically and SMPL model
files that are license-gated and not redistributed in this repo (see
`backend/.gitignore`). Only set this up if you're working on that part of the
pipeline.
