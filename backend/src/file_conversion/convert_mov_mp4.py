# video_converter.py

from pathlib import Path
import subprocess


def convert_to_mp4(input_path: str | Path) -> Path:
    """
    Convert a MOV video to MP4 using FFmpeg.

    If the input is already MP4, it is returned unchanged.
    The converted file is placed beside the original file.
    """
    input_path = Path(input_path)

    if not input_path.exists():
        raise FileNotFoundError(f"Video not found: {input_path}")

    if input_path.suffix.lower() == ".mp4":
        return input_path

    if input_path.suffix.lower() != ".mov":
        raise ValueError(
            f"Unsupported video format: {input_path.suffix}"
        )

    output_path = input_path.with_suffix(".mp4")

    command = [
        "ffmpeg",
        "-y",
        "-i", str(input_path),

        # H.264 video
        "-c:v", "libx264",

        # Good quality without an enormous file
        "-crf", "18",

        # Widely compatible MP4
        "-pix_fmt", "yuv420p",

        # Remove audio if you don't need it for pose processing
        "-an",

        str(output_path),
    ]

    try:
        subprocess.run(
            command,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
    except subprocess.CalledProcessError as e:
        raise RuntimeError(
            f"FFmpeg conversion failed:\n{e.stderr}"
        ) from e

    return output_path
