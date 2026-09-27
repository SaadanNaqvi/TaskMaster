"""
llm_feedback.py
----------------
Runs the overlay-comparison video (real athlete + translucent 3D reference)
through Gemini and returns the model's written feedback as a plain string.

Requires:
    pip install google-genai opencv-python-headless
    export GEMINI_API_KEY="your-key-here"
"""
from dotenv import load_dotenv
load_dotenv()

import os
import mimetypes

import cv2
from google import genai
from google.genai import types

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])


def extract_frames(video_path, num_frames=10, out_dir=None):
    """
    Samples a fixed number of evenly-spaced frames from a video and saves
    them as JPEGs. Evenly-spaced sampling (not every frame) keeps the number
    of images -- and therefore the token cost of the Gemini call -- under
    control while still covering the whole movement from start to finish.

    video_path: path to the input video (e.g. the overlay-composited video)
    num_frames: how many frames to sample across the whole video
    out_dir:    where to save the extracted JPEGs. Defaults to a folder
                named "<video_filename>_frames" next to the video.

    Returns: list of file paths to the saved frames, in chronological order.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Could not open video: {video_path}")

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total_frames <= 0:
        cap.release()
        raise ValueError(f"Video reports 0 frames, is it a valid file? {video_path}")

    if out_dir is None:
        base = os.path.splitext(os.path.basename(video_path))[0]
        out_dir = os.path.join(os.path.dirname(video_path) or ".", f"{base}_frames")
    os.makedirs(out_dir, exist_ok=True)

    # Evenly spaced frame indices across the whole video, including
    # first and last frame so the movement's start/end are covered.
    num_frames = min(num_frames, total_frames)
    if num_frames == 1:
        indices = [0]
    else:
        step = (total_frames - 1) / (num_frames - 1)
        indices = [round(i * step) for i in range(num_frames)]

    saved_paths = []
    for order, frame_idx in enumerate(indices):
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ok, frame = cap.read()
        if not ok:
            continue

        out_path = os.path.join(out_dir, f"frame_{order:03d}.jpg")
        cv2.imwrite(out_path, frame)
        saved_paths.append(out_path)

    cap.release()

    if not saved_paths:
        raise ValueError(f"No frames could be extracted from: {video_path}")

    return saved_paths


def get_llm_feedback(video_path: str, exercise_id: str) -> str:
    """
    video_path:  path to the overlay-composited video (athlete + 3D reference)
    exercise_id: name/id of the exercise being performed, used in the prompt

    Returns: the LLM's feedback as a plain string.
    """

    frames = extract_frames(video_path)

    prompt_text = f"""
You are analysing an athlete performing a {exercise_id}.

The video contains:
- the real person performing the exercise
- a skeleton reference athlete overlaid on top of them

The skeletal reference is laid ontop of the person. 

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

    for frame in frames:
        with open(frame, "rb") as f:
            image_bytes = f.read()

        mime_type = mimetypes.guess_type(frame)[0] or "image/jpeg"
        contents.append(
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
        )

    response = client.models.generate_content(
        model="gemini-3.5-flash-lite",
        contents=contents,
        config=types.GenerateContentConfig(
            max_output_tokens=1000,
            temperature=0.2,
        ),
    )

    # response.text can be None (e.g. if the response was safety-filtered
    # or hit max_output_tokens with no text yet) -- fall back to "" so this
    # function always returns a string as promised, never None.
    return response.text or ""


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Get LLM feedback on an overlay comparison video")
    parser.add_argument("--video", required=True, help="Path to the overlay video")
    parser.add_argument("--exercise", required=True, help="Exercise name/id")
    args = parser.parse_args()

    feedback = get_llm_feedback(args.video, args.exercise)
    print(feedback)


