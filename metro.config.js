const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

// Required for Firebase Auth in Expo RN with newer package exports.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
