## Android haptic follow-up — 22 October 2026

- Android UI feedback now uses Expo performAndroidHapticsAsync with Virtual_Key,
  Confirm and Reject; native-call rejection falls back to short vibration.
- Removed the global 80 ms suppression that could drop rapid keypad taps and
  important ready/error feedback. Microphone readiness uses Confirm, and enabling
  vibration immediately gives confirmation. iOS taps use Medium feedback.
- Android system touch-feedback settings still apply; API success does not prove
  the motor ran. Actual iQOO vibration must be checked on device in a new build.

## Quieter amount entry — 22 October 2026

- Amount screen entry announces the recipient name and Enter amount, without
  repeating their phone number. Numbered contact identity choices remain.
- Manual amount taps no longer trigger app TTS for each digit. Key labels remain
  accessible to TalkBack; amount Repeat/Help, voice-entry readback and explicit
  review readback remain available.

## Phone voice fixes — 21 October 2026

- Cold-start speech/microphone handoff now checks actual TTS quiet state twice,
  bounded to eight seconds, instead of requiring stop() to settle in two seconds.
  Duplicate stop calls in prepareVoice were removed; canceled cue failures cannot
  overwrite current microphone status. Hardware verification remains required.
- Commands include Pay to contacts, Open/show contacts, Pay someone, scanner
  aliases, polite please wrappers, Say that again, Stop talking, and Instructions.
- Entering contacts resets query, suggestions, pending lookup, and page. Late
  contact-import announcements are suppressed after leaving their originating screen.
- Exact unique names retain identity readback. Partial or small spelling differences
  show numbered suggestions, even for one result, requiring explicit selection.
  Names are recognition hints (first 100); no new transcript storage or service.
- Missing action/row/account/back/stop and screen-transition haptics were connected
  to the existing preference-controlled feedback with rapid duplicate suppression.
- PIN isolation, count-only demo practice and passive stencil geometry are unchanged.
- Lint, typecheck and 21 regression tests pass. Native cold-start audio, TalkBack,
  actual recognition accuracy and vibration need retesting in a new installed build.

# PayAbl --- Codex Handover

Last updated: 15 October 2026. Read this before editing the repository.
Inspect the current code; do not assume every feature listed below is
already implemented.

## Current user-directed behavior — 21 October 2026

Build preflight on 21 October updated Expo to `~57.0.31` and Expo Router
to `~57.0.29` using Expo's installer, resolving the patch mismatches
reported by online Expo Doctor. No major SDK upgrade was performed.

This section supersedes earlier notes about removal of demo PIN practice.
The user explicitly requested its restoration for the simulated payment
journey, with all microphone entry points disabled on that screen.

- Hold the on-screen 0 key for 700 ms to start Ask PayAbl on contacts,
  amount, and review only. Releasing the hold must not enter an extra zero,
  select a contact, navigate, or confirm payment. A short amount-key tap
  still enters zero. TalkBack exposes a long-press/custom action; test the
  double-tap-and-hold gesture on the phone.
- All three screens and demo PIN practice share the same 3-by-4 keypad
  dimensions. Contacts are numbered in pages of nine, with Next/Back paging.
  Review uses the bottom-right Continue key for explicit details confirmation.
- The user's requested demo PIN step counts four taps only, never retains
  the tapped digits, and is not authentication. No VoiceInput component,
  Ask PayAbl accessibility action, hold-0 handler, or assistant button exists
  there. Existing recognition is canceled before entry. Practice count
  clears on leaving, restarting, or backgrounding. Direct entry without
  explicit review confirmation is rejected.
- This is a demo-practice exception only. The prohibition on real UPI PIN
  capture, transcription, logging, storage, speech, or protected-screen
  interception still applies. Live authentication remains provider-owned.
- Footer height is fixed on keypad screens, including a noninteractive
  spacer during demo PIN practice. Listening/error feedback is displayed
  above the keypad so keys do not shift under the passive stencil.
- The visible Ask PayAbl footer button is now removed from contacts,
  amount, and review; hold-0 and accessibility actions control the same
  mounted recognition session. An empty spacer preserves keypad geometry.
  Other screens retain their assistant control because they have no 0 key.
- Inactive number keys use the same dark background as active number keys;
  their disabled behavior and accessibility state remain intact. The bright
  confirmation key is used only when its action is available.
