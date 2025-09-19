# PlantAI Interior - React Native Expo App

A React Native Expo application that uses AI to generate plant-enhanced interior designs. Users authenticate, take photos of rooms, select plant types and styles, and receive AI-generated images showing how plants would look in their space. Features include a modern tab-based interface, gesture-controlled image viewing, and a comprehensive gallery system.

## 🚀 Quick Start

### Prerequisites
- Node.js 20.19.4 or higher
- Expo CLI (`npm install -g @expo/cli`)
- iOS Simulator (for iOS development) or Android Emulator (for Android development)
- Google OAuth Client ID (for authentication)
- Gemini API Key (for AI image generation)

### Installation

1. **Clone and Install Dependencies**
```bash
cd plant-interior-ai
npm install
```

2. **Configure Environment Variables**

Method 1 - Using .env.local (Recommended):
```bash
cp .env.example .env.local
```

Edit `.env.local` with your actual values:
```env
GOOGLE_CLIENT_ID=your_actual_google_client_id
GEMINI_API_KEY=your_actual_gemini_api_key
```

Method 2 - Direct app.json configuration:
```json
{
  "expo": {
    "extra": {
      "googleClientId": "YOUR_ACTUAL_GOOGLE_CLIENT_ID",
      "geminiApiKey": "YOUR_ACTUAL_GEMINI_API_KEY"
    }
  }
}
```

3. **Run the Application**
```bash
# For iOS
npm run ios

# For Android
npm run android

# For Web
npm run web
```

## 🏗️ Project Structure

```
plant-interior-ai/
├── src/
│   ├── components/          # Reusable UI components
│   ├── contexts/           # React contexts
│   │   ├── AuthContext.tsx # OAuth authentication context
│   │   └── TabBarContext.tsx # Tab navigation with scroll behavior
│   ├── screens/            # Main application screens
│   │   ├── AuthScreen.tsx  # Google/Apple sign-in (launch screen)
│   │   ├── GalleryScreen.tsx # Main gallery with saved designs
│   │   ├── AccountScreen.tsx # User profile and settings
│   │   ├── SettingsScreen.tsx # App preferences and configuration
│   │   ├── CameraScreen.tsx # Camera for room photos
│   │   ├── PlantSelectionScreen.tsx # Plant type & style selection
│   │   ├── GenerationScreen.tsx # AI generation & progress
│   │   └── DesignDetailScreen.tsx # Full-screen image with gestures
│   ├── services/           # API services
│   │   ├── geminiService.ts # Gemini AI integration
│   │   └── databaseService.ts # SQLite local storage
│   ├── types/              # TypeScript type definitions
│   │   └── index.ts        # Core app types
│   └── utils/              # Utility functions
├── assets/                 # Images, icons, fonts
├── App.tsx                 # Main app with tab navigation
├── app.json               # Expo configuration
├── package.json           # Dependencies and scripts
└── CLAUDE.md             # Documentation
```

## 🔧 Core Features Implementation

### 1. Authentication & Navigation
- **Launch Flow**: App starts with authentication screen
- **Google Sign-In**: Implemented using `expo-auth-session`
- **Skip Option**: Users can skip authentication for testing
- **Tab Navigation**: Bottom tab bar with Gallery, Account, Settings
- **Auto-Hide Tabs**: Tabs hide on scroll down, show on scroll up
- **Safe Area Support**: Dynamic positioning above native navigation
- **Location**: `src/contexts/AuthContext.tsx`, `src/contexts/TabBarContext.tsx`

### 2. Gallery & Design Management
- **Main Interface**: Gallery is the primary home screen
- **Design Storage**: SQLite database with local image caching
- **Grid Layout**: 2-column responsive design grid
- **Favorites**: Toggle favorite status on designs
- **Create New**: Floating action button to start new design
- **Pull-to-Refresh**: Swipe down to reload designs
- **Location**: `src/screens/GalleryScreen.tsx`, `src/services/databaseService.ts`

### 3. Image Viewing & Interaction
- **Full-Screen Display**: Maximized image viewing experience
- **Pinch-to-Zoom**: Multi-touch gesture support using react-native-reanimated
- **Pan Support**: Drag images when zoomed in
- **Info Modal**: 50% screen modal with pull-to-close gestures
- **Multiple Close Options**: Tap backdrop, drag down, tap title bar, X button
- **Gesture Boundaries**: Smart snap-back and close detection
- **Location**: `src/screens/DesignDetailScreen.tsx`

### 4. Camera & Photo Capture
- **Dual Input**: Live camera or gallery photo selection
- **Permission Handling**: Automatic camera and photo library access
- **Preview System**: Image confirmation before proceeding
- **High Quality**: Optimized image capture settings
- **Location**: `src/screens/CameraScreen.tsx`

### 5. AI Plant Integration
- **Plant Selection**: 4 plant types with multiple style options
- **Visual Interface**: Card-based selection with descriptions
- **Custom Prompts**: Optional user-defined requirements
- **Style Preview**: Visual examples for each style option
- **Location**: `src/screens/PlantSelectionScreen.tsx`

