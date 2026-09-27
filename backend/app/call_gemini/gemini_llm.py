"""
llm_feedback.py

Runs the overlay-comparison video (real athlete + translucent 3D reference)
through Gemini and returns the model's written feedback as a plain string.

Requires:
    pip install google-genai opencv-python-headless python-dotenv

Environment:
    GEMINI_API_KEY="your-key-here"
"""

from dotenv import load_dotenv
load_dotenv()

import os
import mimetypes
import tempfile

import cv2

from google import genai
from google.genai import types


client = genai.Client(
    api_key=os.environ["GEMINI_API_KEY"]
)


def extract_frames(video, num_frames=10, out_dir=None):
    """
    Samples a fixed number of evenly-spaced frames from a video.

    Args:
        video: Uploaded video, bytes, or a file-like object.
        num_frames: Number of frames to sample.
        out_dir: Directory to save the extracted JPEGs.

    Returns:
        List of file paths to the saved frames.
    """

    if hasattr(video, "file"):
        video = video.file
    video_bytes = video.read() if hasattr(video, "read") else video

    with tempfile.NamedTemporaryFile(suffix=".mp4") as temp_video:
        temp_video.write(video_bytes)
        temp_video.flush()
        video_path = temp_video.name

        cap = cv2.VideoCapture(video_path)

        if not cap.isOpened():
            raise ValueError(
                "Could not open uploaded video"
            )

        total_frames = int(
            cap.get(cv2.CAP_PROP_FRAME_COUNT)
        )

        if total_frames <= 0:
            cap.release()
            raise ValueError(
                "Uploaded video reports 0 frames"
            )

        if out_dir is None:
            out_dir = tempfile.mkdtemp(prefix="video_frames_")

        os.makedirs(out_dir, exist_ok=True)

        num_frames = min(
            num_frames,
            total_frames
        )

        if num_frames == 1:
            indices = [0]
        else:
            step = (
                (total_frames - 1)
                / (num_frames - 1)
            )

            indices = [
                round(i * step)
                for i in range(num_frames)
            ]

        saved_paths = []

        for order, frame_idx in enumerate(indices):

            cap.set(
                cv2.CAP_PROP_POS_FRAMES,
                frame_idx
            )

            ok, frame = cap.read()

            if not ok:
                continue

            out_path = os.path.join(
                out_dir,
                f"frame_{order:03d}.jpg"
            )

            cv2.imwrite(
                out_path,
                frame
            )

            saved_paths.append(out_path)

        cap.release()

        if not saved_paths:
            raise ValueError(
                "No frames could be extracted from uploaded video"
            )

        return saved_paths


def get_llm_feedback(video) -> str:
    """
    Sends an overlay-comparison video to Gemini and returns
    written feedback comparing the real athlete against the
    reference athlete.

    Args:
        video: Uploaded video, bytes, or a file-like object.

    Returns:
        Gemini's feedback as a string.
    """

    # Extract representative frames from the comparison video
    frames = extract_frames(video)

    prompt_text = f"""
You are analysing an athlete performing an exercise.

The video contains:

- the real person performing the exercise
- a skeleton reference athlete overlaid on top of them

The skeletal reference is laid directly on top of the person
and represents the desired reference movement.

Compare the real person against the reference throughout
the movement.

Identify visible differences in:

- joint positioning
- range of motion
- torso position
- limb movement
- timing
- symmetry
- movement trajectory

Do NOT critique the skeletal reference itself.

Only report differences that are clearly visible in the
comparison.

Give the 2-4 most important differences and explain how
the athlete could adjust their movement to more closely
match the reference.
"""

    contents = [prompt_text]

    # Add each extracted frame to the Gemini request
    for frame in frames:

        with open(frame, "rb") as f:
            image_bytes = f.read()

        mime_type = (
            mimetypes.guess_type(frame)[0]
            or "image/jpeg"
        )

        contents.append(
            types.Part.from_bytes(
                data=image_bytes,
                mime_type=mime_type
            )
        )

    # Send comparison frames to Gemini
    response = client.models.generate_content(
        model="gemini-3.8-flash",
        contents=contents,
        config=types.GenerateContentConfig(
            temperature=0.2
        ),
    )

    return response.text or ""
