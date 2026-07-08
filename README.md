# Planterior AI

Planterior AI is an Expo / React Native app for trying plants in real rooms before you buy or move them. You can capture a room photo, generate plant-forward design variations, build a personal plant library, identify real plants from photos, and save favorite designs locally on device.

<div align="center">

![Planterior AI](assets/logo.png)

[![React Native](https://img.shields.io/badge/React%20Native-0.81.5-blue.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-54.0.34-black.svg)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Firebase Auth](https://img.shields.io/badge/Auth-Firebase-orange.svg)](https://firebase.google.com/)
[![RevenueCat](https://img.shields.io/badge/Billing-RevenueCat-ff6b6b.svg)](https://www.revenuecat.com/)

</div>

## Current Product Surface

- Room design generation from a captured or imported room photo
- Multi-plant styling flow and single-plant / replace-plant flow
- Plant library with local search, filters, and voice search
- Plant identification from a real plant photo using Gemini
- Generated-design plant identification for follow-up lookup
- Favorites, collections, onboarding, and account/settings flows
- Firebase Auth-backed sign-in
  - Android: Google Sign-In
  - iOS: Sign in with Apple
- RevenueCat subscription flow
- Local persistence with SQLite

## Stack

- Expo SDK 54 with React Native 0.81
- TypeScript
- React Navigation
- `expo-sqlite` for local persistence
- Firebase Auth for account auth
- RevenueCat for subscriptions
- Gemini via `@google/genai` for generation and plant identification
- Sentry for error reporting
- `expo-speech-recognition` for voice search

## App Structure

High-level navigation today:

- `Gallery`
- `Library`
- `Favorites`
- `Settings`
- modal / stacked flows for:
  - auth
  - onboarding
  - camera
  - plant selection
  - plant placement
  - generation
  - design detail
  - plant detail
  - plant identify
  - subscription

Important directories:

- `src/screens` UI screens and flows
- `src/services` data, auth, AI, subscriptions, and persistence
- `src/contexts` auth, theme, tab bar, network, toast, subscription
- `src/navigation` screen wrappers and flow wiring
- `src/data/plantDatabase.ts` seed plant catalog

## Local Data vs Cloud Data

Current state:

- Auth is real Firebase Auth.
- Designs, favorites, collections, usage tracking, and plant-library data are still local-first in SQLite.
- Firebase CLI config is initialized for project `planterior-7c289`.
- Firestore config files exist, but design sync to Firestore has not been implemented yet.

Relevant files:

- [src/config/firebase.ts](/Users/timmorgan/Development/mobile/react/planteriorai/src/config/firebase.ts:1)
- [src/services/databaseService.ts](/Users/timmorgan/Development/mobile/react/planteriorai/src/services/databaseService.ts:1)
- [firebase.json](/Users/timmorgan/Development/mobile/react/planteriorai/firebase.json:1)
- [.firebaserc](/Users/timmorgan/Development/mobile/react/planteriorai/.firebaserc:1)

## Prerequisites

- Node 20+
- npm
- Xcode for iOS native builds
- Android Studio for Android native builds
- EAS CLI for cloud builds
- A Firebase project with mobile apps configured
- RevenueCat project and products if you want to exercise the paid flow

## Environment Setup

Copy `.env.example` to `.env.local` and fill in the values you need:

```bash
cp .env.example .env.local
```

Primary values used by the current app:

```env
GOOGLE_CLIENT_ID=
GEMINI_API_KEY=
SENTRY_DSN=
REVENUECAT_ENTITLEMENT_ID=Planterior Pro
REVENUECAT_IOS_API_KEY_PRODUCTION=
REVENUECAT_GOOGLE_API_KEY_PRODUCTION=
```

Notes:

- Android Google Sign-In depends on `GOOGLE_CLIENT_ID`.
- iOS auth uses Apple Sign-In, but Firebase and native app config still need to be set up correctly.
- Expo reads runtime values from `app.json` `expo.extra`.
- For EAS builds, set the same values as project secrets / env vars.

Reference files:

- [.env.example](/Users/timmorgan/Development/mobile/react/planteriorai/.env.example:1)
- [app.json](/Users/timmorgan/Development/mobile/react/planteriorai/app.json:1)
- [src/utils/env.ts](/Users/timmorgan/Development/mobile/react/planteriorai/src/utils/env.ts:1)

## Install

```bash
npm install
```

## Running the App

### Dev Client

This app uses native modules that are not a good fit for plain Expo Go in normal development, including RevenueCat, native auth, and speech recognition. Day-to-day work should assume an Expo dev client.

```bash
npm start
npm run ios
npm run android
```

Useful variants:

```bash
npm run start:lan
npm run start:localhost
npm run start:clear
```

### Expo Go

There are helper scripts for Expo Go:

```bash
npm run start:expo-go
npm run start:expo-go:lan
```

But expect feature gaps for native-module-heavy flows.

## Build Commands

Local native builds:

```bash
npx expo run:ios
npx expo run:android
```

EAS builds:

```bash
npm run build:dev:ios
npm run build:dev:android

npm run build:preview:ios
npm run build:preview:android

npm run build:prod:ios
npm run build:prod:android
```

Profiles are defined in [eas.json](/Users/timmorgan/Development/mobile/react/planteriorai/eas.json:1).

## When a Rebuild Is Required

You need a new native build when changing:

- Expo plugins
- native modules
- iOS / Android permissions
- app icons, splash config, package IDs, bundle IDs, scheme
- `app.json` native-facing config
- Firebase native app config files

JS-only changes usually do not require a rebuild:

- screens
- components
- services
- styling
- navigation logic
- most business logic

## Authentication

Current auth behavior:

- Android uses Google Sign-In, then exchanges the Google ID token with Firebase Auth.
- iOS uses Sign in with Apple, then exchanges the Apple identity token with Firebase Auth.
- `AuthContext` now treats Firebase auth state as the source of truth.
- There is also a dev bypass sign-in path for prototyping.

Relevant files:

- [src/contexts/AuthContext.tsx](/Users/timmorgan/Development/mobile/react/planteriorai/src/contexts/AuthContext.tsx:1)
- [src/services/firebaseAuthService.ts](/Users/timmorgan/Development/mobile/react/planteriorai/src/services/firebaseAuthService.ts:1)

## Subscriptions

Subscriptions are handled through RevenueCat, not the older mock-only flow this repo started with.

Current implementation includes:

- offering fetch
- purchase flow
- restore purchases
- subscription sanity/debug views in Settings
- Firebase-authenticated user identification in RevenueCat

Relevant files:

- [src/services/subscriptionService.ts](/Users/timmorgan/Development/mobile/react/planteriorai/src/services/subscriptionService.ts:1)
- [src/contexts/SubscriptionContext.tsx](/Users/timmorgan/Development/mobile/react/planteriorai/src/contexts/SubscriptionContext.tsx:1)
- [src/screens/SubscriptionScreen.tsx](/Users/timmorgan/Development/mobile/react/planteriorai/src/screens/SubscriptionScreen.tsx:1)

## Plant Library and Identification

Library highlights:

- seeded local plant catalog plus user-added plants
- full-text search
- filter chips
- voice search via `expo-speech-recognition`
- favorites update reactively across views

Identification highlights:

- identify a real plant from a photo
- save identified plants into the local library
- identify likely plants inside a generated design image

Relevant files:

- [src/screens/LibraryScreen.tsx](/Users/timmorgan/Development/mobile/react/planteriorai/src/screens/LibraryScreen.tsx:1)
- [src/components/IndividualPlantSelector.tsx](/Users/timmorgan/Development/mobile/react/planteriorai/src/components/IndividualPlantSelector.tsx:1)
- [src/services/plantIdentificationService.ts](/Users/timmorgan/Development/mobile/react/planteriorai/src/services/plantIdentificationService.ts:1)
- [src/hooks/useLibraryDataVersion.ts](/Users/timmorgan/Development/mobile/react/planteriorai/src/hooks/useLibraryDataVersion.ts:1)

## Database

The app is currently local-first and stores most user content in SQLite.

Today that includes:

- saved designs
- favorites
- collections
- subscription snapshots / usage tracking
- plant catalog and plant images
- identified generated plants metadata

The active DB schema version in code is `7`.

Reference:

- [src/services/databaseService.ts](/Users/timmorgan/Development/mobile/react/planteriorai/src/services/databaseService.ts:15)

## Testing and Validation

Tests:

```bash
npm test
npm run test:watch
```

RevenueCat config checks:

```bash
npm run check:revenuecat
npm run check:revenuecat:prod
```

TypeScript:

```bash
npx tsc --noEmit
```

Current status:

- `npx tsc --noEmit` is not clean right now.
- It currently fails on `getReactNativePersistence` in Firebase auth imports:
  - [src/config/firebase.ts](/Users/timmorgan/Development/mobile/react/planteriorai/src/config/firebase.ts:8)

## Apple Sandbox + RevenueCat Testing Notes

Subscription state has three layers:

1. Apple Sandbox owns the actual subscription lifecycle.
2. RevenueCat reads the receipt and entitlement state.
3. The app reads RevenueCat `CustomerInfo`.

Implications:

- Clearing local SQLite rows does not revoke a real sandbox subscription.
- Canceling a sandbox subscription stops renewal, not the current active period.
- If the app still shows subscribed, inspect RevenueCat and Apple sandbox timing before blaming local state.

Recommended debug path:

1. Run the RevenueCat sanity check in Settings.
2. Cancel renewal in the Sandbox Apple Account.
3. Wait for the compressed sandbox renewal period to expire.
4. Refresh RevenueCat customer info.
5. Re-run the sanity check and compare the entitlement state.

Useful docs:

- [Apple subscription sandbox testing](https://developer.apple.com/documentation/storekit/testing-an-auto-renewable-subscription)
- [RevenueCat CustomerInfo](https://www.revenuecat.com/docs/customers/customer-info)

## Firebase Setup Notes

This repo already includes:

- Android Firebase config in [google-services.json](/Users/timmorgan/Development/mobile/react/planteriorai/google-services.json:1)
- iOS Firebase config in [GoogleService-Info.plist](/Users/timmorgan/Development/mobile/react/planteriorai/GoogleService-Info.plist:1)
- Firebase CLI project mapping in [.firebaserc](/Users/timmorgan/Development/mobile/react/planteriorai/.firebaserc:1)
- Firestore CLI config in [firebase.json](/Users/timmorgan/Development/mobile/react/planteriorai/firebase.json:1)

What is not done yet:

- app-level design sync to Firestore
- cloud-backed image storage for saved designs
- Firestore-backed cross-device favorites / collections

## Troubleshooting

### `cannot find native module ExpoSpeechRecognition`

- Install a fresh dev build after adding or updating `expo-speech-recognition`.
- Uninstall old builds if the device still has a stale binary.
- Metro restart alone is not enough for native module changes.

### Google / Firebase auth issues

- Confirm the Firebase project and mobile app configs match the current bundle/package IDs.
- Confirm the right `GOOGLE_CLIENT_ID` is present for the active build environment.
- If both Gemini and Firebase fail together on mobile, suspect network/device path issues early.

### Android local setup

If Android native work fails locally, confirm `android/local.properties` points at your Android SDK.

## Useful Commands

```bash
adb devices -l
adb logcat -v time
adb shell pm clear com.bcs.planterior
adb uninstall com.bcs.planterior
```

## License

MIT
