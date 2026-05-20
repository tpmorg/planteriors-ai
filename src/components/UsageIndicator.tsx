import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AppIcon } from './AppIcon';
import { useTheme } from '../contexts/ThemeContext';
import { FREE_GENERATION_LIMIT } from '../services/usageTrackingService';
import { useDebugPreferences } from '../contexts/DebugPreferencesContext';

interface UsageIndicatorProps {
  freeRemaining: number;
  isSubscribed: boolean;
  variant?: 'compact' | 'full';
  onUpgradePress?: () => void;
}

let isUpgradeCtaDismissedForSession = false;

export const UsageIndicator: React.FC<UsageIndicatorProps> = ({
  freeRemaining,
  isSubscribed,
  variant = 'full',
  onUpgradePress,
}) => {
  const { theme } = useTheme();
  const { suppressFreePlanWarnings } = useDebugPreferences();
  const [isUpgradeCtaDismissed, setIsUpgradeCtaDismissed] = useState(
    isUpgradeCtaDismissedForSession
  );
  const styles = createStyles(theme);
  const showPaidLayout = isSubscribed || suppressFreePlanWarnings;

  if (showPaidLayout) {
    return null;
  }

  if (variant === 'compact') {
    return (
      <View style={[styles.container, styles.containerCompact]}>
        <AppIcon name="Leaf" size={16} color={theme.colors.primary} />
        <Text style={styles.compactText}>
          {freeRemaining} of {FREE_GENERATION_LIMIT} free remaining
        </Text>
      </View>
    );
  }

  // Full variant for free plan
  const progressPercentage = (freeRemaining / FREE_GENERATION_LIMIT) * 100;
  const hasReachedLimit = freeRemaining === 0;
  const showUpgradeCta = Boolean(onUpgradePress) && (hasReachedLimit || !isUpgradeCtaDismissed);

  return (
    <View style={[styles.container, hasReachedLimit && styles.limitContainer]}>
      <View style={styles.header}>
        <Text style={[styles.planName, hasReachedLimit && styles.limitPlanName]}>
          {hasReachedLimit ? 'Free Trial Complete' : 'Free Plan'}
        </Text>
        {hasReachedLimit && (
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
          {freeRemaining} of {FREE_GENERATION_LIMIT} remaining
        </Text>
      </View>

      {hasReachedLimit && (
        <Text style={styles.limitMessage}>
          Subscribe to keep generating plant designs. Premium unlocks unlimited creations, priority processing, and HD exports.
        </Text>
      )}

      {showUpgradeCta && onUpgradePress && (
        <View style={[styles.upgradeCtaWrap, hasReachedLimit && styles.limitCtaWrap]}>
          {!hasReachedLimit && (
            <TouchableOpacity style={styles.dismissButton} onPress={() => {
              isUpgradeCtaDismissedForSession = true;
              setIsUpgradeCtaDismissed(true);
            }}>
              <AppIcon name="X" size={14} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.upgradeButton, hasReachedLimit && styles.limitUpgradeButton]}
            onPress={onUpgradePress}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={hasReachedLimit ? 'Subscribe to continue creating designs' : 'Upgrade to Premium'}
          >
            <AppIcon name={hasReachedLimit ? 'LockKeyOpen' : 'ArrowCircleUp'} size={18} color={theme.colors.surface} />
            <Text style={styles.upgradeButtonText}>
              {hasReachedLimit ? 'Subscribe to Continue' : 'Upgrade to Premium'}
            </Text>
            {hasReachedLimit && (
              <AppIcon name="ArrowRight" size={18} color={theme.colors.surface} />
            )}
          </TouchableOpacity>
        </View>
      )}

      {hasReachedLimit && !onUpgradePress && (
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
    limitContainer: {
      borderColor: theme.colors.primary,
      borderWidth: 2,
      backgroundColor: theme.isDark ? theme.colors.surface : '#f8fbf6',
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 4,
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
    limitPlanName: {
      fontSize: 19,
      fontWeight: '700',
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
    limitMessage: {
      fontSize: 14,
      color: theme.colors.text,
      lineHeight: 20,
      marginTop: 12,
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
      marginTop: 6,
    },
    limitUpgradeButton: {
      paddingVertical: 15,
      borderRadius: 10,
      marginTop: 0,
    },
    upgradeCtaWrap: {
      marginTop: 6,
    },
    limitCtaWrap: {
      marginTop: 14,
    },
    dismissButton: {
      alignSelf: 'flex-end',
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 6,
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
