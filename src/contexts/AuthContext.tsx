import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Alert, Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthState, User } from '../types';
import { FirebaseAuthService } from '../services/firebaseAuthService';

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: '161202796930-np9orfkt885ej10ienccr4rc98n5oar4.apps.googleusercontent.com',
  offlineAccess: true,
});

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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    isLoading: true,
  });

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      console.log('Loading stored authentication...');
      const storedUser = await AsyncStorage.getItem('user');
      if (storedUser) {
        const user: User = JSON.parse(storedUser);
        console.log('Found stored user:', user.email);
        setAuthState({
          isAuthenticated: true,
          user,
          isLoading: false,
        });
      } else {
        console.log('No stored user found, showing login screen');
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const signInWithGoogle = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      console.log('Starting native Google Sign-In...');

      // Check if Google Play Services are available
      await GoogleSignin.hasPlayServices();

      // Sign in with Google
      const userInfo = await GoogleSignin.signIn();
      console.log('Google Sign-In successful:', userInfo);

      // Get the ID token for Firebase
      const { idToken } = userInfo.data;
      if (!idToken) {
        throw new Error('No ID token received from Google Sign-In');
      }

      console.log('Signing in to Firebase with Google ID token...');
      const firebaseUser = await FirebaseAuthService.signInWithGoogleIdToken(idToken);

      if (!firebaseUser) {
        throw new Error('Failed to sign in to Firebase');
      }

      // Create user object from Google user info
      const user: User = {
        id: firebaseUser.id,
        email: firebaseUser.email,
        name: firebaseUser.name || userInfo.data.user.name || '',
        picture: firebaseUser.picture || userInfo.data.user.photo || undefined,
        provider: 'google',
      };

      console.log('Storing user and updating auth state...');
      await AsyncStorage.setItem('user', JSON.stringify(user));
      setAuthState({
        isAuthenticated: true,
        user,
        isLoading: false,
      });
    } catch (error: any) {
      console.error('Error signing in with Google:', error);

      // Handle specific error cases
      if (error.code === 'SIGN_IN_CANCELLED') {
        console.log('User cancelled the sign-in');
      } else if (error.code === 'IN_PROGRESS') {
        console.log('Sign-in already in progress');
      } else if (error.code === 'PLAY_SERVICES_NOT_AVAILABLE') {
        console.error('Google Play Services not available');
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

      const firebaseUser = await FirebaseAuthService.signInWithAppleIdentityToken(
        credential.identityToken,
        rawNonce
      );

      if (!firebaseUser) {
        throw new Error('Failed to sign in to Firebase');
      }

      const appleName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(' ')
        .trim();

      const user: User = {
        id: firebaseUser.id,
        email: firebaseUser.email || credential.email || '',
        name: firebaseUser.name || appleName || 'Apple User',
        picture: firebaseUser.picture,
        provider: 'apple',
      };

      await AsyncStorage.setItem('user', JSON.stringify(user));
      setAuthState({
        isAuthenticated: true,
        user,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error signing in with Apple:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const signInBypass = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));

      // Create a mock user for development/prototyping
      const user: User = {
        id: 'dev-user-' + Date.now(),
        email: 'developer@plantai.com',
        name: 'Development User',
        picture: undefined,
        provider: 'google', // Use google as default provider
      };

      await AsyncStorage.setItem('user', JSON.stringify(user));
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

      // Sign out from Google
      await GoogleSignin.signOut();

      // Clear Firebase auth
      await FirebaseAuthService.signOut();

      // Clear stored user data (keep theme preference)
      await AsyncStorage.removeItem('user');

      // Reset auth state
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
      });

      console.log('Complete sign out successful');
    } catch (error) {
      console.error('Error signing out:', error);

      // Force clear state even if signout fails
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
      });
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
