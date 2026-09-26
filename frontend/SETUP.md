# Running TaskMaster Recorder in Expo Go

No Xcode needed for this path — you write JS/TS, run a dev server on your Mac,
and load the app straight onto your iPhone via Expo Go.

## 1. One-time setup

- On your iPhone: install **Expo Go** from the App Store.
- On this Mac (already done): `mobile/` has all dependencies installed
  (`expo-router`, `expo-camera`, `expo-file-system`, `expo-video`, `expo-sharing`).

## 2. Start the dev server

```bash
cd mobile
npx expo start
```

This prints a QR code in the terminal (also opens a page at `http://localhost:8081`
with the same QR code, easier to scan from there).

**If Expo Go hangs, is very slow, or shows a network error:** your Mac's Wi-Fi
is likely on a large managed/campus-style network (`10.x.x.x` with a `/16`
mask) that blocks phone-to-laptop traffic on the same Wi-Fi ("client
isolation") — very common on corporate/university/hotel networks. Fix:

```bash
npx expo start --tunnel
```

This routes the connection through a public relay instead of direct LAN, so it
works regardless of network isolation or firewalls. It's slower to bundle the
first time and needs a working internet connection, but it's reliable where
plain `npx expo start` isn't. (First run installs `@expo/ngrok` if not already
present — already installed in this project.)

## 3. Open it on your phone

- Make sure your iPhone is on the **same Wi-Fi network** as this Mac.
- Open the iPhone's Camera app and point it at the QR code (or open Expo Go
  directly and use its scanner) → tap the banner that pops up → it opens inside
  Expo Go.
- Grant camera and microphone access when prompted.

Every time you save a file in `mobile/`, the app on your phone hot-reloads —
no rebuild, no Xcode, no cable.

## What it does

- **Reference Library** (home screen): Bench Press / Squat / Lat Pulldown /
  Deadlift, each showing how many clips you've recorded.
- Tap an exercise → live camera preview with a center-line + rule-of-thirds
  guide and a framing reminder (e.g. "Side-on · fixed distance · full body +
  bar in frame") so every clip for that exercise is shot the same way.
- Red button records/stops; clips are saved on-device (`ReferenceClips/` +
  `index.json` inside the app's sandbox), same shape as the `library/index.json`
  contract in Tony's tech-stack doc.
- "Clips (N)" → list of saved clips, tap to play back.
- **Share** on a clip opens iOS's share sheet (AirDrop to your laptop, Save to
  Files, send in Messages, etc.) — this is how you actually get clips off the
  phone and into the shared reference library, since there's no Xcode container
  to pull from in this Expo Go setup.

## Notes / limits of Expo Go

- Everything here uses modules Expo Go already has built in
  (`expo-camera`, `expo-file-system`, `expo-video`, `expo-sharing`, `expo-router`),
  so no custom native build is required.
- If a future feature needs a native module Expo Go doesn't bundle, that
  requires a "development build" (`npx expo run:ios` or `eas build --profile
  development`) instead — a different, heavier path than this one.
- The Mac only has Xcode's Command Line Tools, not full Xcode — fine for this
  Expo Go workflow, but note if the project ever needs a real device build/EAS
  build locally later.
