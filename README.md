# Payabl

Payabl is an Expo prototype for making a simple payment flow easier to use without sight. The interface uses large controls, spoken prompts, vibration, and a fixed keypad intended to work with a tactile phone overlay. Payments are simulated; no bank or payment provider is connected.

## Run the app

1. Install [Node.js](https://nodejs.org/) and [Expo Go](https://expo.dev/go) on your iPhone.
2. In the project folder, run `npm install` and then `npm run tunnel`.
3. Scan the QR code in the terminal with your iPhone camera and open it in Expo Go.

The tunnel requires this computer and Expo to stay online. For a local connection, run `npm start` with your phone and computer on the same Wi-Fi network. Run `npm run web` for a browser preview.

To try a payment, choose **Pay family**, select a contact, enter an amount, review it, then enter any four demo keypad presses. The demo PIN is not stored, and no money moves. Do not enter a real payment PIN. A sample QR payment is available in Settings.

## Keypad and accessibility

The 3-by-4 keypad appears after selecting a recipient and stays in the same position for amount and PIN entry. It uses the same layout throughout the app: 1–9, then Delete, 0, and the next action. The raised center marker is intended to align with a tactile overlay. Voice guidance, VoiceOver labels, and optional vibration support navigation.

The keypad has one fixed layout; users do not need to align it. **Settings → Practice keypad** reads each key's position. The prototype uses the standard UPI number order, but its physical dimensions have not been measured against Google Pay on the iPhone 17 Pro Max. The casing should be designed from a measured provider keypad, then tested with blind and low-vision users.

QR payments accept supported `upi://pay` details for the demo. A QR code does not verify who will receive a payment, so check the recipient on the review screen. The app does not open QR links.

## Voice input and spoken guidance

Choose **Speak name** on the contact screen or **Speak amount** on the amount screen. The app requests microphone and speech-recognition permissions when you first use voice input. Permission denial leaves the buttons and keypad available. You can open device Settings when access has been blocked.

Say a full contact name or a whole amount, such as “two hundred fifty rupees.” The app reads the result back; review it before continuing. Voice input never enters a PIN or confirms a payment. Audio recordings and transcripts are not saved by Payabl. The device's speech service may require a network connection and process audio remotely.

Spoken guidance is on by default and can be changed in Settings. When VoiceOver or TalkBack is active, screen-reader announcements provide the guidance. On iPhone, turn silent mode off to hear the app's speech.

Native voice input requires a development build; Expo Go can still run the rest of the prototype. With an Expo account, build the development app using `npx eas-cli@latest build --profile development --platform ios` or replace `ios` with `android`. Installing a development build on a physical iPhone requires Apple signing and device registration. Install the build, then run `npm run start:dev`. Browser voice input depends on browser support and microphone permission.

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
