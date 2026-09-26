import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Alert, Platform } from 'react-native';
import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { onAuthStateChanged } from 'firebase/auth';
import * as Sentry from '@sentry/react-native';
import { AuthState, User } from '../types';
import { useNetwork } from './NetworkContext';
import { FirebaseAuthService } from '../services/firebaseAuthService';
import { auth } from '../config/firebase';
import { env } from '../utils/env';

// Configure Google Sign-In only on Android.
// iOS uses Apple Sign-In exclusively in this app.
if (Platform.OS === 'android') {
  GoogleSignin.configure({
    webClientId: env.getGoogleClientId(),
    offlineAccess: true,
  });
}

interface AuthContextType extends AuthState {
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInBypass: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

const generateNonce = (length: number = 32): string => {
  const charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
};

const syncSentryUser = (user: User | null) => {
  if (!user) {
    Sentry.setUser(null);
    Sentry.setTag('user_provider', 'none');
    return;
  }

  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.name || undefined,
  });
  Sentry.setTag('user_provider', user.provider);
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { reportNetworkIssue, reportNetworkSuccess } = useNetwork();
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    isLoading: true,
  });

  // Firebase is the single source of truth for authentication state.
  // It automatically handles token refresh and persists sessions.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const user = FirebaseAuthService.mapFirebaseUserToUser(firebaseUser);
        console.log('Firebase auth state changed — user:', user.email);
        syncSentryUser(user);
        setAuthState({
          isAuthenticated: true,
          user,
          isLoading: false,
        });
      } else {
        console.log('Firebase auth state changed — no user');
        syncSentryUser(null);
        setAuthState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
        });
      }
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    let phase = 'play_services_check';

    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      console.log('Starting native Google Sign-In...');

      if (Platform.OS !== 'android') {
        console.log('Google Sign-In disabled on non-Android platform');
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Check if Google Play Services are available
      await GoogleSignin.hasPlayServices();

      // Sign in with Google
      phase = 'account_selection';
      const userInfo = await GoogleSignin.signIn();

      if (isCancelledResponse(userInfo)) {
        console.log('User cancelled Google Sign-In');
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Get the ID token for Firebase
      const idToken = userInfo.data?.idToken;
      if (!idToken) {
        throw new Error('No ID token received from Google Sign-In');
      }

      console.log('Signing in to Firebase with Google ID token...');
      phase = 'firebase_credential';
      await FirebaseAuthService.signInWithGoogleIdToken(idToken);
      reportNetworkSuccess('google_sign_in');
      // onAuthStateChanged will update authState automatically
    } catch (error: unknown) {
      const code = isErrorWithCode(error) ? String(error.code) : 'unknown';
      const isCancellation = code === statusCodes.SIGN_IN_CANCELLED;

      if (isCancellation) {
        console.log('User cancelled Google Sign-In');
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      const capturedError = error instanceof Error
        ? error
        : new Error('Unknown Google Sign-In failure');

      console.error('Google Sign-In failed', { phase, code });
      reportNetworkIssue('google_sign_in', error);

      Sentry.withScope((scope) => {
        scope.setLevel('error');
        scope.setTag('auth_provider', 'google');
        scope.setTag('auth_phase', phase);
        scope.setTag('google_sign_in_code', code);
        scope.setContext('google_sign_in', {
          phase,
          code,
          platform: Platform.OS,
        });
        Sentry.captureException(capturedError);
      });

      if (code === statusCodes.IN_PROGRESS) {
        Alert.alert(
          'Sign-In Already Open',
          'A Google sign-in is already in progress. Please wait a moment and try again.'
        );
      } else if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert(
          'Google Sign-In Unavailable',
          'Google Play Services is unavailable or out of date on this device.'
        );
      } else {
        Alert.alert(
          'Unable to Sign In',
          'Google sign-in could not be completed. Please try again.'
        );
      }

      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const signInWithApple = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));

      if (Platform.OS !== 'ios') {
        Alert.alert('Apple Sign-In unavailable', 'Apple Sign-In is only available on iOS devices.');
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      const rawNonce = generateNonce();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        throw new Error('No identity token received from Apple Sign-In');
      }

      await FirebaseAuthService.signInWithAppleIdentityToken(
        credential.identityToken,
        rawNonce
      );
      reportNetworkSuccess('apple_sign_in');
      // onAuthStateChanged will update authState automatically
    } catch (error) {
      console.error('Error signing in with Apple:', error);
      reportNetworkIssue('apple_sign_in', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const signInBypass = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));

      // Create a mock user for development/prototyping.
      // This bypasses Firebase entirely and will not persist across app restarts.
      const user: User = {
        id: 'dev-user-' + Date.now(),
        email: 'developer@plantai.com',
        name: 'Development User',
        picture: undefined,
        provider: 'google',
      };

      syncSentryUser(user);
      setAuthState({
        isAuthenticated: true,
        user,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error with bypass sign in:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const signOut = async () => {
    try {
      console.log('Starting complete sign out...');

      // Sign out from Google only on Android, where it's used.
      if (Platform.OS === 'android') {
        await GoogleSignin.signOut();
      }

      // Clear Firebase auth (fires onAuthStateChanged with null)
      await FirebaseAuthService.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      // Always clear local state to handle bypass users or any fallback scenario
      syncSentryUser(null);
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
      });
      console.log('Complete sign out successful');
    }
  };

  const value: AuthContextType = {
    ...authState,
    signInWithGoogle,
    signInWithApple,
    signInBypass,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