- The user removed the visible "Any 4 demo digits. Never use your real PIN."
  sentence from practice. The demo heading, microphone-disabled status, and
  spoken safety guidance remain; this is still count-only simulation.
- At the user's request, repeated "No money moved" messages were removed
  from visual and spoken output. Completion is labelled "Payment demo
  complete" so the simulation remains identifiable.
- No hardware change is required for the shortcut itself. Physical fit
  with the existing 3D-printed stencil must still be checked on the target
  phone; no CAD design was edited and no native library was added.

## Local implementation update — 15 October 2026

### UI refinement — 21 October 2026

The landing screen now shows the large Ask PayAbl area without the Scan QR
and Pay contacts buttons during normal use. Those manual recovery actions
appear when an error occurs, including microphone/recognition failure.
The overlapping Cancel action was removed from amount/review; Back remains
and returns one step. Existing bottom assistant placement is unchanged.
Hardware shortcuts and assistant integrations remain suggestions requiring
device-specific verification, not newly implemented functionality.

- Ask PayAbl is the initial screen after the native splash. Its large main
  area starts listening only on activation, with Scan QR / Pay contacts
  fallback buttons. A shared bottom shortcut appears on subsequent screens,
  below the amount keypad, with TalkBack custom actions on key controls.
- Existing colours, typography, buttons, and query-parameter Expo Router
  navigation are retained. No always-on listening or automatic screen-entry
  recording remains, including for old saved preferences or voice deep links.
- Short screen cues, Help, Repeat, Stop speaking, Go back, Scan QR,
  Pay contacts, and Send money to a name are implemented. Duplicate contact
  names produce numbered choices; final recipient/amount review requires a
  button confirmation. Voice does not authorize payment.
- The custom demo PIN screen was removed. Confirm demo payment creates an
  explicitly simulated receipt. Live initiation, provider authentication,
  and trusted transaction status checks are still NOT implemented.
- One recognition session is shared per screen and canceled on navigation,
  manual input, or backgrounding. Audio/transcripts are not persisted.
  Native speech stop/discovery have deadlines; QR guidance uses repeated
  haptics and throttled direction-change speech. Camera pauses for listening.
- The passive 3D-printed stencil remains required. The assistant footer
  changes amount-keypad placement: remeasure before printing. No physical
  stencil or permitted provider PIN-keypad alignment has been validated.
- Expo and Router were updated through Expo's installer to the SDK 57 patch
  versions recommended by online dependency validation. See
  `artifacts/ask-payabl-verification.md` for checks and remaining device tests.
- These changes are local; implementation does not imply a GitHub push,
  cloud APK build, provider integration, or physical-device validation.

## Project

PayAbl is an accessibility-focused mobile payment assistant for blind
and visually impaired users. Stack: React Native + Expo. Repository:
https://github.com/aaryanadiger/PayAbl.git, default branch `main`;
previously used local path `C:\Users\Danish\PayAbl`.

**Hardware is required by the problem statement:** it is ONLY a passive
3D-printed tactile numpad stencil placed over a phone screen. It has no
ESP32, electronics, sensors, wires, or active keypad. Do not remove the
hardware requirement or redesign it as electronic hardware.

## Intended user journey

1.  Voice-guided navigation.
2.  Scan a QR code or choose a recipient.
3.  Verify recipient; disambiguate duplicate contact names instead of
    silently selecting one.
4.  Enter amount and read it back.
5.  Explicitly confirm recipient and amount.
6.  Hand off to an authorized payment app/provider for secure PIN
    authentication.
7.  Announce the transaction result only after trusted verification.

## Global voice assistant

Add a consistent global "Ask PayAbl" microphone shortcut across screens,
ideally through shared navigation/layout. Prefer tap-to-speak over
always-listening. Support commands such as "Scan QR", "Send money to
Rahul", "Repeat that", "Stop speaking", "Go back", and "Help". Use
defined intents and deterministic navigation first. Ask clarifying
questions for ambiguous commands; never guess. Screen-reader users must
be able to access assistance without locating a visual microphone.

## Accessibility

-   Test with Android TalkBack.
-   Use accessible labels/roles/hints, large touch targets, strong
    contrast, and spoken status updates.
