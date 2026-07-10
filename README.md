# Planterior AI

Expo / React Native app for trying plants in real rooms, generating plant-forward design variations, identifying plants from photos, and managing a local plant library.

## Stack

- Expo SDK 54
- React Native 0.81
- TypeScript
- React Navigation
- SQLite for local-first app data
- Firebase Auth
- RevenueCat
- Gemini via `@google/genai`
- Sentry
- `expo-speech-recognition`

## Current Data Model

- Auth is real: Firebase Auth
- Most app data is still local-first in SQLite
- Firestore CLI config exists, but design sync is not implemented yet

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
GEMINI_API_KEY=
SENTRY_DSN=
REVENUECAT_ENTITLEMENT_ID=
REVENUECAT_IOS_API_KEY_PRODUCTION=
REVENUECAT_GOOGLE_API_KEY_PRODUCTION=
```

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
npx eas build --platform ios --profile production --non-interactive
npx eas submit --platform ios --profile production --latest --non-interactive
```

Notes:

- `preview` is internal distribution
- `production` is the App Store / Play Store lane
- Native module or native config changes require a new build

## Verification

```bash
npm test
npm run test:watch
npx tsc --noEmit
npm run check:revenuecat
npm run check:revenuecat:prod
```

Current note:

- `npx tsc --noEmit` is not clean right now due to the Firebase auth import in [src/config/firebase.ts](/Users/timmorgan/Development/mobile/react/planteriorai/src/config/firebase.ts:8)

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
- camera / generation / design detail flows
- plant detail and plant identification flows
- auth / onboarding / subscription flows

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
- Clearing SQLite does not revoke Apple sandbox subscriptions
