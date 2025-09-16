import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { env } from '../utils/env';

interface EnvValidatorProps {
  children: React.ReactNode;
}

export const EnvValidator: React.FC<EnvValidatorProps> = ({ children }) => {
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
      <View style={styles.container}>
        <Ionicons name="settings" size={48} color="#2d5016" />
        <Text style={styles.loadingText}>Validating configuration...</Text>
      </View>
    );
  }

  if (!isValid) {
    // Error state
    return (
      <View style={styles.container}>
        <Ionicons name="warning" size={48} color="#dc2626" />
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

        <TouchableOpacity style={styles.setupButton} onPress={showSetupInstructions}>
          <Ionicons name="information-circle" size={20} color="white" />
          <Text style={styles.setupButtonText}>Setup Instructions</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.continueButton} onPress={() => setIsValid(true)}>
          <Text style={styles.continueButtonText}>Continue Anyway</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Valid configuration - render children
  return <>{children}</>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#dc2626',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  missingVarsList: {
    backgroundColor: '#fee2e2',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    alignSelf: 'stretch',
  },
  missingVar: {
    fontSize: 14,
    color: '#dc2626',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  setupButton: {
    backgroundColor: '#2d5016',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  setupButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  continueButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  continueButtonText: {
    color: '#6b7280',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});