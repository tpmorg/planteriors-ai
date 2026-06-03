const dotenv = require('dotenv');
const path = require('path');

// Load .env.local first, then fall back to .env
dotenv.config({ path: path.resolve(__dirname, '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

const appEnv = process.env.APP_ENV || 'development';

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    sentryDsn: process.env.SENTRY_DSN || process.env.EXPO_PUBLIC_SENTRY_DSN || '',
    appEnv,
    appName: process.env.APP_NAME || 'Planterior AI',
    appScheme: process.env.APP_SCHEME || 'planterior-ai',
    appDomain: process.env.APP_DOMAIN || 'planterior.app',
    appleClientId: process.env.APPLE_CLIENT_ID || '',
    debugMode: process.env.DEBUG_MODE === 'true',
    apiTimeout: parseInt(process.env.API_TIMEOUT || '30000', 10),
    revenueCatEntitlementId: process.env.REVENUECAT_ENTITLEMENT_ID || 'Planterior Pro',
    revenueCatIosApiKeyProduction: process.env.REVENUECAT_IOS_API_KEY_PRODUCTION || '',
    revenueCatGoogleApiKeyProduction: process.env.REVENUECAT_GOOGLE_API_KEY_PRODUCTION || '',
  },
});
