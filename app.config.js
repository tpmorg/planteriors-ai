const dotenv = require('dotenv');
const path = require('path');

// Load .env.local first, then fall back to .env
dotenv.config({ path: path.resolve(__dirname, '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    appName: process.env.APP_NAME || 'Planterior AI',
    appScheme: process.env.APP_SCHEME || 'planterior-ai',
    appDomain: process.env.APP_DOMAIN || 'planterior.app',
    appleClientId: process.env.APPLE_CLIENT_ID || '',
    debugMode: process.env.DEBUG_MODE === 'true',
    apiTimeout: parseInt(process.env.API_TIMEOUT || '30000', 10),
  },
});
