# TaskMaster: iPhone App Tech Stack

Companion to [`TaskMaster Tech Stack and Module Split.md`](./TaskMaster%20Tech%20Stack%20and%20Module%20Split.md) (@Tony). That doc's pipeline (M1–M5: pose extraction, sync, alignment, scoring, rendering, FastAPI job runner) stays exactly as designed — the iPhone app is a second client on top of the same API, alongside the web frontend (M6).

## Approach

Native SwiftUI client, no on-device CV. The phone uploads/polls/plays against the existing FastAPI endpoints; all pose extraction, DTW sync, and rendering stay server-side in Python. This avoids re-deriving M1–M3 in Swift and reuses Tony's whole pipeline unchanged.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Language / UI | Swift + SwiftUI | Native, fastest to build a handful of screens for a demo |
| Video capture / pick | `AVFoundation` (camera) + `PHPickerViewController` (photo library) | Standard iOS ways to get a side-on video of the user |
| Networking | `URLSession` multipart upload (async/await) | Hits `POST /jobs`, `GET /jobs/{id}`, `GET /jobs/{id}/result` directly — no extra backend needed |
| Job polling | async/await polling loop off `GET /jobs/{id}` | Matches backend's `queued → extracting → syncing → rendering → done/failed` status model |
| Video playback | `AVPlayer` / `AVPlayerViewController` | Plays the returned mp4 from `video_url` |
| Overlay draw (optional, client-side) | SwiftUI `Canvas` or `CALayer`, drawing from `Alignment` + `PoseSequence` JSON | Same fallback idea as the web frontend's canvas overlay, in case server-rendered video isn't ready |
| Data models | `Codable` structs mirroring `backend/schemas.py` | Keep 1:1 parity with `PoseSequence`, `Reps`, `Alignment`, `FormReport`, library entry contracts |
| Local temp storage | `FileManager` temp dir for the clip before upload | No CoreData/SQLite needed at MVP |
| Run for demo | Xcode → personal iPhone (dev build), no App Store / TestFlight needed | Fastest path for a hackathon-style demo |

## Screens (mirrors Tony's M6 web frontend)

1. Exercise picker — `GET /exercises`
2. Reference picker (thumbnails) — `GET /references?exercise=...`
3. Record/upload — camera or picker → `POST /jobs`
4. Progress screen — polls `GET /jobs/{id}`
5. Results screen — `AVPlayer` plays result video, shows score + flags list from `GET /jobs/{id}/result`

## Module addition to Tony's table

| # | Module | Scope | In, out | Done when | Owner |
| --- | --- | --- | --- | --- | --- |
| M6-iOS | iPhone client | SwiftUI screens above, calling the same API as M6 web | API, UI | Full flow works on a phone without touching a terminal | TBD |

## Risks specific to the iPhone client

| Risk | Mitigation |
| --- | --- |
| Physical iPhone can't reach `localhost` on the laptop (unlike the Simulator) | Point the app at the laptop's LAN IP, or the ngrok URL Tony's doc already mentions for the demo |
| Large video upload over Wi-Fi during a live demo | Downsample/compress on-device before upload (match backend's 15fps/720p expectation) |
| Camera/photo-library permissions missing at demo time | Add `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription` to Info.plist early, test on a real device well before the demo |
| Background/foreground interrupts long-running upload or poll | Keep the upload+poll flow foreground-only for MVP; skip background task handling |
