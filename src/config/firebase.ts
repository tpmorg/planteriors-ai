import { initializeApp, getApps } from 'firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Auth,
  getAuth,
  GoogleAuthProvider,
  initializeAuth,
  getReactNativePersistence,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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

// Initialize Firebase only if it hasn't been initialized already
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (error) {
  // Auth may already be initialized after Fast Refresh
  auth = getAuth(app);
}

const firestore = getFirestore(app);
const storage = getStorage(app);

export { auth, firestore, storage };

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');

export default app;
