import React, { Component, ErrorInfo, ReactNode, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';

import { AppButton } from './AppButton';
import { useTheme } from '../contexts/ThemeContext';
import type { Theme } from '../contexts/ThemeContext';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

interface FallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onRestart: () => void;
}

/**
 * Functional fallback so the crash screen can use the shared button system and
 * the active theme. `ErrorBoundary` stays a class because that is the only
 * component type React lets you use as an error boundary.
 */
const ErrorFallback: React.FC<FallbackProps> = ({ error, errorInfo, onRestart }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.subtitle}>
          The app encountered an unexpected error. Please try again.
        </Text>

        {__DEV__ && error && (
          <ScrollView style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Error Details:</Text>
            <Text style={styles.errorText}>{error.toString()}</Text>
            {errorInfo && <Text style={styles.stackTrace}>{errorInfo.componentStack}</Text>}
          </ScrollView>
        )}

        <AppButton
          variant="primary"
          size="lg"
          icon="ArrowClockwise"
          title="Try Again"
          onPress={onRestart}
          accessibilityHint="Reloads the app interface"
          style={styles.retryButton}
        />
      </View>
    </SafeAreaView>
  );
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    Sentry.withScope((scope) => {
      scope.setContext('react_error_boundary', {
        componentStack: errorInfo.componentStack,
      });
      Sentry.captureException(error);
    });
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRestart = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRestart={this.handleRestart}
        />
      );
    }

    return this.props.children;
  }
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 24,
    },
    errorContainer: {
      maxHeight: 200,
      width: '100%',
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      padding: 12,
      marginBottom: 24,
    },
    errorTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.destructive,
      marginBottom: 8,
    },
    errorText: {
      fontSize: 12,
      color: theme.colors.destructive,
      fontFamily: 'monospace',
    },
    stackTrace: {
      fontSize: 10,
      color: theme.colors.textSecondary,
      fontFamily: 'monospace',
      marginTop: 8,
    },
    retryButton: {
      minWidth: 200,
    },
  });
