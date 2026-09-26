from __future__ import annotations

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class JobStatus(str, Enum):
    queued = "queued"
    preparing = "preparing"
    extracting = "extracting"
    syncing = "syncing"
    scoring = "scoring"
    done = "done"
    failed = "failed"


class Category(BaseModel):
    id: str
    name: str


class Exercise(BaseModel):
    id: str
    name: str
    category: str


class ReferenceOut(BaseModel):
    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1, max_length=80)
    exercise: str
    source: str
    video_url: str
    thumbnail_url: str


class JobCreated(BaseModel):
    job_id: str


class JobStatusOut(BaseModel):
    job_id: str
    status: JobStatus
    progress: float = Field(..., ge=0.0, le=1.0)
    error: str | None = None
    exercise: str | None = None
    reference_id: str | None = None
    created_at: str


class CreateReferenceIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_id: str
    name: str
    consent: bool

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        stripped = value.strip()
        if len(stripped) < 1 or len(stripped) > 40:
            raise ValueError("name must be 1 to 40 characters after stripping")
        return stripped


class ErrorBody(BaseModel):
    error: dict[str, Any]


class PosePoint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    x: float
    y: float
    z: float
    visibility: float = Field(..., ge=0.0, le=1.0)


class PoseFrame(BaseModel):
    model_config = ConfigDict(extra="forbid")

    t: float = Field(..., ge=0.0)
    landmarks: list[list[float] | None] = Field(..., min_length=33, max_length=33)

    @field_validator("landmarks")
    @classmethod
    def validate_landmarks(cls, value: list[list[float] | None]) -> list[list[float] | None]:
        for item in value:
            if item is None:
                continue
            if len(item) != 4:
                raise ValueError("each landmark must be length 4")
        return value


class PoseSequence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fps: float = Field(..., gt=0)
    width: int = Field(..., gt=0)
    height: int = Field(..., gt=0)
    frames: list[PoseFrame]


class RepWindow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start: int = Field(..., ge=0)
    end: int = Field(..., ge=0)
    bottom: int = Field(..., ge=0)


class AlignmentFrame(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_frame: int = Field(..., ge=0)
    ref_frame: int = Field(..., ge=0)
    anchor: list[float] = Field(..., min_length=2, max_length=2)
    scale: float = Field(..., gt=0)


class FormReport(BaseModel):
    model_config = ConfigDict(extra="forbid")

    score: float = Field(..., ge=0.0, le=100.0)
    per_joint: dict[str, dict[str, Any]]
    flags: list[dict[str, Any]]


class JobResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_id: str
    video_url: str
    form_report: FormReport
    user_pose: PoseSequence
    ref_pose: PoseSequence
    alignment: list[AlignmentFrame]
    exercise: str


class LibraryEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    exercise: str
    source: Literal["pro", "user"]
    consent: bool = True
    video_url: str | None = None
    thumbnail_url: str | None = None
    pose_path: str | None = None
    video_path: str | None = None
    rep: dict[str, Any] | None = None


class ErrorEnvelope(BaseModel):
    error: dict[str, Any]
