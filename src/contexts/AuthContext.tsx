import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthState, User } from '../types';
import { env } from '../utils/env';
import { FirebaseAuthService } from '../services/firebaseAuthService';

WebBrowser.maybeCompleteAuthSession();

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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    isLoading: true,
  });

  const discovery = AuthSession.useAutoDiscovery('https://accounts.google.com');

  // Handle OAuth configuration with fallback for missing env vars
  const getOAuthConfig = () => {
    try {
      // Use the Web Client ID from Firebase Console
      const webClientId = '571611112597-ccbrf6m9i79po3okme1gtpjpl17qjcc1.apps.googleusercontent.com';

      console.log('Using OAuth Web Client ID:', webClientId);

      // Use custom scheme for Dev Client
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'plant-interior-ai',
        path: 'auth',
      });

      console.log('OAuth Redirect URI:', redirectUri);
      console.log('App Scheme:', env.getAppScheme());

      return {
        clientId: webClientId,
        scopes: ['openid', 'profile', 'email'],
        redirectUri: redirectUri,
        responseType: AuthSession.ResponseType.Code,
        additionalParameters: {},
        customParameters: {
          prompt: 'select_account',
        },
      };
    } catch (error) {
      console.warn('OAuth configuration incomplete:', error);
      return {
        clientId: 'placeholder-client-id',
        scopes: ['openid', 'profile', 'email'],
        redirectUri: AuthSession.makeRedirectUri({
          scheme: 'plant-interior-ai',
          path: 'auth',
        }),
        additionalParameters: {},
        customParameters: {
          prompt: 'select_account',
        },
      };
    }
  };

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    getOAuthConfig(),
    discovery
  );

  useEffect(() => {
    loadStoredAuth();
  }, []);

  useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleAuthResponse(response.authentication);
    }
  }, [response]);

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

  const handleGoogleAuthResponse = async (authentication: any) => {
    try {
      console.log('Received Google auth response:', authentication);

      if (!authentication?.accessToken) {
        console.error('No access token received from Google OAuth');
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Get user info from Google using access token
      console.log('Fetching user info from Google...');
      const userInfoResponse = await fetch(
        `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${authentication.accessToken}`
      );
      const userInfo = await userInfoResponse.json();
      console.log('Google user info:', userInfo);

      // Create user object
      const user = {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        avatar: userInfo.picture,
      };

      console.log('Storing user and updating auth state...');
      await AsyncStorage.setItem('user', JSON.stringify(user));
      setAuthState({
        isAuthenticated: true,
        user,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error handling Google auth response:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const signInWithGoogle = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      console.log('Starting Google OAuth with expo-auth-session...');
      await promptAsync();
    } catch (error) {
      console.error('Error signing in with Google:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const signInWithApple = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      // Apple Sign In implementation would go here
      // For now, we'll show a placeholder
      console.log('Apple Sign In not implemented yet');
      setAuthState(prev => ({ ...prev, isLoading: false }));
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

      // Force clear state even if Firebase signout fails
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