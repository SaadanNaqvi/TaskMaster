# TaskMaster — Master Context

Status: early planning stage (no code yet). This doc expands on `plan.md` to give teammates a shared picture of the product idea.

## Vision

Help users fix their exercise form by overlaying a chosen professional's/model's movement on top of a video of the user doing the same exercise, so the difference in form is visible directly.

## MVP Scope

- User picks any professional (or another user) as the reference.
- Their movement is overlaid onto the user's own recorded exercise video.
- The overlay is **not scaled up** to fit the user — it's placed as-is, so true form/positioning differences are visible.
- Output shows the professional's overlay on top of the user's recording, aligned using spatial awareness (i.e. the overlay is positioned/tracked relative to where the user actually is in the frame, not just pasted statically).

## User Workflow

1. Choose an exercise.
2. Upload a video of themselves doing that exercise.
3. Choose the desired professional (or user) to compare against.
4. Get the result back: an overlay of the professional on top of the user in the video, using spatial awareness for alignment.

## Open Questions / Not Yet Decided

These aren't in `plan.md` but will need answers before implementation starts:

- **Tech stack**: no frontend/backend/mobile decision made yet.
- **Pose/motion tracking approach**: what powers "spatial awareness" — e.g. pose estimation (MediaPipe, OpenPose, etc.) to align the overlay to the user's body position per frame.
- **Reference video library**: where "professional" videos come from — pre-recorded library vs. user-uploaded, exercise coverage, licensing.
- **Overlay rendering**: real-time vs. async/processed result; video vs. skeleton/wireframe overlay.
- **Exercise catalog**: which exercises are supported at MVP.
- **Platform**: web, mobile, or both.

## Source

Raw notes: [`plan.md`](./plan.md)
