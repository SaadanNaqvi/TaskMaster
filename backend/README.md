# TaskMaster Backend

FastAPI API for the TaskMaster exercise overlay pipeline.

## Local setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Ensure `ffmpeg` and `ffprobe` are on `PATH`.

## Run

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Notes

- The app serves static files at `/files` from the configured working data directory.
- Stub mode is enabled by default, and can be toggled with `TASKMASTER_STUB=0` to use the real pipeline modules once available.
