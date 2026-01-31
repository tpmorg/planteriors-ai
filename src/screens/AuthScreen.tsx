import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { env } from '../utils/env';

export const AuthScreen: React.FC = () => {
  const { signInWithGoogle, signInWithApple, signInBypass, isLoading } = useAuth();
  const { theme } = useTheme();
  const showBypass = env.isDebugMode() || __DEV__;
  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Planterior AI</Text>
          <Text style={styles.subtitle}>
            Transform your rooms with AI-generated plant designs
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.googleButton]}
            onPress={signInWithGoogle}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.appleButton]}
            onPress={signInWithApple}
            disabled={isLoading}
          >
            <Text style={[styles.buttonText, styles.appleButtonText]}>
              Continue with Apple
            </Text>
          </TouchableOpacity>

          {showBypass && (
            <TouchableOpacity
              style={[styles.button, styles.bypassButton]}
              onPress={signInBypass}
              disabled={isLoading}
            >
              <Text style={[styles.buttonText, styles.bypassButtonText]}>
                🚀 Skip Login (Development)
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.disclaimer}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonContainer: {
    gap: 16,
    marginBottom: 32,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  appleButton: {
    backgroundColor: theme.isDark ? '#ffffff' : '#000000',
  },
  bypassButton: {
    backgroundColor: '#f59e0b',
    borderWidth: 1,
    borderColor: '#d97706',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  appleButtonText: {
    color: theme.isDark ? '#000000' : '#ffffff',
  },
  bypassButtonText: {
    color: '#ffffff',
  },
  disclaimer: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});