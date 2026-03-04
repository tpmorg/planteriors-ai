import React from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { AppIcon } from '../components/AppIcon';

export const AuthScreen: React.FC = () => {
  const { signInWithGoogle, signInWithApple, isLoading } = useAuth();
  const { theme } = useTheme();
  // const showBypass = env.isDebugMode() || __DEV__;
  const styles = createStyles(theme);

  const openExternalLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Link Unavailable', 'Unable to open this link on your device.');
        return;
      }
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Link Error', 'Something went wrong while opening the link.');
    }
  };

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container}>
      <View style={styles.bgBlobA} />
      <View style={styles.bgBlobB} />
      <View style={styles.bgLeafOne}>
        <AppIcon name="Leaf" size={120} color={theme.isDark ? 'rgba(86,194,138,0.2)' : 'rgba(47,122,82,0.14)'} />
      </View>
      <View style={styles.bgLeafTwo}>
        <AppIcon name="Plant" size={110} color={theme.isDark ? 'rgba(181,122,82,0.2)' : 'rgba(181,122,82,0.15)'} />
      </View>

      <View style={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.kicker}>Interior Plant Design</Text>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Planterior AI</Text>
          <Text style={styles.subtitle}>
            Transform your rooms with elegant, realistic plant styling in minutes.
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          {Platform.OS === 'android' && (
            <TouchableOpacity
              style={[styles.button, styles.googleButton]}
              onPress={signInWithGoogle}
              disabled={isLoading}
            >
              <AppIcon name="GoogleLogo" size={20} color="#4285F4" />
              <Text style={styles.buttonText}>Continue with Google</Text>
            </TouchableOpacity>
          )}

          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.button, styles.appleButton]}
              onPress={signInWithApple}
              disabled={isLoading}
            >
              <AppIcon
                name="AppleLogo"
                size={20}
                color={theme.isDark ? '#000000' : '#ffffff'}
              />
              <Text style={[styles.buttonText, styles.appleButtonText]}>
                Continue with Apple
              </Text>
            </TouchableOpacity>
          )}

          {/* {showBypass && (
            <TouchableOpacity
              style={[styles.button, styles.bypassButton]}
              onPress={signInBypass}
              disabled={isLoading}
            >
              <AppIcon name="BugBeetle" size={20} color="#ffffff" />
              <Text style={[styles.buttonText, styles.bypassButtonText]}>
                Dev Bypass Login
              </Text>
            </TouchableOpacity>
          )} */}
        </View>

        <Text style={styles.disclaimer}>
          By continuing, you agree to our{' '}
          <Text
            style={styles.disclaimerLink}
            onPress={() => openExternalLink('https://planterior.app/terms')}
          >
            Terms of Service
          </Text>{' '}
          and{' '}
          <Text
            style={styles.disclaimerLink}
            onPress={() => openExternalLink('https://planterior.app/privacy')}
          >
            Privacy Policy
          </Text>
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
  bgBlobA: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: theme.isDark ? 'rgba(86,194,138,0.14)' : 'rgba(78,107,87,0.12)',
    top: -110,
    left: -100,
  },
  bgBlobB: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: theme.isDark ? 'rgba(181,122,82,0.13)' : 'rgba(181,122,82,0.1)',
    bottom: -130,
    right: -110,
  },
  bgLeafOne: {
    position: 'absolute',
    top: 80,
    right: 16,
    transform: [{ rotate: '-15deg' }],
  },
  bgLeafTwo: {
    position: 'absolute',
    bottom: 80,
    left: 12,
    transform: [{ rotate: '14deg' }],
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  headerCard: {
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: theme.isDark ? 0.28 : 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  logo: {
    width: 108,
    height: 108,
    marginBottom: 18,
  },
  title: {
    fontSize: 38,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 10,
    fontFamily: 'serif',
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 23,
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 28,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  googleButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  appleButton: {
    backgroundColor: theme.isDark ? '#ffffff' : '#000000',
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: theme.isDark ? 0.2 : 0.14,
    shadowRadius: 10,
    elevation: 3,
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
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 6,
  },
  disclaimerLink: {
    color: theme.colors.primary,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});
