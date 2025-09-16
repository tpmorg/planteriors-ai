# 🌱 PlantAI Interior

Transform your interior spaces with AI-powered plant design recommendations. Take a photo of any room and see how it would look with beautiful plants integrated seamlessly into your space.

<div align="center">

![PlantAI Interior](https://via.placeholder.com/800x400/2d5016/ffffff?text=PlantAI+Interior)

[![React Native](https://img.shields.io/badge/React%20Native-0.81.4-blue.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-52.0.0-black.svg)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![OpenRouter](https://img.shields.io/badge/OpenRouter-Gemini%202.5%20Flash-green.svg)](https://openrouter.ai/)

</div>

## ✨ Features

- 📸 **Smart Camera Integration** - Capture room photos with optimized settings
- 🔐 **Secure Authentication** - Google and Apple Sign-In support
- 🌿 **AI-Powered Design** - Generate realistic plant placements using Gemini 2.5 Flash
- 🎨 **Multiple Plant Styles** - Choose from various plant types and arrangement styles
- ⚡ **Real-time Processing** - Watch your design come to life with progress animations
- 💾 **Cloud Storage** - Save and access your designs across devices
- 📱 **Cross-Platform** - Native iOS and Android experience

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20.19.4 or higher
- **Expo CLI** - `npm install -g @expo/cli`
- **Google OAuth Client ID** - [Get one here](https://console.cloud.google.com/)
- **OpenRouter API Key** - [Sign up here](https://openrouter.ai/)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/tpmorg/plant-interiors-ai.git
   cd plant-interior-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure your API keys**

   Copy the environment template and add your credentials:
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` with your actual values:
   ```env
   GOOGLE_CLIENT_ID=your_actual_google_client_id
   OPENROUTER_API_KEY=your_actual_openrouter_api_key
   ```

   **Alternative:** Update the `app.json` file directly:
   ```json
   {
     "expo": {
       "extra": {
         "googleClientId": "YOUR_GOOGLE_CLIENT_ID",
         "openRouterApiKey": "YOUR_OPENROUTER_API_KEY"
       }
     }
   }
   ```

4. **Start the development server**
   ```bash
   # Start Expo development server
   npm start

   # Run on specific platform
   npm run ios     # iOS Simulator
   npm run android # Android Emulator
   npm run web     # Web Browser
   ```

## 📱 How It Works

1. **🔑 Sign In** - Authenticate with Google or Apple
2. **📸 Capture** - Take a photo of your room or select from gallery
3. **🌱 Choose Plants** - Select from 4 plant types and multiple styles:
   - **Succulents** - Modern, Rustic, Minimalist
   - **Tropical Plants** - Jungle, Contemporary, Bohemian
   - **Flowering Plants** - Cottage, Elegant, Vibrant
   - **Hanging Plants** - Cascading, Structured, Natural
4. **🤖 AI Magic** - Watch as AI generates your personalized plant design
5. **✨ Results** - View and save your transformed space

## 🏗️ Architecture

```
plant-interior-ai/
├── src/
│   ├── contexts/           # React Context (Auth, State)
│   ├── screens/            # Main App Screens
│   │   ├── AuthScreen.tsx          # Authentication
│   │   ├── CameraScreen.tsx        # Photo Capture
│   │   ├── PlantSelectionScreen.tsx # Plant/Style Selection
│   │   └── GenerationScreen.tsx    # AI Processing & Results
│   ├── services/           # External APIs
│   │   └── openRouterService.ts    # Gemini Integration
│   ├── types/              # TypeScript Definitions
│   └── utils/              # Helper Functions
├── App.tsx                 # Navigation & App Structure
├── app.json               # Expo Configuration
└── README.md              # This file
```

## 🔧 Configuration

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **Google+ API**
4. Create **OAuth 2.0 credentials**
5. Add your bundle ID (iOS) and package name (Android)
6. Copy the Client ID to `app.json`

### OpenRouter API Setup

1. Visit [OpenRouter](https://openrouter.ai/) and create an account
2. Generate an API key from your dashboard
3. Ensure you have credits for the Gemini 2.5 Flash model
4. Add the API key to `app.json`

## 🛠️ Development

### Available Scripts

```bash
npm start          # Start Expo development server
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
npm run web        # Run in web browser
npm run lint       # Run ESLint (if configured)
npx tsc --noEmit   # Type checking
```

### Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure build
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
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
- Verify OpenRouter API key and credits

For more detailed troubleshooting, see [CLAUDE.md](CLAUDE.md#troubleshooting).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Expo Team** - For the amazing React Native framework
- **OpenRouter** - For providing access to cutting-edge AI models
- **Google** - For robust authentication services
- **React Navigation** - For seamless app navigation

## 📞 Support

- 📧 **Email**: support@plantai-interior.com
- 🐛 **Issues**: [GitHub Issues](https://github.com/tpmorg/plant-interiors-ai/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/tpmorg/plant-interiors-ai/discussions)

---

<div align="center">

**Made with ❤️ and 🤖 AI**

[Website](https://plantai-interior.com) • [Download iOS](https://apps.apple.com) • [Download Android](https://play.google.com)

</div>