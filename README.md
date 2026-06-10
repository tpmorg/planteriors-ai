# Planterior AI

AI-powered plant design for interior spaces. Take a photo of a room, choose plant types and styles, and get AI-generated images showing how plants would look in your space.

<div align="center">

![Planterior AI](assets/logo.png)

[![React Native](https://img.shields.io/badge/React%20Native-0.81.4-blue.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-54.0.7-black.svg)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Gemini](https://img.shields.io/badge/Gemini-2.5%20Flash%20Image%20Preview-green.svg)](https://aistudio.google.com/)

</div>

## Quick Start

```bash
git clone https://github.com/tpmorg/plant-interiors-ai.git
cd planterior-ai
npm install
cp .env.example .env.local   # then add your API keys
npm start
```

Your `.env.local` needs:
```env
GOOGLE_CLIENT_ID=your_google_client_id
GEMINI_API_KEY=your_gemini_api_key
TRUFLE_API_KEY=your_trufle_api_key
```

Get keys: [Google Cloud Console](https://console.cloud.google.com/) | [Google AI Studio](https://aistudio.google.com/)

For EAS cloud builds, set secrets with `eas secret:create --name KEY_NAME --value "value" --scope project`.

## How It Works

1. Sign in with Google (or skip for dev)
2. Tap "+" to start a new design
3. Take a photo of your room or pick from gallery
4. Choose plant type (Succulents, Tropical, Flowering, Hanging) and style
5. AI generates a realistic image with plants placed in your room
6. Save, favorite, share, or delete designs from your gallery

## Development

```bash
npm start              # Start dev server
npm run ios            # iOS simulator
npm run android        # Android emulator
npx tsc --noEmit       # Type check
```

## Stack (high level)

- React Native 0.81 + Expo SDK 54 (Dev Client)
- Firebase Auth (Google)
- SQLite via expo-sqlite
- Gemini 2.5 Flash Image Preview -- trying Gemini 3.1 (image generation)
- RevenueCat (react-native-purchases) for subscriptions

## Apple Sandbox + RevenueCat Subscription Testing

Subscription state has three layers:

1. **Apple Sandbox** owns the underlying App Store subscription and renewal state.
2. **RevenueCat** reads the Apple receipt and maps it to the configured entitlement.
3. **The app** reads RevenueCat `CustomerInfo` and treats `entitlements.active[ENTITLEMENT_ID]` as the source of truth.

Local SQLite subscription rows are not authoritative for real IAP testing. Clearing local app data, deleting a local subscription row, signing out, or deleting a RevenueCat customer does not immediately revoke an active Apple subscription.

### Cancellation and Expiration

- Canceling a sandbox subscription means "do not renew"; it does not remove access for the current paid/test period.
- Apple Sandbox renewals are accelerated. If the Sandbox Apple Account renewal rate is set to **3 minutes**, a one-month test subscription should remain active until that compressed period expires.
- After the compressed period ends, RevenueCat may still need a receipt/customer-info refresh before the app sees the entitlement disappear.
- If RevenueCat still returns the entitlement as active after the sandbox period plus a buffer, treat RevenueCat/Apple sandbox state as the thing to inspect first, not SQLite.

### What Can and Cannot Be Revoked

Can do:

- Cancel auto-renewal from the Sandbox Apple Account.
- Wait for the accelerated sandbox period to expire.
- Use a fresh Sandbox Apple Account for clean first-purchase testing.
- Use a fresh app user / RevenueCat App User ID to avoid alias confusion.
- Invalidate the app-side RevenueCat cache and fetch fresh `CustomerInfo`.
- Delete local SQLite subscription/test data when testing local usage logic.
- Remove RevenueCat promotional/granted entitlements, if any were manually granted.

Cannot do:

- Force Apple to immediately revoke an active App Store subscription period from the app.
- Make RevenueCat deletion cancel or revoke Apple's underlying subscription.
- Trust local DB deletion as proof that the real StoreKit entitlement is gone.

### Recommended Reset Flow

1. In the app, open **Settings -> RevenueCat Sanity Check** and capture:
   - `requestedUserId`
   - `appUserID`
   - `originalAppUserId`
   - `activeEntitlementIds`
   - `activeSubscriptions`
   - `allPurchasedProductIdentifiers`
2. In App Store sandbox settings, cancel auto-renew for the Sandbox Apple Account.
3. Wait for the configured compressed renewal period to expire. With the current 3-minute setting, wait at least 3 minutes, preferably 5-10 minutes when debugging.
4. Force a RevenueCat refresh in the app:

```ts
await Purchases.invalidateCustomerInfoCache();
const customerInfo = await Purchases.getCustomerInfo();
console.log(customerInfo.entitlements.active);
```

5. Run **Settings -> RevenueCat Sanity Check** again.
6. In RevenueCat, search the Sandbox customer view for `requestedUserId`, `appUserID`, and `originalAppUserId`. Aliases can make the app appear to "keep" a subscription under a different customer identity.

### Practical Testing Guidance

- For repeated clean purchase tests, use a new Sandbox Apple Account and, ideally, a fresh app user.
- For "cancel then lose access" tests, cancellation is only step one; the test is complete only after the accelerated subscription period expires and RevenueCat returns no active entitlement.
- If `CustomerInfo.entitlements.active` still contains `Planterior Pro`, the app is correctly treating the user as subscribed.
- If RevenueCat's dashboard also shows the entitlement active for the same App User ID, the issue is upstream of app state.
- If RevenueCat's dashboard shows inactive but the app still shows active, suspect SDK cache, stale app user identity, or a UI state refresh issue.
- Use `Purchases.invalidateCustomerInfoCache()` only as a diagnostic/dev refresh tool. It does not override an active Apple receipt.

Relevant docs:

- [Apple: Testing auto-renewable subscriptions](https://developer.apple.com/documentation/storekit/testing-an-auto-renewable-subscription)
- [Apple: Manage Sandbox Apple Account settings](https://developer.apple.com/help/app-store-connect/test-in-app-purchases/manage-sandbox-apple-account-settings/)
- [RevenueCat: CustomerInfo](https://www.revenuecat.com/docs/customers/customer-info)
- [RevenueCat: Delete customer limits](https://www.revenuecat.com/docs/dashboard-and-metrics/customer-profile#delete-customer)

## Common Commands

```bash
# Metro (Dev Client)
npm start

# Local native build/install (requires Android Studio / Xcode)
npx expo run:android
npx expo run:ios

# EAS dev builds (Dev Client)
npm run build:dev:android
npm run build:dev:ios

# EAS preview builds
npm run build:preview:android
npm run build:preview:ios

# EAS production builds
npm run build:prod:android
npm run build:prod:ios
```

Notes:
- Use **EAS dev builds** when adding/updating native deps or plugins.
- Use **Metro only** for JS/TS changes.

## ADB / Android Debugging

Package name: `com.bcs.planterior`

```bash
# Devices
adb devices

# Install APK
adb install -r path/to/app.apk

# Clear app data
adb shell pm clear com.bcs.planterior

# Uninstall
adb uninstall com.bcs.planterior

# Logs
adb logcat | grep -i planterior
adb logcat *:S ReactNative:V ReactNativeJS:V

# Forward Metro port (if needed)
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8082 tcp:8082
```

For detailed architecture and technical docs, see [CLAUDE.md](CLAUDE.md).

## When to Rebuild

**Requires rebuild:** App icon, splash screen, app name/version, native plugins, permissions

**JS-only (no rebuild):** Components, screens, services, navigation, styling, logic

## The Google Authentication Flow

- Native Google Sign-In -> User signs in via Android's native Google account picker
- Get ID Token -> Google returns an ID token (JWT) proving the user authenticated
- Firebase Validates Token -> We pass the ID token to Firebase Auth
- Firebase Creates/Signs In User -> Firebase validates the token and authenticates the user

## Useful Links

- [Firebase Console](https://console.firebase.google.com/project/house-plant-ai/settings/general/android:com.plantai.interior)
- [Google Cloud Auth](https://console.cloud.google.com/auth/clients?project=house-plant-ai)
- [Google AI Studio Project](https://aistudio.google.com/projects?project=house-plant-ai)
- [Expo Dashboard](https://expo.dev/accounts/morgish/projects/plant-interior-ai/)
- [Trefle API Docs](https://docs.trefle.io/reference/)
- [GCP Billing](https://console.cloud.google.com/billing/01855B-D7E298-5E2882?project=house-plant-ai)

## License

MIT - see [LICENSE](LICENSE).
