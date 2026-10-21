# Stencil shortcut and demo PIN practice — 21 October 2026

## Changes

### Subsequent UI cleanup

- Removed the visible Ask PayAbl button on contacts/amount/review while
  retaining its underlying shortcut-only microphone session and fixed spacer.
- Kept inactive keys dark instead of grey; accessibility disabled state and
  blocked actions are unchanged. Enabled confirmation remains highlighted.
- Browser check found no visible assistant button on contacts, identical
  dark backgrounds across active/inactive number keys, and hold-0 reached
  Listening. Native capture/haptics still need phone testing.
- Updated `src/Payabl.tsx`, `src/VoiceInput.tsx`, the handover, and this report.

- Added a 700 ms hold-0 microphone shortcut on contacts, amount, and review.
  Normal zero entry still works; long-press release does not add a zero or
  trigger another action. Voice commands cannot confirm payment.
- Contacts now show numbered pages of nine with matching keypad selection.
  Next advances and the bottom-left Back key returns to the previous page.
- Restored the user-requested demo PIN practice from local Git history's
  four-tap behavior, with the existing UI styling. It retains a count only,
  never a digit sequence. There is no real authentication or payment.
- Entering practice requires explicit review confirmation and cancels any
  microphone session. VoiceInput is unmounted on practice; all microphone
  buttons, custom actions, and hold-0 behavior are absent. Practice count
  resets on background, leaving the screen, or restarting the journey.
- Footer controls have fixed height; listening/error feedback goes in the
  scrollable content above the keypad, keeping stencil keys stationary.
- Removed repeated "No money moved" text and speech. Final heading and cue
  say "Payment demo complete"; the real-PIN warning remains on practice.
- No native dependency, stencil CAD file, payment provider, commit, push,
  or cloud APK build was added.

## Changed files

- `src/Payabl.tsx`: keypad availability, hold handling, contact paging,
  confirmation/practice flow, microphone isolation, stable footer, copy.
- `src/keypad.ts`: shortcut allowlist, timing, contact indexing, bounded
  practice-tap counts.
- `src/VoiceInput.tsx`: compact fixed-height footer presentation; status
  and recovery actions appear outside the stencil area.
- `tests/payment.test.ts`: shortcut allowlist, current-page selection,
  and bounded demo count tests.
- `README.md`, `PAYAbl_CODEX_HANDOVER.md`, this verification report.

## Validation

- `npm test`: 18 passed, 0 failed.
- `npm run lint` and `npm run typecheck`: passed, including the rerun after
  the final wording refinements.
- Android export with Hermes bytecode passed:
  `npx expo export --platform android --output-dir .expo/hold-zero-android --max-workers 2`.
  The subsequent changes were completion/review copy only.
- Browser test at 360 by 800: hold-0 on contacts reached Listening. Stop
  canceled it. Selecting keypad 1 chose the corresponding contact. Short
  taps entered 250 correctly. Hold-0 on amount/review invoked microphone
  preparation/error recovery without changing 250 or advancing review.
- Browser microphone capture was not consistently available; subsequent
  attempts produced audio-capture errors. This verifies error recovery,
  not successful Android speech recognition.
- Demo practice: holding 0 counted one practice tap and never opened a
  microphone control. Deletion and four-tap readiness worked; Pay completed
  the simulation. The final completion copy had no redundant money message.
- Final review and practice zero-key bounds were identical at 360 by 800:
  x=127.6875, y=643.3334, width=104.625, height=68.6667 CSS pixels.
  These are browser measurements, not physical stencil dimensions.
- No browser console errors were observed in the checked flow.

## Phone checks still required

1. On the iQOO Neo 7 Pro/Android 16, check all stencil openings against
   contacts, amount, review, and practice, including listening/error states.
2. Test short tap versus hold-0, cancel/retry, microphone denial, TalkBack
   double-tap-and-hold/custom actions, and backgrounding during capture.
3. Verify microphone stops before demo practice; no long-press, TalkBack
   action, or assistant button can start it there. Verify count clears
   after backgrounding and Back. Never test with a real UPI PIN.
4. Test more than nine contacts, duplicate names on later pages, search,
   invalid keys/options, explicit review, and repeated confirmation taps.
5. Use an installed native build for Android speech testing. A browser
   test or Hermes export does not verify native audio, haptics, or APK fit.
