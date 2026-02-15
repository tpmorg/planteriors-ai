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
- [Expo Dashboard](https://expo.dev/accounts/morgish/projects/plant-interior-ai/)
- [Trefle API Docs](https://docs.trefle.io/reference/)
- [GCP Billing](https://console.cloud.google.com/billing/01855B-D7E298-5E2882?project=house-plant-ai)

## License

MIT - see [LICENSE](LICENSE).
