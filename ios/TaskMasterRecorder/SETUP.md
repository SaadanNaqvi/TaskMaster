# Running TaskMaster Recorder on your iPhone

This folder has all the Swift source for a working app: pick an exercise, record a
clip with an on-screen framing guide, review/play back your saved clips. It's not
wired into Tony's backend — it's the recording tool for the reference-library
workstream, running standalone on your phone.

This Mac currently only has Xcode's Command Line Tools installed, not the full
Xcode app, so a project file couldn't be generated and verified here. Setup below
takes about 10 minutes.

## 1. Install Xcode

App Store → search "Xcode" → Get/Install (it's large, ~10GB+). Open it once so it
finishes installing components.

## 2. Create the project

1. Xcode → File → New → Project → **iOS → App**.
2. Product Name: `TaskMasterRecorder`. Interface: **SwiftUI**. Language: **Swift**.
   Uncheck "Include Tests".
3. Save it as `ios/TaskMasterRecorder` inside this repo (replacing/next to this
   folder — Xcode will create its own `.xcodeproj` there).
4. In the new project, **delete** the default `ContentView.swift` and the default
   `TaskMasterRecorderApp.swift` that Xcode generated.
5. Drag every file from this repo's `ios/TaskMasterRecorder/Sources/` folder
   (keeping the `Models`/`Services`/`Views` subfolders as groups) into the Xcode
   project navigator. Check "Copy items if needed" and add to the
   `TaskMasterRecorder` target.

## 3. Add camera/microphone permission text

Target → **Info** tab → add two rows:

| Key | Value |
| --- | --- |
| Privacy - Camera Usage Description | TaskMaster needs camera access to record reference exercise clips. |
| Privacy - Microphone Usage Description | TaskMaster needs microphone access to record audio with reference clips. |

## 4. Set deployment target

Target → General → Minimum Deployments → **iOS 17.0** (the clip list screen uses
`ContentUnavailableView`, which needs 17+).

## 5. Sign and run on your phone

1. Plug your iPhone into the Mac (or pair it wirelessly once via Xcode →
   Window → Devices and Simulators).
2. Target → **Signing & Capabilities** → check "Automatically manage signing" →
   Team → your personal Apple ID (Xcode adds a free "Personal Team" if you're not
   enrolled in the paid developer program — this is enough to run your own app on
   your own phone, it just needs re-installing every 7 days).
3. Top toolbar: pick your iPhone as the run destination (instead of a Simulator).
4. Press **Run** (▶).
5. First launch: on the iPhone, go to Settings → General → VPN & Device
   Management → trust your developer certificate, then relaunch the app from the
   home screen.
6. Grant camera/microphone permission when prompted.

## What it does

- **Reference Library** screen: Bench Press / Squat / Lat Pulldown / Deadlift,
  each showing how many clips you've recorded.
- Tap an exercise → live camera preview with a center-line + rule-of-thirds guide
  and a framing reminder (e.g. "Side-on · fixed distance · full body + bar in
  frame") so every clip for that exercise is shot the same way.
- Red button records/stops; clips save into the app's Documents folder
  (`ReferenceClips/`) with an `index.json` alongside them — same shape as the
  `library/index.json` contract in Tony's tech-stack doc, so this can plug
  straight into the backend later.
- "Clips (N)" button → list of saved clips for that exercise, tap to play back,
  swipe to delete.

## Getting clips off the phone

For now clips live in the app's sandbox. Easiest way to pull them onto a laptop
for the actual reference library: Xcode → Window → Devices and Simulators → select
the phone → your app → gear icon → "Download Container...", which gives you the
`ReferenceClips` folder including `index.json`.
