# Payabl

Payabl is an Expo prototype for making a simple payment flow easier to use without sight. The interface uses large controls, spoken prompts, vibration, and a fixed keypad intended to work with a tactile phone overlay. Payments are simulated; no bank or payment provider is connected.

## Run the app

1. Install [Node.js](https://nodejs.org/) and [Expo Go](https://expo.dev/go) on your iPhone.
2. In the project folder, run `npm install` and then `npm run tunnel`.
3. Scan the QR code in the terminal with your iPhone camera and open it in Expo Go.

The tunnel requires this computer and Expo to stay online. For a local connection, run `npm start` with your phone and computer on the same Wi-Fi network. Run `npm run web` for a browser preview.

After the splash, tap the large **Ask PayAbl** area to speak. **Scan QR** / **Pay contacts** appear as manual recovery actions if voice input fails. Select a recipient, enter an amount, review both, then press **Continue** to open **demo PIN practice**. Tap any four practice keys and press **Pay**. This is simulated: never enter or speak a real payment PIN. Only the tap count is retained in memory; no digit sequence is collected.

## Keypad and accessibility

The shared 3-by-4 keypad on contacts, amount, review, and demo PIN practice uses 1–9, then Delete, 0, and Next. Hold **0 for 700 ms** to start Ask PayAbl on contacts, amount, or review. A short tap still enters zero on the amount screen. On contacts, keys 1–9 select the current numbered page and Next shows more contacts; on review, Continue confirms details. On demo PIN practice, all microphone controls and shortcuts are absent. There is no separate Ask PayAbl button on contacts, amount, or review: use hold-0 or the accessibility action. An empty fixed-height spacer below the keypad preserves stencil alignment, including during demo PIN practice. Other screens retain their assistant control. Inactive number keys keep the same dark colour while remaining disabled. TalkBack users can also invoke Ask PayAbl from the custom actions on headings, navigation controls, contact choices, and keypad keys. The Stop speaking control stops app speech and cancels listening; screen-reader speech remains controlled by TalkBack/VoiceOver.

The required hardware is a **passive 3D-printed tactile numpad stencil**, with no electronics, sensors, or active keys. The assistant footer changes the amount keypad position, so remeasure the target phone before printing. No printable model or provider-keypad fit has been verified. Secure authentication belongs entirely to an authorized provider; only use a stencil where the actual permitted keypad layout matches it.

QR payments accept supported `upi://pay` details for the demo. A QR code does not verify who will receive a payment, so check the recipient on the review screen. The app does not open QR links.

## Voice input and spoken guidance

Ask PayAbl listens only after activation. Screen changes and old automatic-voice preferences do not start recording. A short vibration marks the start of listening. Say **Scan QR**, **Pay contacts**, **Send money to Rahul**, **Repeat**, **Stop speaking**, **Go back**, or **Help**. On contacts you can say a full name; on amount entry you can say a whole-rupee amount. Unclear commands ask for clarification. Duplicate names produce numbered choices with phone numbers or UPI IDs; say an option number or select its button. Commands never confirm a payment.

Screen transitions use brief cues. Help gives contextual instructions; Repeat repeats the last useful message. Manual amount entry does not speak the running total after every key; TalkBack retains accessible key labels; app speech no longer reads each manually entered digit. Voice amounts receive one readback, and review reads the recipient and amount before explicit Continue confirmation. With TalkBack, use double-tap-and-hold on 0 or the Ask PayAbl accessibility action. Verify this gesture on the actual phone. App TTS and screen-reader announcements are not used together.

Permission denial, unavailable services, timeouts, cancellation, and backgrounding leave manual controls available. PayAbl does not save audio recordings or transcripts. The device speech service may process audio remotely.

Native voice input requires an installed Payabl build; Expo Go can still run the rest of the prototype. Android APK builds include the app and do not need a running Expo server. Build one using `npx eas-cli@latest build --profile preview --platform android`. iPhone builds require Apple signing and device registration. Browser voice input depends on browser support and microphone permission.

Payabl uses Apple Speech on iOS and the device's speech-recognition service on Android. Android discovers both the Google app and Speech Recognition & Synthesis, respects the configured service, and retries once with an alternate installed recognizer if the service fails. Unsupported Indian English falls back once to US English. There is no spoken preparation prompt. Native speech-stop and voice-discovery operations have deadlines so a stalled engine cannot leave microphone preparation waiting indefinitely. Interim transcripts are never used to choose a recipient or amount.

On Xiaomi/HyperOS, allow Payabl’s microphone permission and the system microphone privacy switch. If recognition is unavailable, enable/update **Google** and **Speech Recognition & Synthesis** and enable English in the speech service. A microphone grant alone does not install a recognizer. The app shows separate messages for microphone capture, busy audio, missing service, language, and network errors.

The Android app provides **Voice payment** and **Scan QR** launcher shortcuts and App Actions with feature inventory/shortcut fulfillment. Google Assistant discovery requires Google Play registration or Google's App Actions testing tools; sideloading an APK alone does not activate Assistant discovery. Try “Hey Google, open voice payment in Payabl” after registration. The system assistant opens the screen; tap Ask PayAbl to start listening. PayAbl handles recipient selection and manual review.

Signed iPhone builds include native App Intents/App Shortcuts for “Start a voice payment in Payabl,” “Pay family with Payabl,” and “Scan a QR with Payabl.” These sources are added by the config plugin, not by editing generated native folders. Siri opens the app before microphone capture. iOS compilation, signing, discovery, and audio capture require a Mac/cloud iOS build and an iPhone; they cannot be verified on this Windows workspace. Neither assistant enters a PIN or confirms a payment.

## Guided QR scanning

Android `expo-camera` uses the bundled **Google ML Kit barcode scanner** (`com.google.mlkit:barcode-scanning:17.3.0`); no extra camera dependency is needed. Payabl uses its preview-space QR bounds/corners to guide alignment. Move the phone in the announced direction: left is one short buzz, right two short, up one long, down two long, and centered three short. Guidance respects vibration/spoken-guidance preferences. Repeated directions use haptics; speech is limited to direction changes at least 2.5 seconds apart and yields to assistant speech. TalkBack and VoiceOver receive direction announcements. The camera pauses while Ask PayAbl listens.

Hold the same QR centered for one second to read it automatically, or choose **Read detected QR**. A changed or lost code resets centering, stale detections expire, and camera/vibration stop when leaving the scanner or backgrounding the app. Invalid payment QRs offer **Scan again**. Only decoded QR detections expose positions through this camera API: it cannot locate a QR outside the camera view or provide guidance for an undecodable blurred code. iOS uses its native camera detector and haptics; its buzz timing differs from Android. Direction, audio, and vibration require physical-device testing.

After changing speech-service visibility or native shortcuts, rebuild/reinstall the APK: `npx eas-cli@latest build --profile preview --platform android`. Refreshing the old installed app cannot update its native manifest.

## Account and contacts

The person icon opens Account; the wheel opens Settings. Account stores your name and optional phone number locally and provides contact import, voice permission setup, and payment history. This is a local demo profile, not a bank login.

The first visit to Pay contacts requests contacts access. Payabl reads only permitted names and phone numbers, keeps them on the device, and supports search and spoken selection. Import can be retried from Account, including after granting limited access on iPhone. Phone contacts do not prove UPI registration; payments to them remain simulated.

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
