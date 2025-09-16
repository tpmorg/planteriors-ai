# PlantAI Interior - React Native Expo App

A React Native Expo application that uses AI to generate plant-enhanced interior designs. Users take photos of rooms, select plant types and styles, and receive AI-generated images showing how plants would look in their space.

## 🚀 Quick Start

### Prerequisites
- Node.js 20.19.4 or higher
- Expo CLI
- iOS Simulator (for iOS development) or Android Emulator (for Android development)
- Google OAuth Client ID
- OpenRouter API Key

### Installation

1. **Clone and Install Dependencies**
```bash
cd plant-interior-ai
npm install
```

2. **Configure Environment Variables**
Update `app.json` with your API keys:
```json
{
  "expo": {
    "extra": {
      "googleClientId": "YOUR_ACTUAL_GOOGLE_CLIENT_ID",
      "openRouterApiKey": "YOUR_ACTUAL_OPENROUTER_API_KEY"
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
│   ├── contexts/           # React contexts (Auth, etc.)
│   │   └── AuthContext.tsx # OAuth authentication context
│   ├── screens/            # Main application screens
│   │   ├── AuthScreen.tsx  # Google/Apple sign-in
│   │   ├── CameraScreen.tsx # Camera for room photos
│   │   ├── PlantSelectionScreen.tsx # Plant type & style selection
│   │   └── GenerationScreen.tsx # AI generation & results
│   ├── services/           # API services
│   │   └── openRouterService.ts # OpenRouter/Gemini integration
│   ├── types/              # TypeScript type definitions
│   │   └── index.ts        # Core app types
│   └── utils/              # Utility functions
├── assets/                 # Images, icons, fonts
├── App.tsx                 # Main app component with navigation
├── app.json               # Expo configuration
└── package.json           # Dependencies and scripts
```

## 🔧 Core Features Implementation

### 1. OAuth Authentication
- **Google Sign-In**: Implemented using `expo-auth-session`
- **Apple Sign-In**: Placeholder for future implementation
- **User Persistence**: Uses `AsyncStorage` for user session
- **Location**: `src/contexts/AuthContext.tsx`

### 2. Camera Functionality
- **Camera Access**: Uses `expo-camera` for live camera
- **Photo Gallery**: Uses `expo-image-picker` for gallery selection
- **Permissions**: Automatic permission handling
- **Location**: `src/screens/CameraScreen.tsx`

### 3. Plant Selection Interface
- **Plant Types**: Succulents, Tropical, Flowering, Hanging
- **Style Options**: Modern, Rustic, Minimalist, etc.
- **Visual Selection**: Card-based UI with icons and descriptions
- **Location**: `src/screens/PlantSelectionScreen.tsx`

### 4. AI Image Generation
- **Service**: OpenRouter API with Gemini 2.5 Flash Image Preview
- **Input**: Room photo + plant selection
- **Output**: Enhanced image with integrated plants
- **Location**: `src/services/openRouterService.ts`

### 5. Loading & Results Display
- **Progress Animation**: Step-by-step generation process
- **Error Handling**: Retry mechanisms and user feedback
- **Result Preview**: Full-screen image display with options
- **Location**: `src/screens/GenerationScreen.tsx`

## 🔑 API Configuration

### Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add bundle ID for iOS and package name for Android
6. Update `app.json` with your client ID

### OpenRouter API Setup
1. Visit [OpenRouter](https://openrouter.ai/)
2. Create an account and get API key
3. Update `app.json` with your API key
4. Ensure you have credits for Gemini 2.5 Flash Image Preview model

## 📱 App Flow

1. **Authentication**
   - User opens app
   - Sees Google/Apple sign-in options
   - Authenticates and session is saved

2. **Photo Capture**
   - Camera screen opens
   - User takes photo of room interior
   - Can choose from gallery instead
   - Photo preview and confirmation

3. **Plant Selection**
   - Shows captured room image
   - User selects plant type (4 options)
   - User selects style (3 options per type)
   - Confirmation summary

4. **AI Generation**
   - Shows progress with animated steps
   - Calls OpenRouter API with Gemini model
   - Displays loading animation
   - Shows error handling if needed

5. **Results**
   - Displays generated image
   - Options to save or generate again
   - Navigation back to camera for new photos

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