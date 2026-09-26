from __future__ import annotations

import json
import time
from pathlib import Path

from fastapi.testclient import TestClient


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["stub"] is True


def test_exercises(client):
    response = client.get("/exercises")
    assert response.status_code == 200
    payload = response.json()
    assert payload[0]["id"] == "lift"


def test_create_job_and_result(client):
    video_path = Path(client.base_url.host)
    sample = Path("/home/tonypham/Taskmaster/TaskMaster/backend/data/uploads/sample.mp4")
    with sample.open("rb") as fh:
        response = client.post(
            "/jobs",
            files={"video": ("sample.mp4", fh, "video/mp4")},
            data={"exercise": "squat", "reference_id": "pro_squat_1"},
        )
    assert response.status_code == 202, response.text
    job_id = response.json()["job_id"]

    for _ in range(50):
        status_response = client.get(f"/jobs/{job_id}")
        if status_response.json()["status"] == "done":
            break
        time.sleep(0.05)

    status = client.get(f"/jobs/{job_id}").json()
    assert status["status"] == "done"
    result = client.get(f"/jobs/{job_id}/result")
    assert result.status_code == 200
    payload = result.json()
    assert payload["exercise"] == "squat"
    assert payload["video_url"].startswith("/files/outputs/")


def test_static_file_range(client):
    file_path = Path("/home/tonypham/Taskmaster/TaskMaster/backend/data/uploads/sample.mp4")
    response = client.get("/files/uploads/sample.mp4", headers={"Range": "bytes=0-99"})
    assert response.status_code == 206
    assert len(response.content) == 100