### 6. AI Generation & Progress
- **Real-Time Progress**: Live API call progress tracking (not fake delays)
- **Two-Phase System**: Preparation phase + actual generation
- **Visual Feedback**: Pulsing indicators and progress percentages
- **Error Handling**: Retry mechanisms with user feedback
- **Gemini Integration**: Direct API calls to Gemini 2.5 Flash Image Preview
- **Location**: `src/screens/GenerationScreen.tsx`, `src/services/geminiService.ts`

### 7. User Profile & Settings
- **Account Management**: User profile with sign-out option
- **App Preferences**: High quality images, auto-save, notifications
- **Storage Management**: Cache clearing and download management
- **About Section**: Version info, privacy policy, terms
- **Location**: `src/screens/AccountScreen.tsx`, `src/screens/SettingsScreen.tsx`

## 🔑 API Configuration

### Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add bundle ID for iOS and package name for Android
6. Update `app.json` with your client ID

### Gemini API Setup
1. Visit [Google AI Studio](https://aistudio.google.com/)
2. Create a new API key for Gemini
3. Update `app.json` with your API key
4. Ensure Gemini 2.5 Flash Image Preview is available in your region

## 📱 App Flow

1. **Launch & Authentication**
   - App opens with authentication screen
   - User can sign in with Google or skip for testing
   - Successful authentication leads to main app interface

2. **Main Interface (Tabbed Navigation)**
   - **Gallery Tab** (Home): View all saved designs in a grid
   - **Account Tab**: User profile, favorites, app sharing
   - **Settings Tab**: Preferences, storage, about information
   - Floating tab bar that auto-hides during scrolling

3. **Create New Design**
   - Tap "+" button in gallery to start new design
   - Choose between camera capture or gallery photo
   - Photo preview and confirmation

4. **Plant Configuration**
   - Shows captured room image as background
   - Select plant type: Succulents, Tropical, Flowering, Hanging
   - Choose style: Modern, Rustic, Minimalist, etc.
   - Optional custom prompt input

5. **AI Generation Process**
   - Real-time progress with actual API timing
   - Two-phase generation: setup + AI processing
   - Live progress percentages and status updates
   - Error handling with retry options

6. **Design Results**
   - Full-screen image display with pinch-to-zoom
   - Info modal (50% screen) with design details
   - Save to gallery, share, favorite, or delete options
   - Gesture-controlled modal with multiple close methods

7. **Gallery Management**
   - Browse all saved designs in responsive grid
   - Pull-to-refresh functionality
   - Tap designs to view in full-screen detail mode
   - Heart icons for favoriting designs

## 🛠️ Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run on web browser
npm run web

# Type checking
npx tsc --noEmit

# Linting (if configured)
npm run lint

# Build for production
expo build
```

## 🔒 Security Considerations

1. **API Keys**: Never commit real API keys to version control
2. **OAuth**: Properly configure redirect URIs
3. **Permissions**: Request minimal required permissions
4. **Image Handling**: Validate image uploads
5. **Error Handling**: Don't expose sensitive error details

## 📋 TODO: Future Enhancements

### Near-term (Next Release)
- [ ] Apple Sign-In implementation
- [ ] Image gallery/history screen
- [ ] User profile management
- [ ] Basic plant care tips
- [ ] Share functionality

### Long-term (Future Versions)
- [ ] Collections and tagging system
- [ ] Social features (sharing designs)
- [ ] Advanced plant recommendations
- [ ] AR preview functionality
- [ ] Plant care reminders
- [ ] Multiple room types support
- [ ] Custom style creation
- [ ] Professional consultation booking

## 🐛 Troubleshooting

### Common Issues

1. **Camera Permission Denied**
   - Check device permissions
   - Restart app after granting permissions
   - Verify `app.json` camera plugin configuration

2. **OAuth Not Working**
   - Verify Google Client ID is correct
   - Check bundle ID/package name matches Google Console
   - Ensure redirect URI is properly configured

3. **API Generation Fails**
   - Check OpenRouter API key is valid
   - Verify you have sufficient credits
   - Check network connectivity
   - Review error logs for specific issues

4. **Build Errors**
   - Clear node_modules and reinstall: `rm -rf node_modules && npm install`
   - Clear Expo cache: `expo r -c`
   - Check for dependency conflicts

### Debug Mode
```bash
# Run with debug logging
expo start --dev-client

# Check logs
expo logs
```

## 📚 Dependencies

### Core Dependencies
- `expo`: ~52.0.0
- `react-native`: 0.81.4
- `@react-navigation/native`: ^6.x
- `@react-navigation/stack`: ^6.x
- `expo-camera`: ^15.x
- `expo-image-picker`: ^15.x
- `expo-auth-session`: ^6.x
- `@react-native-async-storage/async-storage`: ^2.x

### Development Dependencies
- `typescript`: ^5.x
- `@types/react`: ^18.x
- `@types/react-native`: ^0.72.x

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -am 'Add your feature'`
4. Push to branch: `git push origin feature/your-feature`
5. Submit pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔗 Useful Links

- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [OpenRouter API Docs](https://openrouter.ai/docs)
- [Google OAuth Setup](https://developers.google.com/identity/protocols/oauth2)
- [Apple Sign-In](https://developer.apple.com/documentation/sign_in_with_apple)