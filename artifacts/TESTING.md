# Device test handoff

The local Expo Go server is `exp://192.168.0.189:8081`. Connect the iPhone to the same Wi-Fi as this computer. Scan `expo-go-qr.png` with the iPhone Camera, then open in Expo Go. The computer must remain awake with Metro running. A firewall or Wi-Fi client isolation can block phone connectivity; phone connectivity has not been directly verified.

`sample-payment-qr.png` encodes a sample merchant (`cornerstore@demo`) and ₹250. Display it on this computer, then scan from the app. It is demo data, not a real recipient.

Restart for Expo Go: `npm run start:go`. Native speech recognition requires the Payabl development build and `npm run start:dev`; Expo Go cannot provide its speech-recognition module. Across-network alternative: `npm run tunnel`. The ngrok service disconnected during two attempts in this session, so there is currently no working public tunnel.

Test on the iPhone 17 Pro Max:

1. Try Pay family → Ananya → 250 → Next → Continue to PIN → any four demo PIN digits → Pay. Confirm there is no keypad until a recipient is selected; confirmation and completion also hide it.
2. Delete digits, return from review to edit the amount, and verify zero cannot be submitted.
3. Scan the sample QR; check spoken name, UPI ID and amount. Try a non-payment QR and use Scan again.
4. Enable VoiceOver; explore every action and keypad key, then double-tap to activate. PIN labels describe row/column rather than speaking the digit.
5. Try the largest text setting. Content above the keypad scrolls; keys stay anchored. Check every button remains reachable.
6. The keypad is fixed and has no practice or user alignment settings. Confirm all twelve physical openings hit their intended keys. Amount and PIN key geometry must match. Exact Google Pay geometry still needs a measured reference.
7. Background the app during PIN entry; return and verify the PIN count clears.
8. Complete a demo, restart the app, and verify receipts and settings persist. Check speaker output, silent-mode behavior and haptics on the actual phone.
9. In the installed APK or a development build, open Pay family. Check contact import permission first, then speech permissions and the automatic spoken prompt/vibration. Verify permission refusal, blocked access with Open Settings, cancellation, no speech, and backgrounding. Confirm no microphone access or voice entry exists on the PIN screen.
10. Say “two hundred fifty rupees” and verify ₹250 is read back and still requires review. Say the full name of a contact and check the selected recipient. Unmatched and ambiguous names must not select a recipient. Press a keypad key while listening and verify listening stops.
11. Open Account through the person icon. Save a name and optional phone number, restart, and verify persistence. Import limited contacts on iPhone and verify only allowed names/numbers appear. Check duplicate names require choosing the correct numbered contact instead of guessing.
12. On Android, long-press Payabl's launcher icon and open Voice payment. Google Assistant App Actions registration/testing is separate from this shortcut; Siri cannot run inside Expo Go.

Do not fabricate the final silicone casing until the physical keypad has been measured and tested. The production payment provider's PIN screen will require a separate geometry/accessibility review.
