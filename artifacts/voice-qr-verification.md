# Voice and guided QR verification — 14 October 2026

## Verified in this workspace

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: all 12 tests passed (payment parsing, spoken input, speech-service discovery, TTS deadline, QR directions, and sustained centering).
- Android native prebuild in `.expo/native-validation`: passed; generated manifest has microphone/vibration permissions and visibility for Google and Speech Recognition & Synthesis.
- Generated Android shortcut and string-resource XML parsed successfully; voice-payment and scan shortcuts both present.
- `npx expo export --platform android --output-dir .expo/android-bundle-check`: passed, including Hermes bytecode compilation.

## Replacement Android build

[EAS build and APK download](https://expo.dev/accounts/ndverano/projects/payabl/builds/4ea468f1-26dc-4ee1-8153-b8368df7318a)

This is the final build requested after the voice-service retry changes, with Android versionCode 2. The earlier preliminary build was canceled. Building and automated tests do not verify microphone capture or physical vibration.

## Required Xiaomi phone checks

1. Install the replacement APK over the current Payabl app once the build finishes.
2. Allow microphone access and enable the phone's system microphone switch. Google or Speech Recognition & Synthesis must be installed/enabled with English supported.
3. Open Pay family, wait for the listening vibration, and say a saved contact's full name. Verify the selected recipient. On the amount screen, say “two hundred fifty rupees”; verify 250 and the correct recipient before continuing.
4. Cancel listening and retry; background the app while listening and return; deny/regrant permission. Verify there is no ongoing microphone capture or stuck listening state. Missing services and capture/network errors should show distinct recovery messages.
5. Display `artifacts/sample-payment-qr.png` on another screen. Move the readable QR to each edge of the preview. Verify movement instructions and Android patterns: left one short, right two short, up one long, down two long, centered three short.
6. Hold the same QR centered for a second. Verify it opens the correct recipient/amount once. Change codes or remove the QR during centering; it must not accept the stale code. Background or leave the scanner; vibration/camera must stop. Try an invalid QR and then Scan again.

Guidance starts when the camera API returns a decoded QR position. Undecodable/out-of-view QRs have no location event through this API. iOS haptics differ from Android pulse timing.

## Assistant checks requiring external setup

- Android: long-press the app icon and check Voice payment and Scan QR. Assistant discovery needs Google Play registration or an App Actions preview; it is not enabled merely by sideloading. Check “Hey Google, open voice payment in Payabl” and “Hey Google, open scan QR in Payabl” after that setup.
- iOS: `plugins/PayablShortcuts.swift` is registered as a build source by the Expo config plugin. iOS prebuild cannot run on this Windows host. Compile/sign an iOS build and verify the two actions in Shortcuts and Siri, including “Start a voice payment in Payabl” and “Scan a QR with Payabl.” iOS compilation and device behavior remain unverified.
- Assistant actions open the relevant screen; they never enter a PIN or confirm a payment.
