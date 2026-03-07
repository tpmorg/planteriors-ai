# Firebase Analytics Setup - Quick Fix Guide

## Issue
App crashes on start with error: "Component auth has not been registered yet"

## Root Cause
React Native Firebase requires proper native module linking through Expo prebuild.

## Solution

### 1. Configuration Added ✅
- Added `@react-native-firebase/app` plugin to `app.json`
- Added `googleServicesFile` references for iOS and Android
- Files already in place:
  - `google-services.json` (Android)
  - `GoogleService-Info.plist` (iOS)

### 2. Rebuild Native Code (REQUIRED)

Since you're using Expo Dev Client, you need to rebuild the native code:

```bash
# Clean prebuild (already running)
npx expo prebuild --clean

# Then rebuild for your platform
npx expo run:ios
# OR
npx expo run:android
```

### 3. Alternative: Use EAS Build

If local builds are slow, use EAS:

```bash
# Development build for iOS
eas build --platform ios --profile development

# Development build for Android
eas build --platform android --profile development
```

## Why This Happened

React Native Firebase is a **native module** that requires:
1. Native code compilation (not available in Expo Go)
2. Proper linking via Expo config plugins
3. Firebase config files (google-services.json, GoogleService-Info.plist)

The app was using:
- **Web Firebase SDK** for Auth (works in Expo Go)
- **React Native Firebase** for Analytics (requires native build)

This mismatch caused the crash.

## What's Working Now

After rebuild, you'll have:
- ✅ Firebase Auth (web SDK) - for Google/Apple sign-in
- ✅ Firebase Analytics (native SDK) - for event tracking
- ✅ All analytics events from `analyticsService.ts`

## Testing Analytics

After rebuild, analytics will work automatically. To verify:

1. **Check Console Logs**
   ```
   Firebase Analytics initialized
   ```

2. **Trigger Events**
   - Sign in → `sign_in` event
   - Generate design → `design_generation_started`, `design_generation_completed`
   - View subscription → `subscription_viewed`

3. **View in Firebase Console**
   - Go to Firebase Console → Analytics → DebugView
   - Enable debug mode on device (see below)

### Enable Debug Mode

**iOS:**
```bash
# In Xcode, edit scheme and add argument
-FIRDebugEnabled
```

**Android:**
```bash
adb shell setprop debug.firebase.analytics.app com.bcs.planterior
```

## Files Modified

1. `app.json` - Added Firebase plugin config
2. `src/services/analyticsService.ts` - Created (new)
3. `src/contexts/AuthContext.tsx` - Added analytics tracking
4. `src/screens/GenerationScreen.tsx` - Added analytics tracking
5. `App.tsx` - Initialize analytics on startup
6. `docs/FIREBASE_ANALYTICS.md` - Complete documentation

## Next Steps

1. ✅ Wait for prebuild to complete
2. ⏳ Run `npx expo run:ios` or `npx expo run:android`
3. ⏳ Test app launches without crash
4. ⏳ Verify analytics events in console
5. ⏳ (Optional) Add more event tracking to other screens

## Troubleshooting

### Still Crashing?

1. **Clean everything:**
   ```bash
   rm -rf ios android node_modules
   npm install
   npx expo prebuild --clean
   ```

2. **Check Firebase files exist:**
   ```bash
   ls -la google-services.json
   ls -la GoogleService-Info.plist
   ```

3. **Verify plugin in app.json:**
   ```json
   "plugins": [
     "@react-native-firebase/app"
   ]
   ```

### Analytics Not Logging?

1. Check initialization in App.tsx:
   ```typescript
   await analyticsService.initialize();
   ```

2. Check console for errors
3. Verify Firebase project is active in console
4. Check network connectivity

## Resources

- [React Native Firebase Docs](https://rnfirebase.io/)
- [Expo Config Plugins](https://docs.expo.dev/guides/config-plugins/)
- [Firebase Analytics Events](https://firebase.google.com/docs/analytics/events)