-   Do not rely on color or visual messages alone.
-   Handle microphone permission denial and speech-recognition failures.
-   Prevent duplicate QR-scan events.
-   Confirm recipient and amount before payment.
-   Never silently choose the first of multiple matching contacts.
-   Keep PIN authentication isolated from voice-processing logic.

## PIN security --- non-negotiable

Never capture, transcribe, store, log, or speak the UPI PIN. No
voice-to-text or text-to-speech for PIN digits. Do not build a custom
PIN collection screen, intercept a protected payment screen, or automate
secure PIN entry. Use an authorized payment interface/provider for
authentication.

The stencil is a passive tactile accessibility aid. It does not process
or transmit the PIN and is not itself a security mechanism. Only use it
if it aligns with the actual permitted PIN keypad layout. Different apps
may use different or randomized keypad layouts.

## Payment correctness

-   QR scanning alone does not prove a QR/recipient is trustworthy.
-   Returning from another app is not proof of payment success.
-   Distinguish success, failure, pending, processing, and unknown.
-   If a timeout makes the outcome uncertain, check status before
    suggesting a retry; never blindly retry.
-   Announce success only after a trusted status check.
-   Clearly label simulated payment outcomes as simulations.
-   Keep PINs and secrets out of logs/storage.
-   Live payment initiation/status verification needs a legitimate
    provider-supported integration. Do not assume a generic API can
    initiate or verify arbitrary UPI transfers.

The conversation has NOT confirmed that live UPI initiation or verified
payment status is implemented. Inspect code before making claims.

## Known development environment (verify before relying on it)

Previously reported Expo `57.0.28`, React Native `0.86.3`, Node
`v26.11.1`. `expo-speech` is used/planned for speech output.
`expo-camera` is used/planned for QR scanning; Android barcode scanning
uses ML Kit internally. Speech-to-text is separate: verify the current
library's compatibility with the Expo SDK and whether it requires a
development build; do not assume it works in Expo Go.

EAS was linked previously. Profiles previously included `preview` and
`development`, but not `production`. Verify `eas.json`; for an internal
APK, the prior command was
`eas build --platform android --profile preview`.

Android SDK was previously missing at
`C:\Users\Danish\AppData\Local\Android\Sdk`, and `adb` was not
recognized. Verify current setup.

## Dependency repair history

Previously, `node_modules` contained incomplete packages and errors
referenced `lodash.throttle`, `stream-buffers`, and nested `debug`.
Manual package patching was attempted. If dependency corruption
recurs: 1. Inspect `package.json` and `package-lock.json`. 2. Stop
Metro/Expo. 3. Preserve source and lockfile; remove only `node_modules`,
then run `npm ci`. 4. If `npm ci` fails, inspect the full error before
proceeding. 5. Do not run `npm audit fix --force` or delete/regenerate
the lockfile as a first response. 6. Check Expo/React Native/Node
compatibility before changing versions.

## Suggested implementation order

1.  Inspect app structure, navigation, `package.json`, app config, and
    `eas.json`.
2.  Confirm existing QR and speech-output features before changing them.
3.  Implement the global Ask PayAbl entry point.
4.  Verify compatible speech-to-text for the current Expo SDK/build
    type.
5.  Implement safe intent routing, contact disambiguation, amount
    read-back, and explicit confirmation.
6.  Keep PIN authentication in the authorized payment flow.
7.  Test the passive stencil with the actual permitted keypad layout.
8.  Test payment states, errors, timeouts, and TalkBack.

## Codex working rules

-   Read this file and `AGENTS.md` if present.
-   Inspect before editing; do not rewrite the app broadly.
-   Make focused changes and preserve working features.
-   Report exact files changed, commands run, test results, and
    remaining manual tests.
-   Ask before major architecture changes, paid services, or changes to
    the stencil requirement.
-   Never add electronics, voice PIN entry, PIN transcription, always-on
    listening by default, or protected-screen bypasses.
-   Do not use `npm audit fix --force` as a routine fix.

## First task for a new Codex session

Read this file and inspect the repository. Report: (1) features
confirmed in code, (2) missing/incomplete features, (3) Expo/dependency
compatibility risks, and (4) the safest next small step for the global
Ask PayAbl shortcut. Do not begin with a broad rewrite.
