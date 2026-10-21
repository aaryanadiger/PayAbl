# Android APK build — 21 October 2026

Requested preview APK build submitted from the local working tree:

https://expo.dev/accounts/ndverano/projects/payabl/builds/95aaf473-4c7d-490b-a0f9-6b5b690aea78

- Build ID: `95aaf473-4c7d-490b-a0f9-6b5b690aea78`.
- Profile: `preview`, internal distribution, Android APK.
- Existing remote Android signing credentials were reused and frozen.
- The local project uploaded successfully; no Git commit or push was made.
- Submission command: `npx eas-cli@latest build --platform android --profile preview --non-interactive --no-wait --freeze-credentials` (with a descriptive build message).

## Debugging/preflight

- `npm run lint`: passed.
- `npm run typecheck`: passed; passed again after patch updates.
- `npm test`: 18 tests passed, 0 failed.
- `npx --yes expo-doctor`: initially reported two SDK 57 patch mismatches.
- Fixed through `npx expo install expo@~57.0.31 expo-router@~57.0.29`.
- Final Expo Doctor result: 21/21 passed.
- Package declarations and lockfile dependency versions match.
- `git diff --check`: passed.

Changed for this preflight: `package.json`, `package-lock.json`, and the
persistent handover's build-version note. No application logic changed.

Submission is not proof of a completed APK build. The build page shows
live status and will provide the APK when successful. Actual microphone,
TalkBack, haptics, and stencil fit still require phone testing. Existing
package audit findings were not remediated through forced upgrades.
