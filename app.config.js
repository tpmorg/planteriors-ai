const dotenv = require('dotenv');
const path = require('path');

// Load .env.local first, then fall back to .env
dotenv.config({ path: path.resolve(__dirname, '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

const appEnv = process.env.APP_ENV || 'development';

const getEnv = (key, fallback = '') => {
  const value = process.env[key];
  if (!value || /^\$\{.+\}$/.test(value)) {
    return fallback;
  }
  return value;
};

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    googleClientId: getEnv('GOOGLE_CLIENT_ID'),
    googleClientSecret: getEnv('GOOGLE_CLIENT_SECRET'),
    geminiApiKey: getEnv('GEMINI_API_KEY'),
    sentryDsn: getEnv('SENTRY_DSN', getEnv('EXPO_PUBLIC_SENTRY_DSN')),
    appEnv,
    appName: getEnv('APP_NAME', 'Planterior AI'),
    appScheme: getEnv('APP_SCHEME', 'planterior-ai'),
    appDomain: getEnv('APP_DOMAIN', 'planterior.app'),
    appleClientId: getEnv('APPLE_CLIENT_ID'),
    debugMode: process.env.DEBUG_MODE === 'true',
    apiTimeout: parseInt(process.env.API_TIMEOUT || '30000', 10),
    revenueCatEntitlementId: getEnv('REVENUECAT_ENTITLEMENT_ID', 'Planterior Pro'),
    revenueCatIosApiKeyProduction: getEnv('REVENUECAT_IOS_API_KEY_PRODUCTION'),
    revenueCatGoogleApiKeyProduction: getEnv('REVENUECAT_GOOGLE_API_KEY_PRODUCTION'),
  },
});
