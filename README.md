# 🌱 Planterior AI

Transform your interior spaces with AI-powered plant design recommendations. Take photos of rooms, select plant types and styles, and receive AI-generated images showing how plants would look in your space. Features a modern tab-based interface, gesture-controlled image viewing, and comprehensive gallery management.

<div align="center">

![Planterior AI](https://via.placeholder.com/800x400/2d5016/ffffff?text=Planterior+AI)

[![React Native](https://img.shields.io/badge/React%20Native-0.81.4-blue.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-52.0.0-black.svg)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Gemini](https://img.shields.io/badge/Gemini-2.5%20Flash%20Image%20Preview-green.svg)](https://aistudio.google.com/)

</div>

## ✨ Features

### 🎯 Core Functionality
- 📸 **Smart Camera Integration** - Capture room photos or select from gallery
- 🔐 **Secure Authentication** - Google Sign-In with skip option for testing
- 🌿 **AI-Powered Design** - Generate realistic plant placements using Gemini 2.5 Flash Image Preview
- 🎨 **Multiple Plant Styles** - 4 plant types with 3+ styles each
- ⚡ **Real-time Processing** - Live API progress tracking (no fake delays)
- 💾 **Local Database** - SQLite storage with automatic image caching

### 🚀 Modern Interface
- 📱 **Tab Navigation** - Gallery, Account, and Settings with auto-hide behavior
- 🖼️ **Gallery Management** - 2-column grid layout with pull-to-refresh
- 🔍 **Gesture Controls** - Pinch-to-zoom, pan, and swipe interactions
- 📋 **Smart Modals** - 50% screen coverage with pull-to-close gestures
- 💫 **Smooth Animations** - React Native Reanimated for fluid interactions
- 📐 **Safe Area Support** - Dynamic positioning above native navigation

### 🎨 User Experience
- ❤️ **Favorites System** - Heart toggle for favorite designs
- 📤 **Sharing Options** - Export designs with customizable messages
- 🗑️ **Design Management** - Delete designs with confirmation
- ⚙️ **Preferences** - High quality modes, auto-save, notifications
- 📊 **Storage Management** - Cache clearing and download tracking

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20.19.4 or higher
- **Expo CLI** - `npm install -g @expo/cli`
- **Google OAuth Client ID** - [Get one here](https://console.cloud.google.com/)
- **Gemini API Key** - [Get one here](https://aistudio.google.com/)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/tpmorg/plant-interiors-ai.git
   cd planterior-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure your API keys**

   **IMPORTANT**: Never store API keys in `app.json` - it's tracked by git!

   Copy the environment template and add your credentials:
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` with your actual values:
   ```env
   GOOGLE_CLIENT_ID=your_actual_google_client_id
   GEMINI_API_KEY=your_actual_gemini_api_key
   TRUFLE_API_KEY=your_actual_trufle_api_key
   ```

   The app automatically loads these via [app.config.js](app.config.js) at build time.

### Environment Variables & EAS Secrets

The app uses a layered approach for environment variables:

| Context | Source | Used For |
|---------|--------|----------|
| Local Development | `.env.local` | Running locally with `npm start` |
| EAS Builds | EAS Secrets | Cloud builds via `eas build` |

#### How It Works

1. **Local Development**: `app.config.js` reads from `.env.local` using `dotenv`
2. **EAS Builds**: EAS automatically injects secrets set via `eas secret`
3. **Runtime**: `src/utils/env.ts` reads values from `Constants.expoConfig.extra`

#### Managing EAS Secrets

```bash
# List all secrets
eas secret:list

# Create/update a secret
eas secret:create --name GEMINI_API_KEY --value "your-api-key" --scope project

# Delete a secret
eas secret:delete GEMINI_API_KEY

# Create secrets for different environments
eas secret:create --name GEMINI_API_KEY --value "dev-key" --scope project --type string
```

#### Required Secrets for EAS Builds

Set these secrets before running `eas build`:

```bash
eas secret:create --name GOOGLE_CLIENT_ID --value "your-client-id" --scope project
eas secret:create --name GEMINI_API_KEY --value "your-api-key" --scope project
eas secret:create --name TRUFLE_API_KEY --value "your-api-key" --scope project
```

The `app.config.js` automatically uses `process.env.*` which EAS populates from your secrets during builds.

4. **Start the development server**
   ```bash
   # Start Expo development server
   npm start

   # Run on specific platform
   npm run ios     # iOS Simulator
   npm run android # Android Emulator
   npm run web     # Web Browser
   ```

## Managing Claude plugins and MCPs

In general, favor disabling all and enabling indidivual plugin skills for focused tasks. 

# When you have plugins enabled, try:
claude mcp list  # or similar command to see active MCP servers

# When starting new Expo app or major refactor
claude plugin enable expo-app-design
claude plugin enable frontend-design

# When deploying
claude plugin enable expo-deployment

# When upgrading Expo versions
claude plugin enable upgrading-expo


## 📱 How It Works

1. **🔑 Launch & Auth** - App opens with authentication screen (Google Sign-In or skip)
2. **🏠 Main Interface** - Tab-based navigation: Gallery (home), Account, Settings
3. **➕ Create Design** - Tap "+" button in gallery to start new design
4. **📸 Capture** - Take a photo of your room or select from gallery
5. **🌱 Choose Plants** - Select from 4 plant types and multiple styles:
   - **Succulents** - Modern, Rustic, Minimalist
   - **Tropical Plants** - Jungle, Contemporary, Bohemian
   - **Flowering Plants** - Cottage, Elegant, Vibrant
   - **Hanging Plants** - Cascading, Structured, Natural
6. **🤖 AI Generation** - Real-time progress with live API status updates
7. **🖼️ View Results** - Full-screen image with pinch-to-zoom and gesture controls
8. **ℹ️ Design Details** - Pull-up modal (50% screen) with plant information
9. **💾 Save & Manage** - Auto-save to gallery, favorite, share, or delete designs

## 🏗️ Architecture

```
planterior-ai/
├── src/
│   ├── contexts/           # React Context
│   │   ├── AuthContext.tsx         # OAuth authentication
│   │   └── TabBarContext.tsx       # Tab navigation with scroll behavior
│   ├── screens/            # Main App Screens
│   │   ├── AuthScreen.tsx          # Google Sign-In (launch screen)
│   │   ├── GalleryScreen.tsx       # Main gallery with saved designs
│   │   ├── AccountScreen.tsx       # User profile and settings
│   │   ├── SettingsScreen.tsx      # App preferences
│   │   ├── CameraScreen.tsx        # Photo capture/selection
│   │   ├── PlantSelectionScreen.tsx # Plant/style selection
│   │   ├── GenerationScreen.tsx    # AI processing & progress
│   │   └── DesignDetailScreen.tsx  # Full-screen image with gestures
│   ├── services/           # External APIs & Storage
│   │   ├── geminiService.ts        # Gemini AI integration
│   │   └── databaseService.ts      # SQLite local storage
│   ├── types/              # TypeScript Definitions
│   └── utils/              # Helper Functions
├── App.tsx                 # Tab navigation & app structure
├── app.json               # Expo configuration
├── README.md              # This file
└── CLAUDE.md              # Detailed technical documentation
```

## 🔧 Configuration

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **Google+ API**
4. Create **OAuth 2.0 credentials**
5. Add your bundle ID (iOS) and package name (Android)
6. Copy the Client ID to `.env.local` (see configuration steps above)

### Gemini API Setup

1. Visit [Google AI Studio](https://aistudio.google.com/) and create an account
2. Generate an API key for Gemini
3. Ensure Gemini 2.5 Flash Image Preview is available in your region
4. Add the API key to `.env.local` (see configuration steps above)

## 🛠️ Development

### Available Scripts

```bash
# Development
npm start          # Start Expo development server
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
npm run web        # Run in web browser

# Development with options
npx expo start --clear         # Start with cleared cache
npx expo start --dev-client    # Start with development build
npx expo start --tunnel        # Start with tunnel for external testing

# Code Quality
npm run lint       # Run ESLint (if configured)
npx tsc --noEmit   # TypeScript type checking
npx expo doctor    # Check for common configuration issues

# Platform-specific development
npx expo run:ios      # Build and run on iOS device/simulator
npx expo run:android  # Build and run on Android device/emulator
```

### 📱 Expo Commands & Build Processes

#### Development Setup
```bash
# Install Expo CLI globally
npm install -g @expo/cli

# Install EAS CLI for builds
npm install -g eas-cli

# Login to Expo account
npx expo login

# Check project configuration
npx expo doctor
```

#### Local Development
```bash
# Start development server
npx expo start

# Development server options
npx expo start --clear           # Clear cache before starting
npx expo start --offline         # Work offline (no network required)
npx expo start --lan            # Use LAN instead of localhost
npx expo start --tunnel          # Use ngrok tunnel for external access
npx expo start --dev-client      # Use development build
npx expo start --go             # Open in Expo Go app automatically

# Platform-specific development
npx expo start --ios            # Open iOS simulator automatically
npx expo start --android        # Open Android emulator automatically
npx expo start --web            # Open web browser automatically
```

#### Building & Distribution

##### Development Builds
```bash
# Configure EAS build
eas build:configure

# Create development build (includes dev tools)
eas build --profile development --platform ios
eas build --profile development --platform android

# Install development build on device
eas build:run --profile development --platform ios
eas build:run --profile development --platform android
```

##### Production Builds
```bash
# Build for app stores
eas build --profile production --platform ios
eas build --profile production --platform android

# Build for both platforms
eas build --profile production --platform all

# Build with custom configuration
eas build --profile production --platform ios --clear-cache
eas build --profile production --platform android --local
```

##### Preview Builds (Internal Testing)
```bash
# Create preview build for internal distribution
eas build --profile preview --platform ios
eas build --profile preview --platform android

# Submit preview to TestFlight/Internal Testing
eas submit --profile preview --platform ios
eas submit --profile preview --platform android
```

#### App Store Submission
```bash
# Configure submission
eas submit:configure

# Submit to App Store Connect (iOS)
eas submit --platform ios

# Submit to Google Play Console (Android)
eas submit --platform android

# Submit with specific build
eas submit --platform ios --id YOUR_BUILD_ID
```

#### Updates & Deployment
```bash
# Configure EAS Update
eas update:configure

# Publish update to all users
eas update --channel production --message "Bug fixes and improvements"

# Publish update to specific channel
eas update --channel preview --message "Beta features"

# View update history
eas update:list

# Rollback to previous update
eas update:rollback --channel production
```

#### Debugging & Testing
```bash
# View build logs
eas build:list
eas build:view BUILD_ID

# View detailed logs via CLI (most reliable method)
eas build:view BUILD_ID                    # View build details and status
eas build:list --platform android --limit 5 # List recent Android builds
eas build:list --platform ios --limit 5     # List recent iOS builds

# Download and view raw log files
eas build:view BUILD_ID --json | grep -o 'https://job-logs.eascdn.net[^"]*' | head -1 | xargs curl -o build-log.txt
cat build-log.txt

# Test on physical devices
npx expo start --tunnel        # Share via QR code
npx expo start --lan          # Share on local network

# Debug specific platforms
npx expo run:ios --device      # Run on connected iOS device
npx expo run:android --device  # Run on connected Android device

# Performance profiling
npx expo start --profiling     # Enable performance profiling
```

#### Testing with Android Emulators & ADB

##### Setting Up Android Emulator (Tablets)

```bash
# List available AVDs (Android Virtual Devices)
emulator -list-avds

# Create a tablet emulator via Android Studio:
# 1. Open Android Studio → Tools → Device Manager
# 2. Click "Create Device"
# 3. Select "Tablet" category → Choose device (e.g., Pixel Tablet, Nexus 9)
# 4. Select system image (API 34 recommended)
# 5. Name it (e.g., "Pixel_Tablet_API_34")

# Start a specific emulator
emulator -avd Pixel_Tablet_API_34

# Start emulator with specific options
emulator -avd Pixel_Tablet_API_34 -no-snapshot-load  # Fresh boot
emulator -avd Pixel_Tablet_API_34 -gpu host          # Better graphics
```

##### ADB Commands for Development

```bash
# Check connected devices/emulators
adb devices

# Install APK on connected device/emulator
adb install path/to/app.apk

# Install APK and replace existing (update)
adb install -r path/to/app.apk

# Install on specific device (when multiple connected)
adb -s emulator-5554 install path/to/app.apk

# Uninstall app
adb uninstall com.plantai.interior

# View device logs (useful for debugging)
adb logcat

# Filter logs by app
adb logcat | grep -i "plantai\|expo\|react"

# Clear app data
adb shell pm clear com.plantai.interior

# Take screenshot
adb exec-out screencap -p > screenshot.png

# Record screen
adb shell screenrecord /sdcard/demo.mp4
adb pull /sdcard/demo.mp4
```

##### Installing EAS Builds on Emulators

```bash
# After running eas build, download the APK
# Option 1: Use the URL from build output
curl -o app.apk "https://expo.dev/artifacts/eas/..."

# Option 2: Use eas build:run (installs automatically)
eas build:run --platform android --profile development

# Option 3: Download from expo.dev dashboard and install manually
adb install ~/Downloads/application-*.apk
```

##### Testing on Multiple Device Sizes

```bash
# Start multiple emulators for testing different screen sizes
emulator -avd Pixel_7_API_34 &      # Phone
emulator -avd Pixel_Tablet_API_34 & # Tablet

# Install on all connected devices
adb devices | grep -v "List" | awk '{print $1}' | xargs -I {} adb -s {} install app.apk
```

#### Environment Management
```bash
# Work with different environments
eas build --profile development
eas build --profile preview
eas build --profile production

# Use custom environment variables
eas build --profile production --clear-cache
eas update --channel staging --message "Staging update"

# View project configuration
npx expo config
npx expo config --type public    # View public configuration only
```

#### Maintenance & Utilities
```bash
# Clear various caches
npx expo start --clear           # Clear Expo cache
npm start -- --reset-cache      # Clear Metro bundler cache
rm -rf node_modules && npm install  # Clear node modules

# Project health checks
npx expo doctor                  # Check for common issues
npx expo install --check        # Check for version mismatches
npx expo upgrade                 # Upgrade to latest Expo SDK

# Asset optimization
npx expo export                  # Export static files
npx expo optimize               # Optimize images and assets
```

#### Continuous Integration Examples
```yaml
# GitHub Actions example
- name: Setup Expo
  uses: expo/expo-github-action@v8
  with:
    expo-version: latest
    token: ${{ secrets.EXPO_TOKEN }}

- name: Install dependencies
  run: npm ci

- name: Build app
  run: eas build --platform all --non-interactive

- name: Deploy update
  run: eas update --channel production --message "CI/CD Update"
```

## 🔒 Privacy & Security

- **Local Storage**: User photos are processed locally and not permanently stored
- **API Security**: All API calls use secure authentication tokens
- **Permissions**: Minimal permissions requested (camera, photo library)
- **Data Protection**: No personal data stored without explicit consent

## 🤝 Contributing

We welcome contributions! Please see our [contributing guidelines](CLAUDE.md#contributing) for details.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📋 Roadmap

### 🚧 Coming Soon
- [ ] Apple Sign-In implementation
- [ ] Design history and favorites
- [ ] Social sharing features
- [ ] Plant care tips integration

### 🔮 Future Enhancements
- [ ] AR preview functionality
- [ ] Multiple room support
- [ ] Professional designer consultation
- [ ] Plant marketplace integration
- [ ] Seasonal design recommendations

## The Google Authentication Flow
- Native Google Sign-In → User signs in via Android's native Google account picker
- Get ID Token → Google returns an ID token (JWT) proving the user authenticated
- Firebase Validates Token → We pass the ID token to Firebase Auth (line 141 in AuthContext)
- Firebase Creates/Signs In User → Firebase validates the token and authenticates the user

## Useful Links

- https://console.firebase.google.com/project/house-plant-ai/settings/general/android:com.plantai.interior
- https://console.cloud.google.com/auth/clients?project=house-plant-ai
- https://expo.dev/accounts/morgish/projects/plant-interior-ai/
- https://docs.trefle.io/reference/
- https://console.cloud.google.com/billing/01855B-D7E298-5E2882?project=house-plant-ai

## When to rebuild

What Requires a Rebuild (Native Changes)

✅ App icon (icon in app.json)
✅ Splash screen (splash in app.json)
✅ App name, bundle identifier, version
✅ Native plugins/modules
✅ Permissions (camera, location, etc.)

What Doesn't Require a Rebuild (JS Changes)
❌ React/TypeScript code
❌ Components, screens, services
❌ Images loaded at runtime
❌ Navigation, styling, logic

## 🐛 Troubleshooting

### Common Issues

**Camera not working?**
- Check app permissions in device settings
- Restart the app after granting permissions

**OAuth authentication failing?**
- Verify your Google Client ID is correct
- Ensure bundle ID matches Google Console configuration

**AI generation taking too long?**
- Check your internet connection
- Verify Gemini API key and quota limits

**Build logs not showing on expo.dev?**

If you see "Errored" but can't view logs in the web UI, try these alternatives:

1. **CLI Method (Most Reliable)**:
   ```bash
   # List recent builds
   eas build:list --platform android --limit 5

   # View specific build details
   eas build:view <BUILD_ID>
   ```

2. **Web UI Tips**:
   - Hard refresh the page (Cmd+Shift+R or Ctrl+Shift+R)
   - Wait 1-2 minutes after build completes (logs may still be uploading)
   - Look for "Build Phases" section and expand each phase
   - Check for a "Logs" tab at the top of the build page

3. **Direct Log File Access**:
   ```bash
   # Download raw log files
   eas build:view <BUILD_ID> --json | grep -o 'https://job-logs.eascdn.net[^"]*' | head -1 | xargs curl -o build-log.txt
   cat build-log.txt
   ```

4. **Common Build Errors**:
   - **"Path to google-services.json is not defined"**: Add `"googleServicesFile": "./google-services.json"` to `expo.android` in app.json
   - **Invalid UUID appId**: Remove or update `extra.eas.projectId` in app.json, then run `eas init`
   - **Prebuild failed**: Check that all native dependencies are compatible with your Expo SDK version

For more detailed troubleshooting, see [CLAUDE.md](CLAUDE.md#troubleshooting).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Expo Team** - For the amazing React Native framework and development tools
- **Google** - For Gemini AI and robust authentication services
- **React Navigation** - For seamless app navigation
- **React Native Reanimated** - For smooth gesture interactions and animations
- **React Native Gesture Handler** - For advanced touch gesture recognition

## 📞 Support

- 📧 **Email**: support@planterior.ai
- 🐛 **Issues**: [GitHub Issues](https://github.com/tpmorg/plant-interiors-ai/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/tpmorg/plant-interiors-ai/discussions)

---

<div align="center">

**Made with ❤️ and 🤖 AI**

[Website](https://planterior.ai) • [Download iOS](https://apps.apple.com) • [Download Android](https://play.google.com)

</div>