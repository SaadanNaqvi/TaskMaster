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

## Prerequisites WARNING: Confirmed working on MAC and WSL!!

- Python 3.11+ and `pip`
- Node.js 20+ and `npm`
- [`ffmpeg`/`ffprobe`](https://ffmpeg.org/) on `PATH`
  - macOS: `brew install ffmpeg`
  - Windows: `winget install ffmpeg` (or `choco install ffmpeg`), then open a
    **new** terminal so `PATH` picks it up
- [**Git LFS**](https://git-lfs.com) — needed to pull the shared reference
  library and model files (see below)
  - macOS: `brew install git-lfs`
  - Windows: `winget install GitHub.GitLFS` (or `choco install git-lfs`),
  - Linux: `sudo apt install git-lfs`,
    then open a **new** terminal
  - Either OS, one-time after install: `git lfs install`
- An iPhone/Android phone with the **Expo Go** app, if you want to run on a
  physical device (a web preview also works, see below)

## 0. Reference data & models (Git LFS)

The exercise reference library (`backend/data/library/`) and the SMPL body
model files (`backend/pose/models/smpl/*.pkl`) are the shared dataset the
comparison pipeline runs against. They're tracked with **Git LFS** instead of
as regular commits, so `git clone` pulls the exact same data for everyone
without bloating normal git history.

If you installed Git LFS *before* cloning, this happens automatically. If you
already had the repo cloned, or `git clone` ran before LFS was installed, pull
the actual file contents explicitly:

```bash
cd TaskMaster
git lfs pull
```

Verify it worked — these should be real file sizes, not ~130-byte pointer
stubs:

```bash
ls -lh backend/data/library/*/video.mp4 backend/pose/models/smpl/*.pkl
```

> **Note on the SMPL files:** SMPL's own license (smpl.is.tue.mpg.de)
> normally prohibits redistributing those model files. They're committed
> here only because this repo is private and the team has permission to
> share internally — don't make this repo public (or fork it publicly)
> without stripping `backend/pose/models/smpl/*.pkl` **and**
> `frontend/assets/smpl/body_model.smplmesh` from history first (the latter
> is a JSON-format mesh converted from the licensed `.pkl` via
> `backend/scripts/convert_smpl.py` — same restriction applies to it).

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
- Uploads and job outputs (per-machine, not shared) are written under
  `backend/data/uploads` and `backend/data/outputs`, and served back at
  `/files/...`. The reference library at `backend/data/library` is the
  shared, checked-in dataset — see "Reference data & models" above.
- Config is via env vars (see `backend/app/config.py`), e.g.
  `TASKMASTER_MAX_UPLOAD_MB`, `TASKMASTER_MAX_DURATION_S`,
  `TASKMASTER_CORS`. None are required to get started.
- Full endpoint docs: [`backend/API.md`](./backend/API.md).
- Run tests with `pytest` (from `backend/`, venv active).

## 2. Frontend (Expo app) DOWNLOAD EXPO ONLY WORKS FOR IPHONES

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

### Point the app at your backend

If you're running the app **in a browser on the same machine as the
backend**, just set `frontend/.env.local` to:

```
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
```

For a **physical phone via Expo Go**, use a **Cloudflare Tunnel** instead of
a LAN IP — this is the recommended default, not just a fallback. LAN IPs
break in a bunch of common setups (corporate/campus Wi-Fi client isolation,
mismatched Windows Firewall profiles, and — critically — **WSL**, where the
IP `ipconfig`/`hostname -I` gives you is on a private virtual network that
phones on the same physical Wi-Fi genuinely cannot reach at all, no firewall
rule fixes it). A tunnel only makes outbound connections, so none of that
matters — it works identically on macOS, native Windows, and WSL.

Install `cloudflared` once:

```bash
brew install cloudflared          # macOS
winget install --id Cloudflare.cloudflared   # Windows (native)
```

Inside **WSL**, install the Linux build instead (the Windows one above
doesn't help — WSL needs its own binary, since it's the WSL-side backend
process, not the Windows host, that needs to expose port 8000):

```bash
curl -L -o cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
```

With the backend already running (see step 1), in another terminal:

```bash
cloudflared tunnel --url http://localhost:8000
```

This prints a `https://<random-words>.trycloudflare.com` URL — put that in
`frontend/.env.local`:

```
EXPO_PUBLIC_API_BASE_URL=https://<random-words>.trycloudflare.com
```

> The URL is regenerated every time you restart `cloudflared tunnel --url
> ...` — same idea as Expo's own `--tunnel` below. Update `.env.local` again
> whenever you restart it, and restart the Expo dev server (`npx expo start
> -c`) afterward so it picks up the change — Expo only reads `.env.local` at
> startup. (A stable URL across restarts is possible with a free Cloudflare
> account and a named tunnel via `cloudflared tunnel login`/`create`, but
> that's overkill for local dev — skip it unless you specifically want it.)

If you're confident your phone and computer are on the same, simple,
unrestricted home Wi-Fi (and **not** using WSL), a plain LAN IP still works
and is a bit lower-latency:

```
EXPO_PUBLIC_API_BASE_URL=http://<your-computer-ip>:8000
```

- macOS: `ipconfig getifaddr en0`
- Windows (native, not WSL): `ipconfig` → "IPv4 Address" under your active
  adapter

### Start the dev server

This is a **second, separate tunnel** from the `cloudflared` one above — that
one exposes the *backend API*; this one exposes the *Expo/Metro dev server*
(the JS bundle your app runs). You generally want both when testing on a
physical phone, especially under WSL. Same command on both OSes:

```bash
npx expo start --tunnel
```

- First run installs `@expo/ngrok` if it isn't already present.
- Scan the printed QR code with your phone's camera → opens in Expo Go.
- Press `w` in the terminal (or run `npx expo start --web --tunnel`) to open
  a web preview instead.
- If you're sure phone and computer are on the same, unrestricted Wi-Fi (and
  not using WSL), you can drop `--tunnel` for a slightly faster plain `npx
  expo start` — but `--tunnel` is the reliable default.

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
optional, heavier layer — requires Python 3.11 specifically. The SMPL model
files it needs are pulled via Git LFS (see "Reference data & models" above);
only set this layer up if you're working on that part of the pipeline.
