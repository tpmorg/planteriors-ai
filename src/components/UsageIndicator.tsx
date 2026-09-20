import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppIcon } from './AppIcon';
import { AppButton } from './AppButton';
import { useTheme } from '../contexts/ThemeContext';
import { useDebugPreferences } from '../contexts/DebugPreferencesContext';

interface UsageIndicatorProps {
  freeRemaining: number;
  isFreeTier: boolean;
  userId?: string;
  variant?: 'compact' | 'full';
  onUpgradePress?: () => void;
}

const TOKEN_BANNER_SEEN_KEY = '@planterior_token_banner_seen';

export const UsageIndicator: React.FC<UsageIndicatorProps> = ({
  freeRemaining,
  isFreeTier,
  userId,
  variant = 'full',
  onUpgradePress,
}) => {
  const { theme } = useTheme();
  const { suppressFreePlanWarnings } = useDebugPreferences();
  const [hasLoadedBannerState, setHasLoadedBannerState] = useState(false);
  const [hasSeenBanner, setHasSeenBanner] = useState(true);
  const styles = createStyles(theme);
  const bannerSeenKey = userId ? `${TOKEN_BANNER_SEEN_KEY}:${userId}` : null;

  useEffect(() => {
    let cancelled = false;

    const loadBannerState = async () => {
      if (!isFreeTier || !bannerSeenKey || suppressFreePlanWarnings) {
        if (!cancelled) {
          setHasSeenBanner(true);
          setHasLoadedBannerState(true);
        }
        return;
      }

      try {
        const seen = await AsyncStorage.getItem(bannerSeenKey);
        if (cancelled) return;
        setHasSeenBanner(seen === 'true');
        setHasLoadedBannerState(true);
        if (seen !== 'true') await AsyncStorage.setItem(bannerSeenKey, 'true');
      } catch (error) {
        console.warn('Unable to load token banner state:', error);
        if (!cancelled) {
          setHasSeenBanner(true);
          setHasLoadedBannerState(true);
        }
      }
    };

    setHasLoadedBannerState(false);
    void loadBannerState();
    return () => {
      cancelled = true;
    };
  }, [bannerSeenKey, isFreeTier, suppressFreePlanWarnings]);

  if (!isFreeTier || suppressFreePlanWarnings || !hasLoadedBannerState || hasSeenBanner) {
    return null;
  }

  if (variant === 'compact') {
    return (
      <View style={[styles.container, styles.containerCompact]}>
        <AppIcon name="Leaf" size={16} color={theme.colors.primary} />
        <Text style={styles.compactText}>
          {freeRemaining} design credits
        </Text>
      </View>
    );
  }

  // Full variant for free plan
  const hasReachedLimit = freeRemaining === 0;
  const showUpgradeCta = Boolean(onUpgradePress);

  return (
    <View style={[styles.container, hasReachedLimit && styles.limitContainer]}>
      <AppButton
        variant="icon"
        size="sm"
        icon="X"
        iconWeight="bold"
        style={styles.dismissButton}
        onPress={() => setHasSeenBanner(true)}
        accessibilityLabel="Dismiss free plan banner"
      />

      <View style={styles.header}>
        <Text style={[styles.planName, hasReachedLimit && styles.limitPlanName]}>
          {hasReachedLimit ? 'No Design Credits' : 'Design Credits'}
        </Text>
        {hasReachedLimit && (
          <View style={styles.limitBadge}>
            <Text style={styles.limitBadgeText}>Limit Reached</Text>
          </View>
        )}
      </View>

      <Text style={styles.planSummary}>
        Each room design uses one credit. Add 30 monthly or buy a 20-design pack that never expires.
      </Text>

      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          {freeRemaining} credits available
        </Text>
      </View>

      {hasReachedLimit && (
        <Text style={styles.limitMessage}>
          You have used all free generations. Choose a monthly plan or a one-time Room Pack to continue.
        </Text>
      )}

      {showUpgradeCta && onUpgradePress && (
        <View style={[styles.upgradeCtaWrap, hasReachedLimit && styles.limitCtaWrap]}>
          <AppButton
            variant="primary"
            size={hasReachedLimit ? 'lg' : 'md'}
            icon={hasReachedLimit ? 'LockKeyOpen' : 'ArrowCircleUp'}
            title={hasReachedLimit ? 'View Design Options' : 'View Options'}
            onPress={onUpgradePress}
            accessibilityLabel={hasReachedLimit ? 'View design purchase options' : 'View design options'}
            style={styles.upgradeButton}
          />
        </View>
      )}

      {hasReachedLimit && !onUpgradePress && (
        <Text style={styles.warningText}>
          You've used all your free generations. Choose a monthly plan or Room Pack to continue.
        </Text>
      )}
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: 18,
      paddingTop: 22,
      paddingBottom: 20,
      paddingHorizontal: 18,
      marginHorizontal: 16,
      marginVertical: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      position: 'relative',
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
      marginBottom: 10,
      paddingRight: 44,
    },
    planName: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
    },
    limitPlanName: {
      fontSize: 22,
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
    planSummary: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 21,
      marginBottom: 16,
    },
    progressContainer: {
      gap: 10,
    },
    progressBar: {
      height: 10,
      backgroundColor: theme.isDark ? theme.colors.border : theme.colors.borderLight,
      borderRadius: 999,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.colors.primary,
      borderRadius: 999,
    },
    progressEmpty: {
      backgroundColor: theme.isDark ? '#7f1d1d' : '#f87171',
    },
    progressText: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      fontWeight: '600',
    },
    limitMessage: {
      fontSize: 14,
      color: theme.colors.text,
      lineHeight: 21,
      marginTop: 14,
    },
    compactText: {
      fontSize: 13,
      color: theme.colors.text,
      fontWeight: '500',
    },
    upgradeButton: {
      marginTop: 6,
    },
    upgradeCtaWrap: {
      marginTop: 6,
    },
    limitCtaWrap: {
      marginTop: 14,
    },
    dismissButton: {
      position: 'absolute',
      top: 14,
      right: 14,
      zIndex: 1,
    },
    warningText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 8,
      textAlign: 'center',
      lineHeight: 18,
    },
  });
