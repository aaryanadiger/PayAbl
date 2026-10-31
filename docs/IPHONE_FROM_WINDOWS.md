# PayAbl on iPhone from Windows

PayAbl uses Expo SDK 57, React Native 0.86, React 19, and Expo Router.
Native dependencies include camera/QR detection, contacts, speech recognition,
text-to-speech, haptics, AsyncStorage, Reanimated/Worklets, Screens, Safe Area,
SVG, fonts, and the custom Siri App Shortcuts source. A standalone native build
includes these dependencies; Expo Go cannot supply the custom speech module.

## Build without a Mac or paid Apple membership

The **Build iPhone IPA** GitHub Actions workflow runs on `macos-26`, generates
`ios/` with Expo Prebuild, installs CocoaPods, and compiles an unsigned arm64
Release app using Xcode. JavaScript/assets are embedded and checked before
packaging `PayAbl-unsigned.ipa`. No Apple credentials are sent to GitHub.
The existing app configuration, screens, package versions, bundle identifier,
and native features are preserved. Generated native directories stay ignored.

Push this setup branch to run the workflow, or dispatch it once available on
the default branch. Download the artifact whose name starts `PayAbl-iPhone-`:

```powershell
gh run list --workflow ios-unsigned.yml --branch codex/iphone-free-account-install
gh run download <RUN_ID> --name PayAbl-iPhone-<FULL_COMMIT_SHA> --dir build/iphone
```

## Sign/install and refresh after seven days

Reuse the already installed WSL Ubuntu, xtool 1.24.0, and Apple Mobile Device
Support. Keep the iPhone connected to **Windows** and **detached from USBIPD**.
Apple Mobile Device Service must be running. Keep the phone unlocked, accept
Trust if prompted, and enable Developer Mode if the phone requests it.

From PowerShell in this repository:

```powershell
.\scripts\install-iphone.ps1
```

This checks the current WSL gateway and USBIPD state, verifies the existing
Windows TCP relay, and calls `xtool install --usb` as Ubuntu root to reuse that
account's saved Apple authentication. It neither prints credentials nor
installs additional full applications. It stops if the relay needs updating
after a WSL restart rather than exposing Apple's USB port to other networks.

The direct command, with the gateway verified on 31 October 2026, is:

```powershell
wsl -d Ubuntu -u root -- env USBMUXD_SOCKET_ADDRESS=172.20.0.1:27015 xtool install --usb /mnt/c/Users/Aarya/Documents/ChatGPT/Payabl/build/iphone/PayAbl-unsigned.ipa
```

Check the gateway before reusing that literal address:

```powershell
wsl -d Ubuntu -u root -- ip -4 route show default
```

If it changes, update the existing Windows port relay to forward only the WSL
gateway/interface on port 27015 to `127.0.0.1:27015`, along with its scoped
firewall rule. Do not switch to USBIPD attachment for this route.

Free Personal Team provisioning expires after seven days. Keep the unsigned
IPA and run the same install script again to sign and install it afresh. Use
the same Apple account/team and avoid uninstalling the app to retain its local
data. A fresh cloud build is needed only when the app code/native dependencies
change. Free accounts have app/device limits; paid membership is needed for
TestFlight/App Store distribution.

If Apple authentication expires, sign in interactively under the same root
account using `wsl -d Ubuntu -u root -- xtool auth login`; never paste Apple
credentials or two-factor codes into repository files or CI secrets.

## Verification

The workflow runs lint, typecheck, and tests, verifies `main.jsbundle` and assets,
and uploads build metadata including the source SHA and IPA checksum. A
successful install confirms provisioning and device transfer, but camera,
microphone, Siri, and haptics still need physical-device checks.

References: [Expo CNG](https://docs.expo.dev/workflow/continuous-native-generation/),
[xtool](https://github.com/xtool-org/xtool),
[Apple Personal Team limits](https://developer.apple.com/help/account/basics/about-your-developer-account).
