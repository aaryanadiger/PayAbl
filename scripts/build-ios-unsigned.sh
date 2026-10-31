#!/usr/bin/env bash
# Run on GitHub's macOS runner; sign/install locally using the existing xtool.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "$(uname -s)" != Darwin ]]; then
  echo 'Use the Build iPhone IPA GitHub Actions workflow: Xcode requires macOS.' >&2
  exit 1
fi

output="$PWD/build/iphone"
mkdir -p "$output"
shopt -s nullglob
workspaces=(ios/*.xcworkspace)
if [[ ${#workspaces[@]} -ne 1 ]]; then
  echo 'Expected one generated iOS workspace. Run Expo prebuild and pod install.' >&2
  exit 1
fi
workspace="${workspaces[0]}"
scheme="$(basename "$workspace" .xcworkspace)"

# The generated Expo bundle phase embeds JavaScript and assets in Release.
# No Apple account, signing certificate, or paid membership enters the runner.
export FORCE_BUNDLING=1
xcodebuild \
  -workspace "$workspace" \
  -scheme "$scheme" \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -derivedDataPath "$output/DerivedData" \
  ARCHS=arm64 \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY='' \
  build 2>&1 | tee "$output/xcodebuild.log"

apps=("$output"/DerivedData/Build/Products/Release-iphoneos/*.app)
if [[ ${#apps[@]} -ne 1 ]]; then
  echo 'Expected exactly one compiled iPhone app.' >&2
  exit 1
fi
app="${apps[0]}"
if [[ ! -s "$app/main.jsbundle" ]]; then
  echo 'Missing embedded Release JavaScript bundle; refusing to package.' >&2
  exit 1
fi
if [[ ! -d "$app/assets" ]]; then
  echo 'Missing bundled assets; refusing to package.' >&2
  exit 1
fi
staging="$(mktemp -d "$output/package.XXXXXX")"
trap 'rm -rf -- "$staging"' EXIT
mkdir "$staging/Payload"
ditto "$app" "$staging/Payload/$(basename "$app")"
ditto -c -k --keepParent "$staging/Payload" "$output/PayAbl-unsigned.ipa"

{
  echo "Commit: $(git rev-parse HEAD)"
  echo "Built UTC: $(date -u +%FT%TZ)"
  xcodebuild -version
  echo "iOS SDK: $(xcrun --sdk iphoneos --show-sdk-version)"
  echo "Bundle ID: $(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$app/Info.plist")"
  echo "Minimum iOS: $(/usr/libexec/PlistBuddy -c 'Print MinimumOSVersion' "$app/Info.plist")"
  echo 'Configuration: Release, arm64, embedded JavaScript/assets, unsigned.'
  echo "IPA SHA-256: $(shasum -a 256 "$output/PayAbl-unsigned.ipa")"
} > "$output/build-info.txt"
cat "$output/build-info.txt"
