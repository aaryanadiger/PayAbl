# Payabl

Payabl is an Expo prototype for making a simple payment flow easier to use without sight. The interface uses large controls, spoken prompts, vibration, and a fixed keypad intended to work with a tactile phone overlay. Payments are simulated; no bank or payment provider is connected.

## Run the app

1. Install [Node.js](https://nodejs.org/) and [Expo Go](https://expo.dev/go) on your iPhone.
2. In the project folder, run `npm install` and then `npm run tunnel`.
3. Scan the QR code in the terminal with your iPhone camera and open it in Expo Go.

The tunnel requires this computer and Expo to stay online. For a local connection, run `npm start` with your phone and computer on the same Wi-Fi network. Run `npm run web` for a browser preview.

To try a payment, choose **Pay family**, select a contact, enter an amount, review it, then enter any four demo keypad presses. The demo PIN is not stored, and no money moves. Do not enter a real payment PIN.

## Keypad and accessibility

The 3-by-4 keypad appears after selecting a recipient and stays in the same position for amount and PIN entry. It uses the same layout throughout the app: 1–9, then Delete, 0, and the next action. The raised center marker is intended to align with a tactile overlay. Voice guidance, VoiceOver labels, and optional vibration support navigation.

The keypad has one fixed layout; users do not need to align it. The prototype uses the standard UPI number order, but its physical dimensions have not been measured against Google Pay on the iPhone 17 Pro Max. The casing should be designed from a measured provider keypad, then tested with blind and low-vision users.

QR payments accept supported `upi://pay` details for the demo. A QR code does not verify who will receive a payment, so check the recipient on the review screen. The app does not open QR links.

## Voice input and spoken guidance

On an installed phone build, voice entry starts automatically on the contact screen and on empty amount entry. Payabl requests microphone and speech-recognition access, speaks a short prompt, then vibrates when listening starts. **Speak name** and **Speak amount** let you retry. Automatic voice entry can be turned off in Settings. Permission denial leaves the buttons and keypad available.

Say a full contact name or a whole amount, such as “two hundred fifty rupees.” The app reads the result back; review it before continuing. Voice input never enters a PIN or confirms a payment. Audio recordings and transcripts are not saved by Payabl. The device's speech service may require a network connection and process audio remotely.

Spoken guidance starts automatically and does not require a microphone or Siri permission. Payabl selects an available English voice, requests full speech volume, and lets iOS manage a separate speech audio session. When VoiceOver or TalkBack is active, screen-reader announcements provide the guidance. Keep the phone's volume audible; iPhone audio still needs on-device verification. Spoken guidance can be changed in Settings.

Native voice input requires an installed Payabl build; Expo Go can still run the rest of the prototype. Android APK builds include the app and do not need a running Expo server. Build one using `npx eas-cli@latest build --profile preview --platform android`. iPhone builds require Apple signing and device registration. Browser voice input depends on browser support and microphone permission.

Payabl uses Apple Speech on iOS and the device's speech-recognition service on Android. These are not Siri or Google Assistant conversations. The Android app has a Voice payment launcher shortcut and an App Actions declaration for opening the voice-payment screen. Google Assistant discovery requires Google Play registration or Google's testing tools. On a signed iPhone build, an Apple Shortcut can open `payabl:///?screen=contacts`; name that shortcut to invoke it through Siri.

## Account and contacts

The person icon opens Account; the wheel opens Settings. Account stores your name and optional phone number locally and provides contact import, voice permission setup, and payment history. This is a local demo profile, not a bank login.

The first visit to Pay family requests contacts access. Payabl reads only permitted names and phone numbers, keeps them on the device, and supports search and spoken selection. Import can be retried from Account, including after granting limited access on iPhone. Phone contacts do not prove UPI registration; payments to them remain simulated.

## Commands

- `npm start` — start Expo
- `npm run start:go` — start explicitly for Expo Go
- `npm run start:dev` — start for the development app with native voice input
- `npm run tunnel` — start Expo with a network tunnel
- `npm run ios` / `npm run android` — start Expo for a connected simulator or device
- `npm run web` — start the browser preview
- `npm run lint` — check code style
- `npm run typecheck` — check TypeScript
- `npm test` — run payment parsing tests

made with ❤️ by aarya
