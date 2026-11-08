# Témoin

> A neutral third party in your pocket. **Show, don't rule.**

Témoin is a mobile app for amateur tennis matches played **without an umpire**. Phones placed around the court film every point and keep a score that both sides validate. When players disagree on a ball, anyone presses **VAR**: every phone in the session replays the point from its own angle, in slow motion, frame by frame, with zoom. The players decide together, looking at the same picture. The app never rules.

[**Releases**](../../releases) · [Roadmap](#roadmap) · [How it works](#how-it-works) · [License](#license)

---

## Why

In amateur tennis tournaments, there is almost never an umpire. Players call the lines and keep the score themselves. When a point is disputed, they replay it, or the least insistent player gives in. It costs focus, creates tension, and sometimes decides the match.

Research with players (interviews, surveys, benchmark) showed that the problem is not knowing whether the ball was in. It is that **nobody neutral is there to settle it at the right moment**. A decision is only accepted when it is calm, explained, and backed by evidence that both sides can see. Players distrust black-box verdicts.

Between professional systems (around $100,000 per court) and stats-oriented amateur apps, nothing shows the evidence to both players or keeps a score validated by both sides. Témoin fills that gap with the phones already on the court.

## How it works

1. **Create a session** on one phone. Other phones can join by scanning a QR code, now or later in the match.
2. **Place the phones** behind the baselines (one is enough, each extra phone adds an angle). The app detects the court lines.
3. **Play.** Each phone films point by point and keeps only the current and previous points. The score is updated by a tap, or by voice when the server calls it out.
4. **Disagree? Press VAR.** Every phone opens the replay of the same point from its own angle. The players choose: point for one side, point replayed, or the fallback rule agreed before the match.
5. **End of match.** All videos are deleted.

Principles:
- **Show, don't rule.** Any assistance (bounce, in or out) comes with its uncertainty, never as a verdict.
- **Stay out of the way.** No interaction during a rally.
- **Everything stays local.** No server, no account, no cloud. Videos never leave the session's phones.
- **No vision model.** Ball and court detection use classic computer vision (OpenCV and geometry). The only embedded model is offline French speech recognition.

## Roadmap

Each version adds a building block without breaking the previous one. Each version ships as a [release](../../releases).

| Version | What it does | What it validates | Status |
|---|---|---|---|
| **V0** | Point-by-point recording, VAR button, replay in slow motion and frame by frame with zoom, score updated by tap and shared across phones (Bluetooth, Wi-Fi fallback) | Seeing the same picture is enough for two players to settle a dispute, and the shared score holds | In progress |
| **V0.5** | Voice scoring: the app recognises the server's call, updates the score and cuts the point's clip, with no one touching the phone | The phone can disappear during the rally | Planned |
| **V1** | Assisted reading: ball tracking in the replay, court lines and bounce highlighted, in or out with a confidence score ("70% sure the ball was out"), never imposed | Detection actually helps read the picture and builds trust | Planned |
| **Later** | View another phone's angle on one screen, host handover, doubles UI polish, thermal management | | Ideas |

## Tech stack

- **Expo** (development build) + **React Native** + **TypeScript**, iOS and Android, mixed sessions supported
- **react-native-vision-camera** for recording, **react-native-video** for replay
- **Vosk** (`vosk-model-small-fr-0.22`) for offline French speech to text, with a grammar constrained by the score state
- **Bluetooth Low Energy** between phones, local Wi-Fi as automatic fallback
- **OpenCV** (via `react-native-fast-opencv`) for pixels, geometry (homography, Kalman filter, bounce detection) in pure TypeScript

Architecture, conventions and design system: [`CLAUDE.md`](CLAUDE.md), [`DESIGN.md`](DESIGN.md), [`docs/schemas`](docs/schemas).

## Getting started

Requires Node.js, Xcode (iOS) and/or Android Studio (Android). Expo Go is not supported: the camera, speech and Bluetooth modules need a development build.

```bash
npm install
npm run setup:model          # downloads the Vosk French model
npx expo prebuild --clean
npx expo run:ios --device    # or: npx expo run:android --device
npm test
```

## Privacy

- Recording starts only after every player has agreed on screen.
- Videos are stored on the phone that filmed them, and deleted at the end of the match (and at launch, after a crash).
- No video, score or name is ever sent to a server. Player names can be first names or initials.

## Project context

Individual project, Master's degree in Computer Science, Gobelins Annecy. Designed and developed by Tom Boullay.

## License

Copyright © 2026 Tom Boullay. **All rights reserved.**

The source code is public so it can be read and evaluated, but this is **not** an open-source project. Any use, copy, modification or distribution requires the author's prior written permission. See [`LICENSE`](LICENSE).
