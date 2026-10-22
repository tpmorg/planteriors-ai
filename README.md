# Planterior AI

Expo / React Native app for trying plants in real rooms, generating plant-forward design variations, identifying plants from photos, and managing a local plant library.

## Stack

- Expo SDK 54 (`~54.0.34`)
- React Native 0.81.5 + React 19.1
- TypeScript 5.9
- Hermes with React Native's New Architecture enabled
- React Navigation
- SQLite for local-first app data
- Firebase Auth, Firestore, and Storage
- RevenueCat subscriptions and design credits
- Server-side AI API for Gemini generation and plant identification
- Sentry
- `expo-speech-recognition`

## Platform Targets

The committed native projects currently target:

| Platform | Minimum OS / API | Compile / target SDK |
| --- | --- | --- |
| iOS | iOS 15.1 | Expo SDK 54 / React Native 0.81.5 toolchain |
| Android | API 24 (Android 7.0) | API 36 |

App identifiers:

- iOS bundle identifier: `com.bcs.planterior`
- Android application ID: `com.bcs.planterior`

Android SDK values are inherited from the installed React Native / Expo toolchain. Recheck the generated native configuration after an Expo SDK upgrade or a fresh prebuild rather than assuming these targets stay unchanged.

## Current Data Model

- Auth is real: Firebase Auth
- App data is local-first in SQLite (schema version 8)
- Designs, collections, favorites, catalog additions, and generation metadata are stored locally
- Manual Firestore/Storage backup and guarded cloud merge are available from Account
- Cloud merge preserves newer, unsynced, or conflicted local records instead of treating restore as a destructive replacement
- Account deletion is requested through the authenticated server API; local app data is cleared as part of the signed-in deletion flow

Relevant files:

- [src/config/firebase.ts](/Users/timmorgan/Development/mobile/react/planteriorai/src/config/firebase.ts:1)
- [src/services/databaseService.ts](/Users/timmorgan/Development/mobile/react/planteriorai/src/services/databaseService.ts:1)
- [firebase.json](/Users/timmorgan/Development/mobile/react/planteriorai/firebase.json:1)
- [.firebaserc](/Users/timmorgan/Development/mobile/react/planteriorai/.firebaserc:1)

## Setup

Prereqs:

- Node 20+
- npm
- Xcode for iOS work
- Android Studio / Android SDK for Android work
- EAS account/project access for cloud builds

Install:

```bash
npm install
cp .env.example .env.local
```

Important env vars:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
APPLE_CLIENT_ID=
AI_API_URL=https://www.planterior.app
AI_API_TIMEOUT=310000
SENTRY_DSN=
REVENUECAT_ENTITLEMENT_ID=Planterior Pro
REVENUECAT_IOS_API_KEY_PRODUCTION=
REVENUECAT_GOOGLE_API_KEY_PRODUCTION=
```

`app.config.js` validates `GOOGLE_CLIENT_ID` against the Web OAuth client in `google-services.json`. A mismatch fails configuration instead of producing a broken Google Sign-In build. EAS environment variables are embedded at build time, so changing an OAuth or RevenueCat value requires a new native artifact.

Also check:

- [app.json](/Users/timmorgan/Development/mobile/react/planteriorai/app.json:1)
- [.env.example](/Users/timmorgan/Development/mobile/react/planteriorai/.env.example:1)
- [eas.json](/Users/timmorgan/Development/mobile/react/planteriorai/eas.json:1)

## Daily Commands

Dev client:

```bash
npm start
npm run start:lan
npm run start:localhost
npm run start:clear
```

Local native runs:

```bash
npm run ios
npm run android
```

Expo Go helpers:

```bash
npm run start:expo-go
npm run start:expo-go:lan
```

The development client is the primary runtime. Google Sign-In, RevenueCat, and speech recognition rely on native configuration and cannot be fully exercised in Expo Go.

## Build Commands

Dev builds:

```bash
npm run build:dev:ios
npm run build:dev:android
```

Preview builds:

```bash
npm run build:preview:ios
npm run build:preview:android
```

Production builds:

```bash
npm run build:prod:ios
npm run build:prod:android
```

Direct EAS commands used often:

```bash
npx eas build --platform ios --profile production --non-interactive --no-wait
npx eas submit --platform ios --profile production --id <build-id> --non-interactive
```

Notes:

- `preview` is internal distribution
- `simulator` creates an iOS simulator build using production environment values
- `production` is the App Store / Play Store lane
- Production build numbers are managed remotely and auto-incremented by EAS
- Native module or native config changes require a new build
- EAS archives the working tree, including non-ignored uncommitted files; inspect `git status` before release builds

## Verification

```bash
npm test
npm run test:watch
npx tsc --noEmit
npm run check:revenuecat
npm run check:revenuecat:prod
```

Device-level screenshot capture:

```bash
npm run e2e:screenshots
```

See [docs/maestro-screenshot-testing.md](/Users/timmorgan/Development/mobile/react/planteriorai/docs/maestro-screenshot-testing.md:1) for setup, output location, and the next Maestro coverage slices.

## Utility Commands

Android / device:

```bash
adb devices -l
adb logcat -v time
adb shell pm clear com.bcs.planterior
adb uninstall com.bcs.planterior
```

Local native build entry points:

```bash
npx expo run:ios
npx expo run:android
```

## Repo Utilities

Scripts in [scripts](/Users/timmorgan/Development/mobile/react/planteriorai/scripts:1):

```bash
node scripts/checkRevenueCatSetup.js
node scripts/checkRevenueCatSetup.js --env=production
node scripts/expandPlantDatabase.js
node scripts/fetchPlantImages.js
node scripts/populatePlantCodex.js
```

## App Shape

Main areas:

- Gallery
- Library
- Favorites
- Settings
- camera, persisted design setup, generation recovery, and design detail flows
- Restyle, Add Plant, and targeted Replace Plant design intents
- plant detail and plant identification flows
- auth / onboarding / subscription flows
- account backup, cloud merge, and deletion controls

## AI and Purchase Boundaries

- The app never holds a Gemini key. It authenticates to the server API with a Firebase ID token.
- Generation uploads the prepared image, creates an idempotent asynchronous job, polls it, and downloads the completed result.
- Retryable throttling reuses the same idempotency key so a retry cannot double-spend allowance.
- Restyle is style-led; Add Plant preserves existing plants and objects; Replace Plant may modify only the marked target.
- RevenueCat exposes a monthly option with 30 designs per billing cycle and a one-time room pack with 20 non-expiring designs.
- The RevenueCat `DESIGNS` virtual-currency balance is checked before generation. Store entitlement and credit state are not inferred from local SQLite alone.

Key directories:

- `src/screens`
- `src/components`
- `src/services`
- `src/contexts`
- `src/navigation`
- `src/data`

## Known Gotchas

- `expo-speech-recognition` changes require a fresh native build
- Metro restart alone is not enough after native module changes
- Firebase project IDs, bundle IDs, and package IDs must match native config
- `GOOGLE_CLIENT_ID` must be the Web OAuth client from `google-services.json`, not an Android client ID
- A changed EAS environment variable does not affect an already-built binary
- Clearing SQLite does not revoke Apple sandbox subscriptions
