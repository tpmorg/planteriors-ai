# Development Build Setup

This document guides you through setting up and using development builds with Expo Dev Client instead of Expo Go.

## What Changed

The app is now configured to use **Expo Dev Client** for development, which enables:
- Native Firebase OAuth integration
- Full access to native modules
- Custom native code capabilities
- Production-ready authentication flow

## Prerequisites

1. **EAS CLI** - Install globally:
```bash
npm install -g eas-cli
```

2. **EAS Account** - Login to your Expo account:
```bash
eas login
```

3. **EAS Project** - Initialize if not already done:
```bash
eas init
```

## Configuration Files Updated

### 1. eas.json
Enhanced build profiles with:
- **Development**: Dev client with Firebase support, internal distribution
- **Preview**: APK builds for testing
- **Production**: Auto-increment versioning, production Firebase config

Key additions:
- Android: `googleServicesFile` pointing to `./google-services.json`
- iOS: Build configurations for Debug/Release
- Environment variables for different build types

### 2. app.json
Added plugins:
- `@react-native-firebase/app` - Firebase core functionality
- `@react-native-google-signin/google-signin` - Google OAuth integration

### 3. package.json
New npm scripts for easier workflow:

**Development:**
- `npm start` - Start with dev client (default)
- `npm run start:expo-go` - Start with Expo Go (fallback)

**Building:**
- `npm run build:dev:android` - Build development APK for Android
- `npm run build:dev:ios` - Build development build for iOS
- `npm run build:preview:android` - Build preview APK for Android
- `npm run build:preview:ios` - Build preview IPA for iOS
- `npm run build:prod:android` - Build production APK for Android
- `npm run build:prod:ios` - Build production IPA for iOS

## First-Time Setup

### Step 1: Create Development Build

**For Android:**
```bash
npm run build:dev:android
```

**For iOS:**
```bash
npm run build:dev:ios
```

This will:
1. Upload your project to EAS servers
2. Build a development client APK/IPA
3. Include all native dependencies (Firebase, Google Sign-In, etc.)
4. Generate a download link when complete

### Step 2: Install Development Build

**Android:**
- Download the APK from the EAS build page
- Install on your device or emulator
- Allow installation from unknown sources if prompted

**iOS:**
- For physical device: Register device UDID with Apple
- Download and install via TestFlight or direct installation
- Or use iOS Simulator

### Step 3: Start Development Server

```bash
npm start
```

This starts the Metro bundler in dev client mode. Scan the QR code from your installed dev build app.

## Daily Development Workflow

1. **Start development server:**
```bash
npm start
```

2. **Open dev client app** on your device
3. **Scan QR code** or enter URL manually
4. **Code and hot reload** - changes appear instantly

## When to Rebuild

You need to create a new development build when:
- Adding new native modules or dependencies
- Changing native configuration in app.json
- Updating Firebase or Google Sign-In settings
- Modifying iOS Info.plist or Android permissions

JavaScript-only changes don't require rebuilds.

## Next Steps: Firebase OAuth Setup

Before Firebase authentication will work, you need to:

1. **Get Firebase Config Files:**
   - Android: Ensure `google-services.json` is current
   - iOS: Download `GoogleService-Info.plist` from Firebase Console

2. **Configure OAuth Client IDs:**
   - Update `app.json` with actual Google Client IDs
   - Replace `YOUR_GOOGLE_CLIENT_ID` placeholders

3. **Add SHA-1 Fingerprints to Firebase:**
   - Development builds need their own SHA-1 fingerprints
   - Get from EAS: `eas credentials`
   - Add to Firebase Console

4. **Test Authentication:**
   - Remove "Skip Login" option from AuthScreen
   - Test Google Sign-In flow
   - Verify user authentication state

## Troubleshooting

### Viewing Build Logs

If your build fails, you need to view the logs to diagnose the issue.

**Method 1: CLI (Most Reliable)**
```bash
# List recent builds
eas build:list --platform android --limit 5

# View specific build
eas build:view <BUILD_ID>

# Get detailed JSON output
eas build:view <BUILD_ID> --json
```

**Method 2: Web UI**

Visit the build URL: `https://expo.dev/accounts/<username>/projects/<project>/builds/<BUILD_ID>`

If logs don't appear:
- Hard refresh the page (Cmd+Shift+R)
- Wait 1-2 minutes after build completes
- Expand "Build Phases" sections to see logs for each phase
- Look for a "Logs" tab at the top

**Method 3: Direct Log File Access**
```bash
# Download raw log files
eas build:view <BUILD_ID> --json | grep -o 'https://job-logs.eascdn.net[^"]*' | head -1 | xargs curl -o build-log.txt

# View the logs
cat build-log.txt

# Search for specific errors
grep -i "error\|fail\|exception" build-log.txt
```

### Build Fails
- Check EAS build logs using methods above for specific errors
- Verify all dependencies are compatible with Expo SDK 54
- Ensure Firebase config files are present

### Dev Client Won't Connect
- Make sure you're running `npm start` (not `npm run start:expo-go`)
- Check that device and computer are on same network
- Try entering URL manually instead of QR code

### Firebase Not Working
- Verify `google-services.json` is in project root
- Check Firebase plugins are in app.json
- Ensure SHA-1 fingerprints are added to Firebase Console
- Rebuild dev client after config changes

### Google Sign-In Fails
- Replace placeholder Client IDs in app.json
- Verify OAuth consent screen is configured
- Check redirect URIs match your bundle ID
- Add SHA-1 certificates to Firebase

## Useful Commands

```bash
# View all builds
eas build:list

# View credentials
eas credentials

# Configure credentials
eas credentials:configure

# View project details
eas project:info

# Build and auto-submit
eas build --platform android --profile production --auto-submit
```

## Resources

- [Expo Dev Client Docs](https://docs.expo.dev/develop/development-builds/introduction/)
- [EAS Build Docs](https://docs.expo.dev/build/introduction/)
- [Firebase Setup Guide](https://docs.expo.dev/guides/using-firebase/)
- [Google Sign-In Guide](https://react-native-google-signin.github.io/docs/setting-up/expo)
