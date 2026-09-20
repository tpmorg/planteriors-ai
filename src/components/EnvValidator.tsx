import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from './AppIcon';
import { AppButton } from './AppButton';
import { useTheme } from '../contexts/ThemeContext';
import type { Theme } from '../contexts/ThemeContext';
import { env } from '../utils/env';

interface EnvValidatorProps {
  children: React.ReactNode;
}

export const EnvValidator: React.FC<EnvValidatorProps> = ({ children }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [missingVars, setMissingVars] = useState<string[]>([]);

  useEffect(() => {
    validateEnvironment();
  }, []);

  const validateEnvironment = () => {
    try {
      const validation = env.validateConfig();
      setIsValid(validation.isValid);
      setMissingVars(validation.missingVars);

      if (!validation.isValid) {
        console.warn('Missing environment variables:', validation.missingVars);
      }
    } catch (error) {
      console.error('Environment validation error:', error);
      setIsValid(false);
      setMissingVars(['CONFIGURATION_ERROR']);
    }
  };

  const showSetupInstructions = () => {
    Alert.alert(
      'Environment Setup Required',
      `Missing required environment variables:\n\n${missingVars.join('\n')}\n\nPlease check your app.json configuration and ensure all required API keys are set.`,
      [
        {
          text: 'Retry',
          onPress: validateEnvironment,
        },
        {
          text: 'Continue Anyway',
          onPress: () => setIsValid(true),
          style: 'destructive',
        },
      ]
    );
  };

  if (isValid === null) {
    // Loading state
    return (
      <SafeAreaView style={styles.container}>
        <AppIcon name="Gear" size={48} color={theme.colors.primary} />
        <Text style={styles.loadingText}>Validating configuration...</Text>
      </SafeAreaView>
    );
  }

  if (!isValid) {
    // Error state
    return (
      <SafeAreaView style={styles.container}>
        <AppIcon name="WarningCircle" size={48} color={theme.colors.destructive} />
        <Text style={styles.errorTitle}>Configuration Required</Text>
        <Text style={styles.errorText}>
          Some environment variables are missing. The app may not function correctly.
        </Text>

        <View style={styles.missingVarsList}>
          {missingVars.map((varName) => (
            <Text key={varName} style={styles.missingVar}>
              • {varName}
            </Text>
          ))}
        </View>

        <AppButton
          variant="primary"
          size="md"
          icon="Info"
          title="Setup Instructions"
          onPress={showSetupInstructions}
          accessibilityHint="Shows which environment variables are missing"
          style={styles.setupButton}
        />

        <AppButton
          variant="ghost"
          size="sm"
          title="Continue Anyway"
          onPress={() => setIsValid(true)}
          style={styles.continueButton}
        />
      </SafeAreaView>
    );
  }

  // Valid configuration - render children
  return <>{children}</>;
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
      backgroundColor: theme.colors.background,
    },
    loadingText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginTop: 16,
    },
    errorTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.destructive,
      marginTop: 16,
      marginBottom: 8,
    },
    errorText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 24,
    },
    missingVarsList: {
      backgroundColor: theme.colors.destructiveSurface,
      borderWidth: 1,
      borderColor: theme.colors.destructiveBorder,
      padding: 16,
      borderRadius: 12,
      marginBottom: 24,
      alignSelf: 'stretch',
    },
    missingVar: {
      fontSize: 14,
      color: theme.colors.destructive,
      marginBottom: 4,
      fontFamily: 'monospace',
    },
    setupButton: {
      marginBottom: 16,
      minWidth: 232,
    },
    continueButton: {
      minWidth: 160,
    },
  });
