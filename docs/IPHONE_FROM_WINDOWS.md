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

On this PC, WSL outbound internet timed out while Windows internet worked.
The working workaround also forwards xtool's encrypted authentication requests
through a temporary Windows relay. To refresh using that route:

```powershell
.\scripts\install-iphone.ps1 -UseWindowsAppleApiRelay
```

This starts the included `apple-api-relay.ps1` with existing PowerShell, binds
only to the current WSL gateway on port 27016, accepts only the current WSL
client address, and allows Apple hosts plus xtool's existing authentication
provider `mac-ani.jkcoxson.com`. TLS verification remains enabled. Credentials
and request contents are never logged. The helper stops its temporary relay
when installation ends. The existing Windows USB relay on port 27015 stays
in use; no additional applications or firewall changes are needed.

This checks the current WSL gateway and USBIPD state, verifies the existing
Windows TCP relay, and calls `xtool install --usb` as Ubuntu root to reuse that
account's saved Apple authentication. It neither prints credentials nor
installs additional full applications. It stops if the relay needs updating
after a WSL restart rather than exposing Apple's USB port to other networks.

The direct command, with the gateway verified on 31 October 2026, is:

```powershell
wsl -d Ubuntu -u root --exec env USBMUXD_SOCKET_ADDRESS=172.20.0.1:27015 xtool install --usb /mnt/c/Users/Aarya/Documents/ChatGPT/Payabl/build/iphone/PayAbl-unsigned.ipa
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

## Actual results — 31 October 2026

- [GitHub Actions build 41197582611](https://github.com/aaryanadiger/PayAbl/actions/runs/41197582611): successful, source `eb504c6e320eb10bc20bff97f4cb150ff486542e`.
- Xcode 26.6, iOS SDK 26.5, device arm64 Release, minimum iOS 16.4.
- Downloaded `build/iphone/PayAbl-unsigned.ipa`; SHA-256 `8a559b2190ca4915fd6c0b8de1a237cac75c6fd574904d639e174838cffa5bc1` matched the cloud metadata.
- Embedded JavaScript: 2,563,584 bytes; 21 embedded asset files. Speech/microphone usage descriptions verified.
- Existing Ubuntu root Apple session reused; xtool 1.24.0 signed, installed, and verified the app successfully on the connected iPhone running iOS 27.2.
- Installed signing identifier: `XTL-QGC927R2FF.com.payabl.prototype`. The original project's bundle identifier remains `com.payabl.prototype`.
- Windows USB relay reused at `172.20.0.1:27015`, with USBIPD detached. No full applications installed.
- Remote launch found the executable but failed at the iPhone debug-server service. The user confirmed the app is on the phone. Camera, speech, and haptic behavior are not claimed as physically tested.
- Lint, TypeScript, all 12 tests, shell syntax, and workflow YAML validation passed.
