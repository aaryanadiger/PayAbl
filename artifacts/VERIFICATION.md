# Verification, 12 October 2026

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
