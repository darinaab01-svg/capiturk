# Capitürk — native iPhone app

Capitürk is a Swift + SwiftUI iOS application. Open `Capiturk.xcodeproj` directly in Xcode. There is no web runtime, WebView, JavaScript app, PWA, package installation or generated-project prerequisite.

## Run on a physical iPhone

1. Clone this repository on a Mac with Xcode 16 or later.
2. Open `Capiturk.xcodeproj` and select the shared **Capiturk** scheme.
3. In **Signing & Capabilities**, choose your development Team and replace `com.example.capiturk` with a unique bundle identifier. Automatic signing is enabled; no signing credentials are committed.
4. Connect an iPhone running iOS 17 or later, enable Developer Mode when requested, select the iPhone as the run destination, then Run.
5. Start a lesson. Allow Microphone and Speech Recognition when starting a speaking exercise. Install a Turkish system voice if iOS cannot find one.

GitHub stores source code; a repository URL cannot install a native iPhone app. TestFlight distribution additionally requires an Apple Developer team, signing, an archive and an App Store Connect upload.

## Implemented learning flow

- Native onboarding, profile, sequential course, word library, phrase and dialogue audio library, saved progress and achievements.
- First module: five lessons, a final conversation, 32 active words, three additional words, 15 phrase groups and 130 exercises.
- Every bundled vocabulary item, example, phrase and mini-dialogue line has a native Turkish audio control using AVSpeechSynthesizer with a `tr-TR` voice. Dynamic names/cities are resolved before speech.
- Speaking exercises request Microphone and Speech Recognition permission. AVAudioRecorder records up to 45 seconds with a live meter. AVAudioPlayer plays the recording back. SFSpeechRecognizer with `tr-TR` recognizes the recording and compares words to the target.
- A phrase is credited only after an accepted recognition result. Short phrases require exact normalized word order; longer phrases require at least 85% word-sequence similarity. Turkish dotted/dotless letters remain distinct. This is transcript matching, not a clinical or phonetic accent score.
- Failed/denied/unavailable recognition never marks an exercise successful. The interface offers replay, re-record and recognition retry. The previous manual self-report completion path has been removed.
- Context-sensitive Capi mascot: welcome, learning, listening, speaking, thinking, correct, retry, café, travel, city, profile, celebration. Twelve separate bundled assets preserve her caramel fur, pink bow and face.
- Native press feedback, configurable sounds and haptics, animated progress, crossfades, breathing, recording meter, playback indicator and completion confetti. Reduce Motion and app background state pause mascot animation.

## Audio and privacy

Recordings are temporary and deleted on leaving the exercise. Progress and profile are stored in local UserDefaults. When Turkish on-device speech recognition is supported it is requested explicitly; otherwise Apple’s recognition service requires internet and processes the audio after system permission. The UI and permission text disclose this. No developer backend, analytics SDK, account or audio storage server is used.

Recognition has a 30-second timeout and ignores callbacks from cancelled exercises. Audio stops on backgrounding/interruption. Permission prompts do not invalidate a pending request merely because the app becomes inactive.

## Source map

- `Voice.swift`: native playback, permission flow, recording, recognition and audio lifecycle.
- `SpeechComparison.swift`: deterministic Turkish transcript matching.
- `Mascot.swift`: reusable state resolver, twelve assets, native motion and sound cues.
- `LessonPlayer.swift`: interaction-driven exercises and completion evidence.
- `LessonAudioLibrary.swift`: every word/example/phrase/dialogue line with audio.
- `Store.swift`: persistence, migration, progression and feedback.
- `Module1.json`: bundled learning content, no network dependency.
- `CapiturkTests`: content, progress, migration, speech comparison and mascot tests.
- `.github/workflows/ios.yml`: unsigned physical-device build and simulator tests on macOS.

## Verification

See `VERIFICATION.txt` for current executed checks and `DEVICE_TESTS.md` for physical-iPhone acceptance steps. A simulator build does not establish real microphone, Turkish voice or haptic behavior on a physical iPhone.

## Artwork

All twelve assets and their prompts are included. See `ARTWORK.md`. No downloaded or generated assets outside the repository are needed to build.
