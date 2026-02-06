import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AppIcon } from './AppIcon';
import { useTheme } from '../contexts/ThemeContext';

interface UsageIndicatorProps {
  freeRemaining: number;
  isSubscribed: boolean;
  variant?: 'compact' | 'full';
  onUpgradePress?: () => void;
}

export const UsageIndicator: React.FC<UsageIndicatorProps> = ({
  freeRemaining,
  isSubscribed,
  variant = 'full',
  onUpgradePress,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  if (isSubscribed) {
    return (
      <View style={[styles.container, variant === 'compact' && styles.containerCompact]}>
        <View style={styles.premiumBadge}>
          <AppIcon name="StarFour" size={16} color={theme.colors.primary} />
          <Text style={styles.premiumText}>Premium Member</Text>
        </View>
        {variant === 'full' && (
          <Text style={styles.subtitleText}>Unlimited generations</Text>
        )}
      </View>
    );
  }

  if (variant === 'compact') {
    return (
      <View style={[styles.container, styles.containerCompact]}>
        <AppIcon name="Leaf" size={16} color={theme.colors.primary} />
        <Text style={styles.compactText}>
          {freeRemaining} of 5 free remaining
        </Text>
      </View>
    );
  }

  // Full variant for free plan
  const progressPercentage = (freeRemaining / 5) * 100;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.planName}>Free Plan</Text>
        {freeRemaining === 0 && (
          <View style={styles.limitBadge}>
            <Text style={styles.limitBadgeText}>Limit Reached</Text>
          </View>
        )}
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${progressPercentage}%` },
              freeRemaining === 0 && styles.progressEmpty,
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {freeRemaining} of 5 remaining
        </Text>
      </View>

      {onUpgradePress && (
        <TouchableOpacity style={styles.upgradeButton} onPress={onUpgradePress}>
          <AppIcon name="ArrowCircleUp" size={18} color={theme.colors.surface} />
          <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
        </TouchableOpacity>
      )}

      {freeRemaining === 0 && !onUpgradePress && (
        <Text style={styles.warningText}>
          You've used all your free generations. Upgrade to continue creating designs.
        </Text>
      )}
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      marginHorizontal: 16,
      marginVertical: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    containerCompact: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 10,
      marginHorizontal: 0,
      marginVertical: 0,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    planName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    premiumBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.isDark ? theme.colors.surface : '#f0fdf4',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    premiumText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    subtitleText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 4,
    },
    limitBadge: {
      backgroundColor: theme.isDark ? '#7f1d1d' : '#fee2e2',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    limitBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.isDark ? '#fca5a5' : '#991b1b',
    },
    progressContainer: {
      gap: 8,
    },
    progressBar: {
      height: 8,
      backgroundColor: theme.isDark ? theme.colors.border : theme.colors.borderLight,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.colors.primary,
      borderRadius: 4,
    },
    progressEmpty: {
      backgroundColor: theme.isDark ? '#7f1d1d' : '#f87171',
    },
    progressText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    compactText: {
      fontSize: 13,
      color: theme.colors.text,
      fontWeight: '500',
    },
    upgradeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      marginTop: 12,
    },
    upgradeButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.surface,
    },
    warningText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 8,
      textAlign: 'center',
      lineHeight: 18,
    },
  });
