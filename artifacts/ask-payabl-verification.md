# Ask PayAbl verification — 15 October 2026

## Refinement — 21 October 2026

- Removed the normally visible Scan QR / Pay contacts landing buttons. They
  remain available after an error, including recognition/permission failure.
- Removed Cancel from amount and review headers; Back retains its one-step
  behavior. The bottom Ask PayAbl area stays in its existing position.
- Recognition errors now go through the shared error handler, which exposes
  the manual recovery actions. Removed duplicate recognition-error text from
  the microphone control; the screen displays/announces it once.
- Updated the initial cue and Help text to match this behavior.
- Changed `src/Payabl.tsx`, `src/VoiceInput.tsx`, `README.md`,
  `PAYAbl_CODEX_HANDOVER.md`, and this report.
- `npm run lint`, `npm run typecheck`, and `git diff --check` passed.
- Hardware-button mapping and Google/Siri integration were researched only;
  no new native shortcut or paid service was added. Test device reported by
  the user: iQOO Neo 7 Pro, Android 16. Verify OEM shortcut availability on
  that installed firmware before relying on it.

## Implemented locally

- Large tap-to-speak entry screen after the native splash, with Scan QR and Pay contacts fallback buttons.
- One shared microphone session per screen. Ask PayAbl stays below the amount keypad and at the bottom of subsequent screens. Headings, navigation controls, contact choices, and keypad keys expose a custom Ask PayAbl accessibility action.
- Explicit activation only; old automatic-voice preferences and shortcut query parameters no longer start recording.
- Deterministic Scan QR, Pay contacts, Send money to a name, Repeat, Stop speaking, Go back, and Help commands. Contextual contact/amount input and numbered duplicate-name choices. No voice confirmation intent.
- Brief screen cues, one voice-amount readback, explicit recipient/amount review, and no running-total speech after every manual key. App TTS yields to screen-reader announcements.
- QR speech announces direction changes with a minimum 2.5-second interval; repeated haptics remain. Camera pauses during assistant use. Stop speaking also cancels recognition and suppresses automatic speech for the current screen.
- No custom PIN screen. The review button creates only an explicitly simulated receipt. No live payment provider is connected.
- SDK-compatible patch updates through Expo's installer: Expo 57.0.30 and Expo Router 57.0.28. Existing speech packages retained; no new dependency added.

## Commands and results

- `npm run lint`: passed, no warnings/errors.
- `npm run typecheck`: passed.
- `npm test`: 15 passed, 0 failed. Tests cover command boundaries, rejection of voice confirmation, contact ambiguity/option bounds, amounts, QR validation, scan continuity, direction throttling, recognition service selection, and a stalled speech operation.
- `npx expo install --check`: online check initially found the two patch mismatches above.
- `npx expo install expo@~57.0.30 expo-router@~57.0.28`: completed; root package declarations and lockfile agree.
- `npx --yes expo-doctor`: final result 21/21 passed.
- `npx expo config --type introspect --json`: passed. Checked microphone permission, speech plugin, Google speech-service visibility, and iOS permission copy. Generated inspection output is in ignored `.expo/ask-payabl-config.json`.
- `npx expo export --platform android --output-dir .expo/ask-payabl-android --max-workers 2`: passed, including Hermes bytecode, after the final speech changes and package updates. Initial sandbox execution failed writing a temporary Hermes file; rerunning with normal filesystem access succeeded.
- `npm ci --dry-run --ignore-scripts --no-audit --no-fund`: passed before patch upgrades; it did not reinstall packages.
- `git diff --check`: passed.
- Browser preview at 360 × 640: entry screen, contact selection, amount 250, review, explicit demo completion. Ask PayAbl fits below the keypad. After the dependency updates, the entry screen loaded again with no browser console errors.

These checks do not constitute an Android APK/native Gradle build, iOS compilation, or physical-device verification. No EAS cloud build, Git commit, or GitHub push was performed.

The package installer reported 29 audit findings (11 moderate, 18 high), which were not remediated as part of this feature. No `npm audit fix --force` was run. Node's existing module-type warnings occur in the test runner but do not fail tests.

## Files changed

- `src/Payabl.tsx`: shared assistant, entry UI, concise guidance, context routing, contact choices, explicit demo confirmation, PIN-screen removal.
- `src/VoiceInput.tsx`: explicit shared-session activation/cancellation, large entry style, listening feedback, no spoken preparation prompt.
- `src/voice.ts`: deterministic intents, matching candidates, bounded choice selection, spoken recipient identity.
- `src/voiceService.ts`: bounded native speech operations.
- `src/GuidedQRScanner.tsx`, `src/qrGuidance.ts`: nonrepeating/rate-limited speech that yields to other guidance.
- `src/AccountPage.tsx`: cancel listening during manual account interaction; microphone permission label.
- `tests/voice.test.ts`, `tests/guidance.test.ts`: new behavior and safety tests.
- `app.json`: microphone/speech permission descriptions for Ask PayAbl.
- `package.json`, `package-lock.json`: recommended Expo/Router patch updates; pre-existing local dependency changes preserved.
- `README.md`, `PAYAbl_CODEX_HANDOVER.md`, this report: current behavior, security boundaries, and testing status.

## Required phone checks

1. Build/install a compatible development build or preview APK. Expo Go cannot test the native recognition module. No GitHub commit/push is needed to test local changes.
2. Launch fresh and with old saved preferences. No microphone should start until Ask PayAbl is activated. Test the entry area, footer, and TalkBack custom action. Verify focus order and largest text settings on the target device.
3. Deny microphone access, deny permanently, retry through Settings, and test missing/offline/busy recognition services. Fallback controls must remain reachable. Check cancel, rapid repeated activation, backgrounding, and navigation while permission or recognition is pending.
4. Try every command and ambiguous utterances. Verify no command confirms payment, collects a PIN, or starts listening on another screen automatically.
5. Use two saved contacts with the same name. Check spoken/visible identities, numbered choices, invalid options, selecting by touch, and Back. Check a Send money to command before first contact import and after denied/limited contact access.
6. Enter an amount manually with TalkBack and without it. Verify no repeated whole-total speech, correct Repeat, one voice-amount readback, editable review, and explicit demo confirmation. Test cancellation and duplicate taps.
7. Scan valid/invalid QRs; verify duplicate-scan protection, direction-change speech, haptics, lost code, and recovery. Activate Ask PayAbl during scanning and verify camera/audio behavior.
8. Verify app speech and TalkBack do not compete. Stop speaking controls app TTS; the screen reader retains its own speech controls.
9. Remeasure amount-keypad and footer coordinates before fabricating the passive **3D-printed** stencil. No electronics. Provider authentication and any permitted provider keypad alignment remain separate, unimplemented work.
