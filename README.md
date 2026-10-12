# Payabl

Payabl is an Expo prototype for making a simple payment flow easier to use without sight. The interface uses large controls, spoken prompts, vibration, and a fixed keypad intended to work with a tactile phone overlay. Payments are simulated; no bank or payment provider is connected.

## Run the app

1. Install [Node.js](https://nodejs.org/) and [Expo Go](https://expo.dev/go) on your iPhone.
2. In the project folder, run `npm install` and then `npm run tunnel`.
3. Scan the QR code in the terminal with your iPhone camera and open it in Expo Go.

The tunnel requires this computer and Expo to stay online. For a local connection, run `npm start` with your phone and computer on the same Wi-Fi network. Run `npm run web` for a browser preview.

To try a payment, choose **Pay family**, select a contact, enter an amount, review it, then enter any four demo keypad presses. The demo PIN is not stored, and no money moves. Do not enter a real payment PIN. A sample QR payment is available in Settings.

## Keypad and accessibility

The 3-by-4 keypad appears after selecting a recipient and stays in the same position for amount and PIN entry. It uses the same layout throughout the app: 1–9, then Delete, 0, and the next action. The raised center marker is intended to align with a tactile overlay. Voice guidance, VoiceOver labels, repeat instructions, and optional vibration support navigation.

Use **Settings → Align keypad** to adjust its size and position, then **Practice keypad** to check the layout. The default is a prototype measurement, not a measured copy of a payment provider's PIN screen. Check alignment and usability on the iPhone 17 Pro Max before making an overlay, and test with blind and low-vision users.

QR payments accept supported `upi://pay` details for the demo. A QR code does not verify who will receive a payment, so check the recipient on the review screen. The app does not open QR links.

## Commands

- `npm start` — start Expo
- `npm run tunnel` — start Expo with a network tunnel
- `npm run ios` / `npm run android` — start Expo for a connected simulator or device
- `npm run web` — start the browser preview
- `npm run lint` — check code style
- `npm run typecheck` — check TypeScript
- `npm test` — run payment parsing tests

made with ❤️ by aarya
