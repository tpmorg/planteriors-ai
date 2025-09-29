import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import the google-services.json data
const googleServices = require('../../google-services.json');

// Extract Firebase config from google-services.json
const firebaseConfig = {
  apiKey: googleServices.client[0].api_key[0].current_key,
  authDomain: `${googleServices.project_info.project_id}.firebaseapp.com`,
  projectId: googleServices.project_info.project_id,
  storageBucket: googleServices.project_info.storage_bucket,
  messagingSenderId: googleServices.project_info.project_number,
  appId: googleServices.client[0].client_info.mobilesdk_app_id
};

console.log('Firebase config:', firebaseConfig);

// Initialize Firebase only if it hasn't been initialized already
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
console.log('Firebase app initialized:', app.name);

// Initialize Firebase Auth with AsyncStorage persistence
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (error) {
  // If auth is already initialized, get the existing instance
  auth = getAuth(app);
}

export { auth };

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');

export default app;