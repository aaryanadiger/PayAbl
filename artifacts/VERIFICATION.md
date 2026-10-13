# Verification, 12 October 2026

## Account, contacts, and APK revision — 13 October 2026

- Removed keypad practice and test QR screens/actions. Home keeps the two payment actions with separately labelled Account and Settings icons.
- Added a locally saved account profile, contact import with native permission prompts, limited-access handling, contact search, and paged contact rows.
- Imported phone numbers remain simulated recipients; they are not assumed to be UPI IDs. Contact-name matching now preserves Unicode and rejects duplicate names.
- Voice entry starts automatically on supported installed phone builds, requests permissions, speaks before recording, and gives a vibration when listening starts. PIN entry remains manual.
- Added a Voice payment Android launcher shortcut and OPEN_APP_FEATURE declaration. Google Assistant discovery still needs Google's registration/testing. Siri integration is not claimed for Expo Go.
- Lint, TypeScript, and eight parsing tests pass. Expo config confirms contacts and microphone permissions, with Android WRITE_CONTACTS blocked.
- Browser checks confirm account persistence and settings without practice controls. Native prompts, speech, and blind-user usability require actual phone testing.
- Initial EAS build failed because the old lockfile omitted Linux build dependencies. The replacement lockfile passes a clean-install dry run; the retry targets Node 24.13.0.
- Automatic guidance now retries after Expo Go becomes active, selects an installed English voice, uses an independent iOS speech audio session, and enables guidance during migration from the older prototype cache. The downloadable APK is being rebuilt with this fix.
- Final EAS Android APK build 61ef79e8-f8e7-4ac0-8ae8-5c7f803d5302 finished successfully. Download instructions are in ANDROID-DOWNLOAD.md; Payabl.apk and its QR code are saved in artifacts. Actual phone speech and permission dialogs still need on-device testing.

## Voice input and fixed keypad

- Added contact-name and whole-rupee voice input with native permission requests, denial/settings recovery, cancellation, a 15-second timeout, and cleanup on navigation or backgrounding.
- App speech pauses during recording. Recognized amounts receive spoken readback; PIN entry and payment confirmation remain manual.
- Removed manual keypad alignment and persisted fit preferences. All entry screens use the same fixed keypad geometry.
- Expo configuration introspection confirms iOS microphone/speech usage descriptions and Android RECORD_AUDIO permission.
- Eight payment and voice parser tests pass. Lint passes without warnings and TypeScript passes. iOS and web exports complete.
- Browser review confirms voice controls on contacts and amount screens, normal payment review, and no voice input on PIN entry.
- Native recognition and permission dialogs still require testing in a signed development build. Exact Google Pay keypad dimensions are not yet measured.

- TypeScript check passed.
- Required Expo lint check passed with zero warnings after Router setup.
- Five unit tests passed: encoded UPI parsing; unsupported/unsafe QR rejection; whole-rupee amount bounds; native parser independence from React Native's partial URL implementation; malformed/duplicate-field rejection.
- Expo production bundles compiled for iOS, Android and web.
- Browser payment journey completed: Frequent → Ananya → ₹250 → review → four masked demo PIN taps → simulated receipt.
- The complete payment journey was repeated after the Expo Router migration; private PIN accessibility labels expose row/column instead of the number.
- Confirm disabled for zero amount and incomplete PIN.
- After the UI revision, default keypad bounds are identical on amount and PIN at a 440 × 956 browser viewport: x≈16, y≈648, width≈408, height≈296. Native safe-area insets change the coordinates on a phone.
- Alignment changed to 304 pt height, 98% width, 4 pt lift; saved geometry survived a page reload. Restored defaults after verification.
- Practice mode reflected numbered and Delete key presses.
- Local Expo iOS manifest responded at Wi-Fi address 192.168.0.189:8081.
- Across-network ngrok tunnel disconnected on both attempts. LAN server left running.

Not verified on physical hardware: camera decoding, speech audibility, haptic delivery, VoiceOver gestures, large-text layout on iOS, and silicone fit. The native bundles are compiled artifacts, not a signed App Store/TestFlight build.

## UI refinement

- Home now has two spacious payment choices with no keypad or numbered shortcuts.
- Keypad counts verified in the browser: home 0, contacts 0, scan 0, amount 1, review 0, PIN 1, completion 0. Alignment/practice intentionally retain the keypad.
- Complete Family → Dad → ₹250 → Review → Continue → four demo digits → Pay → Done journey passed.
- QR sample opens amount entry and reveals the keypad; Back returns to scanning and hides it.
- Home checked at a compact viewport and 440 × 956. Both main choices are visible. Updated screenshots: payabl-refined-home.jpg and payabl-refined-amount.jpg.
- Revised iOS and web production bundles compiled. TypeScript and lint checks passed.

## Essential UI revision

- Removed all marketing headings, desktop promotion, logos, illustrations, decorative avatars, helper subtitles, and the home history link.
- Home exposes Scan QR (upper touch area), Pay family (lower touch area), and Settings (top right). Spoken guidance identifies these positions.
- Contacts show names; amount entry shows recipient and amount; confirmation shows amount, recipient and UPI ID. Back and Cancel have text labels.
- History, keypad setup/practice, and camera-free QR testing are in Settings.
- Pay family → Dad → ₹250 → Next → Continue to PIN → four demo digits → Pay → Done passed in the browser.
- TypeScript and lint checks passed. Updated iOS and web bundles compiled. Screenshot saved as payabl-essential-home.jpg.
