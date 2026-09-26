from __future__ import annotations

import json
import subprocess
from pathlib import Path

from .config import DATA_ROOT


class MediaError(RuntimeError):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


def _run(args: list[str], timeout: int = 60) -> str:
    result = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if result.returncode != 0:
        tail = (result.stderr or result.stdout or "").strip()
        raise MediaError(tail[-2000:] or "media operation failed")
    return result.stdout


def _parse_rational(value: str | None, default: float = 30.0) -> float:
    if not value:
        return default
    try:
        return float(value)
    except ValueError:
        if "/" in value:
            numerator, denominator = value.split("/", 1)
            try:
                return float(numerator) / float(denominator)
            except ValueError:
                pass
        return default


def probe(path: str | Path) -> dict:
    p = Path(path)
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_streams",
            "-show_format",
            str(p),
        ],
        capture_output=True,
        text=True,
        timeout=60,
    )
    if result.returncode != 0:
        raise MediaError((result.stderr or result.stdout or "ffprobe failed").strip()[-2000:])
    payload = json.loads(result.stdout)
    streams = payload.get("streams") or []
    video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
    if video_stream is None:
        raise MediaError("No video stream found")
    duration = float((payload.get("format") or {}).get("duration") or video_stream.get("duration") or 0.0)
    rotation = 0.0
    tags = video_stream.get("tags") or {}
    if "rotate" in tags:
        try:
            rotation = float(tags["rotate"])
        except ValueError:
            rotation = 0.0
    side_data = video_stream.get("side_data_list") or []
    for side in side_data:
        rotation_value = side.get("rotation")
        if rotation_value is not None:
            try:
                rotation = float(rotation_value)
            except (TypeError, ValueError):
                pass
    codec = video_stream.get("codec_name") or "unknown"
    width = int(video_stream.get("width") or 0)
    height = int(video_stream.get("height") or 0)
    fps_value = video_stream.get("avg_frame_rate") or video_stream.get("r_frame_rate") or "30/1"
    return {
        "duration_s": duration,
        "width": width,
        "height": height,
        "rotation_deg": rotation,
        "codec": codec,
        "fps": _parse_rational(fps_value, 30.0),
    }


def prepare(src: str | Path, dst: str | Path) -> dict:
    src_path = Path(src)
    dst_path = Path(dst)
    dst_path.parent.mkdir(parents=True, exist_ok=True)
    _run([
        "ffmpeg",
        "-y",
        "-i",
        str(src_path),
        "-vf",
        "scale='min(1280,iw)':-2,fps=30",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-an",
        str(dst_path),
    ])
    return probe(dst_path)


def thumbnail(src: str | Path, t: float, dst: str | Path) -> None:
    dst_path = Path(dst)
    dst_path.parent.mkdir(parents=True, exist_ok=True)
    _run([
        "ffmpeg",
        "-y",
        "-ss",
        str(t),
        "-i",
        str(src),
        "-frames:v",
        "1",
        "-vf",
        "scale=480:-1",
        str(dst_path),
    ])


def to_url(path: str | Path) -> str:
    candidate = str(Path(path).resolve())
    base = str(DATA_ROOT.resolve())
    if candidate != base and base not in candidate:
        raise ValueError("path is outside DATA_ROOT")
    relative = Path(candidate).relative_to(base)
    return f"/files/{relative.as_posix()}"
