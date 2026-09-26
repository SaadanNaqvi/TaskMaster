import cv2
import mediapipe as mp
import json
import os

from mediapipe.tasks import python
from mediapipe.tasks.python import vision


INPUT_VIDEO = "video/input/exercisez.mp4"
OUTPUT_VIDEO = "video/output/exercise_pose.mp4"
OUTPUT_DATA = "video/output/exercise_pose.json"
MODEL_PATH = "pose_landmarker_full.task"

os.makedirs("output", exist_ok=True)


def main():

    cap = cv2.VideoCapture(INPUT_VIDEO)

    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {INPUT_VIDEO}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    print(f"Video: {width}x{height}")
    print(f"FPS: {fps}")
    print(f"Frames: {frame_count}")

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")

    writer = cv2.VideoWriter(
        OUTPUT_VIDEO,
        fourcc,
        fps,
        (width, height)
    )

    # MediaPipe configuration
    base_options = python.BaseOptions(
        model_asset_path=MODEL_PATH
    )

    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.5,
        min_pose_presence_confidence=0.5,
        min_tracking_confidence=0.5
    )

    all_frames = []

    with vision.PoseLandmarker.create_from_options(options) as landmarker:

        frame_number = 0

        while True:

            success, frame = cap.read()

            if not success:
                break

            # OpenCV = BGR
            # MediaPipe = RGB
            rgb = cv2.cvtColor(
                frame,
                cv2.COLOR_BGR2RGB
            )

            mp_image = mp.Image(
                image_format=mp.ImageFormat.SRGB,
                data=rgb
            )

            timestamp_ms = int(
                frame_number * 1000 / fps
            )

            result = landmarker.detect_for_video(
                mp_image,
                timestamp_ms
            )

            frame_data = {
                "frame": frame_number,
                "timestamp_ms": timestamp_ms,
                "landmarks": []
            }

            if result.pose_landmarks:

                landmarks = result.pose_landmarks[0]

                for landmark in landmarks:

                    frame_data["landmarks"].append({
                        "x": landmark.x,
                        "y": landmark.y,
                        "z": landmark.z,
                        "visibility": landmark.visibility,
                        "presence": landmark.presence
                    })

                # Draw skeleton
                for connection in vision.PoseLandmarksConnections.POSE_LANDMARKS:

                    start = connection.start
                    end = connection.end

                    p1 = landmarks[start]
                    p2 = landmarks[end]

                    x1 = int(p1.x * width)
                    y1 = int(p1.y * height)

                    x2 = int(p2.x * width)
                    y2 = int(p2.y * height)

                    cv2.line(
                        frame,
                        (x1, y1),
                        (x2, y2),
                        (0, 255, 0),
                        2
                    )

                # Draw joints
                for landmark in landmarks:

                    x = int(landmark.x * width)
                    y = int(landmark.y * height)

                    cv2.circle(
                        frame,
                        (x, y),
                        4,
                        (0, 0, 255),
                        -1
                    )

            all_frames.append(frame_data)

            writer.write(frame)

            cv2.imshow(
                "TaskMaster Pose",
                frame
            )

            if cv2.waitKey(1) & 0xFF == 27:
                break

            frame_number += 1

            if frame_number % 30 == 0:

                print(
                    f"Processed "
                    f"{frame_number}/{frame_count}"
                )

    cap.release()
    writer.release()
    cv2.destroyAllWindows()

    with open(OUTPUT_DATA, "w") as f:

        json.dump(
            all_frames,
            f,
            indent=2
        )

    print()
    print("Finished.")
    print(f"Video: {OUTPUT_VIDEO}")
    print(f"Data:  {OUTPUT_DATA}")


if __name__ == "__main__":
    main()