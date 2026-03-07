const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Required for Firebase Auth in Expo RN with newer package exports.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
