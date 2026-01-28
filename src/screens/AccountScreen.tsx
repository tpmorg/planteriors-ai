import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTabBar } from '../contexts/TabBarContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSubscription } from '../contexts/SubscriptionContext';

interface AccountScreenProps {
  onUpgradePress?: () => void;
}

export const AccountScreen: React.FC<AccountScreenProps> = ({ onUpgradePress }) => {
  const { user, signOut } = useAuth();
  const { handleScroll, tabBarHeight } = useTabBar();
  const { theme } = useTheme();
  const {
    subscription,
    freeGenerationsRemaining,
    usageStats,
    restorePurchases,
    resetUsageForTesting,
  } = useSubscription();
  const styles = createStyles(theme);

  const [isRestoring, setRestoring] = React.useState(false);

  const handleLogout = () => {
    signOut();
  };

  const handleUpgrade = () => {
    if (onUpgradePress) {
      onUpgradePress();
    }
  };

  const handleManageSubscription = () => {
    Alert.alert('Manage Subscription', 'Choose an option', [
      {
        text: 'Restore Purchases',
        onPress: handleRestorePurchases,
      },
      {
        text: 'Cancel Subscription',
        onPress: () => Alert.alert('Info', 'To cancel, please visit your app store settings'),
        style: 'destructive',
      },
      { text: 'Close', style: 'cancel' },
    ]);
  };

  const handleRestorePurchases = async () => {
    setRestoring(true);
    try {
      const result = await restorePurchases();
      if (result.success && result.restored > 0) {
        Alert.alert('Success', `Restored ${result.restored} purchase(s)`);
      } else if (result.success) {
        Alert.alert('No Purchases', 'No previous purchases found');
      } else {
        Alert.alert('Error', result.error || 'Failed to restore purchases');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to restore purchases');
    } finally {
      setRestoring(false);
    }
  };

  const handleResetUsage = () => {
    if (__DEV__) {
      Alert.alert('Reset Usage', 'Reset your free generation count for testing?', [
        {
          text: 'Reset',
          onPress: async () => {
            await resetUsageForTesting();
            Alert.alert('Success', 'Usage has been reset');
          },
          style: 'destructive',
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 20 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Account</Text>
        </View>

        <View style={styles.userSection}>
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={40} color={theme.colors.primary} />
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName}>
                {user?.name || 'Guest User'}
              </Text>
              <Text style={styles.userEmail}>
                {user?.email || 'guest@example.com'}
              </Text>
            </View>
          </View>
        </View>

        {/* Subscription Status Card */}
        <View style={styles.subscriptionSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="sparkles" size={20} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Subscription</Text>
          </View>

          {subscription?.isActive ? (
            <View style={styles.subscriptionCard}>
              <View style={styles.premiumBadge}>
                <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                <Text style={styles.premiumBadgeText}>Premium Member</Text>
              </View>
              <Text style={styles.subscriptionType}>
                {subscription.type === 'annual' ? 'Annual Plan' : 'Monthly Plan'}
              </Text>
              {subscription.expiryDate && (
                <Text style={styles.expiryText}>
                  Renews: {formatDate(subscription.expiryDate)}
                </Text>
              )}
              {subscription.isMock && __DEV__ && (
                <View style={styles.mockBadge}>
                  <Text style={styles.mockBadgeText}>MOCK SUBSCRIPTION</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.manageButton}
                onPress={handleManageSubscription}
              >
                <Text style={styles.manageButtonText}>Manage Subscription</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.subscriptionCard}>
              <Text style={styles.freePlanText}>Free Plan</Text>
              <Text style={styles.freePlanDetails}>
                {freeGenerationsRemaining} of 5 free generations remaining
              </Text>
              <TouchableOpacity
                style={styles.upgradeButton}
                onPress={handleUpgrade}
              >
                <Ionicons name="arrow-up-circle" size={20} color="white" />
                <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Usage Statistics Card */}
        {usageStats && (
          <View style={styles.usageSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="stats-chart" size={20} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>Usage Statistics</Text>
            </View>
            <View style={styles.usageCard}>
              <View style={styles.usageStat}>
                <Text style={styles.usageStatLabel}>Total Generations</Text>
                <Text style={styles.usageStatValue}>{usageStats.totalGenerations}</Text>
              </View>
              <View style={styles.usageStat}>
                <Text style={styles.usageStatLabel}>Free Used</Text>
                <Text style={styles.usageStatValue}>{usageStats.freeUsed}</Text>
              </View>
              <View style={styles.usageStat}>
                <Text style={styles.usageStatLabel}>Premium Used</Text>
                <Text style={styles.usageStatValue}>{usageStats.paidUsed}</Text>
              </View>
              {__DEV__ && (
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={handleResetUsage}
                >
                  <Text style={styles.resetButtonText}>Reset Usage (Dev)</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="heart-outline" size={24} color={theme.colors.text} />
            <Text style={styles.menuText}>Favorites</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="download-outline" size={24} color={theme.colors.text} />
            <Text style={styles.menuText}>Downloads</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="share-outline" size={24} color={theme.colors.text} />
            <Text style={styles.menuText}>Share App</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="help-circle-outline" size={24} color={theme.colors.text} />
            <Text style={styles.menuText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.logoutSection}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#dc2626" />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  userSection: {
    backgroundColor: theme.colors.surface,
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  menuSection: {
    backgroundColor: theme.colors.surface,
    marginTop: 20,
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
    marginLeft: 16,
  },
  logoutSection: {
    marginTop: 40,
    paddingHorizontal: 20,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
    marginLeft: 8,
  },
  // Subscription Section Styles
  subscriptionSection: {
    backgroundColor: theme.colors.surface,
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  subscriptionCard: {
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.borderLight,
    borderRadius: 12,
    padding: 16,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  premiumBadgeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  subscriptionType: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  expiryText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 12,
  },
  mockBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  mockBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#92400e',
  },
  manageButton: {
    backgroundColor: theme.colors.border,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  manageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  freePlanText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  freePlanDetails: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 12,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
  },
  upgradeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.surface,
  },
  // Usage Section Styles
  usageSection: {
    backgroundColor: theme.colors.surface,
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  usageCard: {
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.borderLight,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  usageStat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  usageStatLabel: {
    fontSize: 15,
    color: theme.colors.text,
  },
  usageStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  resetButton: {
    backgroundColor: '#fef3c7',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  resetButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400e',
  },
});