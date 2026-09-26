import os
import base64
from openai import OpenAI


client = OpenAI(
    api_key=os.environ["DIGITALOCEAN_MODEL_ACCESS_KEY"],
    base_url="https://inference.do-ai.run/v1"
)


def get_llm_feedback(video_path, exercise_id):

    frames = extract_frames(video_path)

    content = [
        {
            "type": "text",
            "text": f"""
You are analysing an athlete performing a {exercise_id}.

The video contains:
- the real athlete performing the exercise
- a 3D reference athlete overlaid on top of them

The 3D reference is the greay coloured translucent overlay over the actual athlete.

The 3D reference represents the desired reference movement.

Compare the real athlete against the reference throughout
the movement.

Identify visible differences in:
- joint positioning
- range of motion
- torso position
- limb movement
- timing
- symmetry
- movement trajectory

Do NOT critique the 3D reference itself.

Only report differences that are clearly visible in the
comparison.

Give the 2-4 most important differences and explain how
the athlete could adjust their movement to more closely
match the reference.
"""
        }   
    ]

    for frame in frames:
        with open(frame, "rb") as f:
            encoded = base64.b64encode(f.read()).decode()

        content.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:image/jpeg;base64,{encoded}"
            }
        })

    response = client.chat.completions.create(
        model="nemotron-nano-12b-v2-vl",
        messages=[
            {
                "role": "user",
                "content": content
            }
        ],
        max_tokens=512,
        temperature=0.2
    )

    return response.choices[0].message.content