import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../components/AppIcon';
import { useNetworkGuard } from '../contexts/NetworkContext';
import { useAuth } from '../contexts/AuthContext';
import { useTabBar } from '../contexts/TabBarContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useDebugPreferences } from '../contexts/DebugPreferencesContext';
import { firestoreSyncService } from '../services/firestoreSyncService';

interface AccountScreenProps {
  onUpgradePress?: () => void;
  presentation?: 'full' | 'sheet';
  onClose?: () => void;
}

export const AccountScreen: React.FC<AccountScreenProps> = ({
  onUpgradePress,
  presentation = 'full',
  onClose,
}) => {
  const { user, signOut } = useAuth();
  const requireNetwork = useNetworkGuard();
  const { handleScroll, tabBarHeight } = useTabBar();
  const { theme } = useTheme();
  const {
    subscription,
    freeGenerationsRemaining,
    usageStats,
    restorePurchases,
    resetUsageForTesting,
  } = useSubscription();
  const { suppressFreePlanWarnings } = useDebugPreferences();
  const styles = createStyles(theme);
  const showPaidLayout = subscription?.isActive || suppressFreePlanWarnings;
  const hasCloudSyncAccess = subscription?.isActive === true;
  const isSheetPresentation = presentation === 'sheet';

  const [isRestoring, setRestoring] = React.useState(false);
  const [isSyncingLibrary, setSyncingLibrary] = React.useState(false);

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
    if (!requireNetwork('Please connect to the internet to restore purchases.')) {
      return;
    }
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

  const runSyncNow = async () => {
    if (!user) return;
    if (!hasCloudSyncAccess) {
      Alert.alert('Monthly plan required', 'Cloud backup is available with the monthly plan.');
      return;
    }
    setSyncingLibrary(true);
    try {
      const result = await firestoreSyncService.syncUserData(user);
      Alert.alert('Sync complete', `Synced ${result.designs} design(s) and ${result.collections} collection(s).`);
    } catch (error) {
      console.error('Failed to sync library:', error);
      Alert.alert('Sync failed', 'Could not sync your library right now.');
    } finally {
      setSyncingLibrary(false);
    }
  };

  const runRestoreNow = async () => {
    if (!user) return;
    if (!hasCloudSyncAccess) {
      Alert.alert('Monthly plan required', 'Cloud restore is available with the monthly plan.');
      return;
    }
    setSyncingLibrary(true);
    try {
      const result = await firestoreSyncService.restoreUserData(user.id);
      Alert.alert('Restore complete', `Restored ${result.designs} design(s) and ${result.collections} collection(s).`);
    } catch (error) {
      console.error('Failed to restore library:', error);
      Alert.alert('Restore failed', 'Could not restore your library right now.');
    } finally {
      setSyncingLibrary(false);
    }
  };

  const handleCloudSync = () => {
    if (!hasCloudSyncAccess) {
      Alert.alert(
        'Cloud Backup',
        'Your designs are saved on this device. Cloud backup and restore are included with the monthly plan.',
        [
          { text: 'View Monthly Plan', onPress: handleUpgrade },
          { text: 'Not Now', style: 'cancel' },
        ]
      );
      return;
    }

    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to sync your library.');
      return;
    }

    Alert.alert('Cloud Sync', 'Choose an option', [
      {
        text: 'Sync Now',
        onPress: async () => {
          if (!requireNetwork('Please connect to the internet to sync your library.')) {
            return;
          }

          try {
            const preflight = await firestoreSyncService.getSyncPreflight(user.id);
            if (preflight.hasPotentialMergeRisk) {
              Alert.alert(
                'Potential duplicate risk',
                `This device has ${preflight.localUnsyncedDesigns} unsynced design(s) and ${preflight.localUnsyncedCollections} unsynced collection(s), while your cloud library already has ${preflight.remoteDesigns} design(s) and ${preflight.remoteCollections} collection(s).\n\nTo avoid duplicates, restoring first is usually safer.`,
                [
                  {
                    text: 'Restore First',
                    onPress: async () => {
                      if (!requireNetwork('Please connect to the internet to restore your library.')) {
                        return;
                      }
                      await runRestoreNow();
                    },
                  },
                  {
                    text: 'Merge Anyway',
                    style: 'destructive',
                    onPress: async () => {
                      if (!requireNetwork('Please connect to the internet to sync your library.')) {
                        return;
                      }
                      await runSyncNow();
                    },
                  },
                  { text: 'Cancel', style: 'cancel' },
                ]
              );
              return;
            }

            await runSyncNow();
          } catch (error) {
            console.error('Failed to run sync preflight:', error);
            Alert.alert('Sync unavailable', 'Could not check sync safety right now.');
          }
        },
      },
      {
        text: 'Restore from Cloud',
        onPress: async () => {
          if (!requireNetwork('Please connect to the internet to restore your library.')) {
            return;
          }
          await runRestoreNow();
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
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

  const openExternalLink = async (url: string) => {
    if (!requireNetwork('Please connect to the internet to view this link.')) {
      return;
    }
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

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <SafeAreaView
      edges={isSheetPresentation ? ['top', 'right', 'bottom'] : ['top', 'right', 'bottom', 'left']}
      style={styles.container}
    >
      <View style={styles.backdropBlobA} />
      <View style={styles.backdropBlobB} />
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: isSheetPresentation ? 24 : tabBarHeight + 20 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Account</Text>
              <Text style={styles.subtitle}>Your plan, profile, and preferences</Text>
            </View>
            {isSheetPresentation && onClose ? (
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close account"
              >
                <AppIcon name="X" size={20} color={theme.colors.text} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={styles.userSection}>
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              {user?.picture ? (
                <Image source={{ uri: user.picture }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <AppIcon
                    name={user?.provider === 'apple' ? 'AppleLogo' : 'GoogleLogo'}
                    size={30}
                    color={theme.colors.text}
                  />
                </View>
              )}
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
            <Text style={styles.sectionTitle}>Subscriptions</Text>
          </View>

          {showPaidLayout ? (
            <View style={styles.subscriptionCard}>
              <View style={styles.premiumBadge}>
                <AppIcon name="CheckCircle" size={20} color={theme.colors.primary} />
                <Text style={styles.premiumBadgeText}>
                  {subscription?.isActive ? 'Premium Member' : 'Premium Preview'}
                </Text>
              </View>
              <Text style={styles.subscriptionType}>
                {subscription?.isActive
                  ? (subscription.type === 'annual' ? 'Legacy Annual Plan' : 'Monthly Plan — 30 designs')
                  : 'Debug Layout Preview'}
              </Text>
              {subscription?.isActive ? (
                <Text style={styles.expiryText}>
                  {freeGenerationsRemaining} design credits available
                </Text>
              ) : null}
              {subscription?.isActive && subscription.expiryDate && (
                <Text style={styles.expiryText}>
                  Renews: {formatDate(subscription.expiryDate)}
                </Text>
              )}
              {subscription?.isMock && __DEV__ && (
                <View style={styles.mockBadge}>
                  <Text style={styles.mockBadgeText}>MOCK SUBSCRIPTION</Text>
                </View>
              )}
              {subscription?.isActive ? (
                <TouchableOpacity
                  style={styles.manageButton}
                  onPress={handleManageSubscription}
                >
                  <Text style={styles.manageButtonText}>Manage Subscription</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.expiryText}>
                  Free-plan warnings are hidden in debug mode.
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.subscriptionCard}>
              <Text style={styles.freePlanText}>Free Plan</Text>
              <Text style={styles.freePlanDetails}>
                {freeGenerationsRemaining} design credits available
              </Text>
              <TouchableOpacity
                style={styles.upgradeButton}
                onPress={handleUpgrade}
              >
                <Text style={styles.upgradeButtonText}>See Plans &amp; Credits</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Usage Statistics Card */}
        {usageStats && (
          <View style={styles.usageSection}>
            <View style={styles.sectionHeader}>
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
                <Text style={styles.usageStatLabel}>Paid Used</Text>
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

        <View style={styles.syncSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Cloud Backup</Text>
          </View>
          <View style={styles.syncCard}>
            <Text style={styles.syncDescription}>
              {hasCloudSyncAccess
                ? 'When you choose, sync locally saved designs and collections to your account or restore them on this device.'
                : 'Designs are saved locally on this device. Cloud backup and restore are available with the monthly plan.'}
            </Text>
            <TouchableOpacity
              style={[styles.syncButton, isSyncingLibrary && styles.syncButtonDisabled]}
              onPress={handleCloudSync}
              disabled={isSyncingLibrary}
            >
              {isSyncingLibrary ? (
                <ActivityIndicator color={theme.colors.surface} />
              ) : (
                <>
                  <AppIcon
                    name={hasCloudSyncAccess ? "ArrowCircleUp" : "Lock"}
                    size={20}
                    color={theme.colors.surface}
                  />
                  <Text style={styles.syncButtonText}>
                    {hasCloudSyncAccess ? 'Sync / Restore Library' : 'View Monthly Plan'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.menuSection}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => openExternalLink('https://planterior.app/contact')}
          >
            <AppIcon name="Question" size={24} color={theme.colors.text} />
            <Text style={styles.menuText}>Support</Text>
            <AppIcon name="CaretRight" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemLast]}
            onPress={() => openExternalLink('https://planterior.app/privacy')}
          >
            <AppIcon name="FileText" size={24} color={theme.colors.text} />
            <Text style={styles.menuText}>Privacy Policy</Text>
            <AppIcon name="CaretRight" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.logoutSection}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <AppIcon name="SignOut" size={24} color="#dc2626" />
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
  backdropBlobA: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: theme.isDark ? 'rgba(143,179,154,0.1)' : 'rgba(78,107,87,0.1)',
    top: -90,
    left: -70,
  },
  backdropBlobB: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: theme.isDark ? 'rgba(181,122,82,0.08)' : 'rgba(181,122,82,0.08)',
    bottom: -130,
    right: -80,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    marginTop: 8,
    marginBottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: 0.2,
    fontFamily: 'serif',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  userSection: {
    backgroundColor: theme.colors.surface,
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: theme.isDark ? 0.22 : 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: theme.isDark ? 0.28 : 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : '#f6f7f5',
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: theme.isDark ? 0.22 : 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
    marginLeft: 16,
  },
  logoutSection: {
    marginTop: 28,
    paddingHorizontal: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f8b4b4',
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: theme.isDark ? 0.22 : 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: 0.2,
  },
  subscriptionCard: {
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.borderLight,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
    backgroundColor: theme.colors.surface,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: theme.isDark ? 0.25 : 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  upgradeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.surface,
  },
  syncSection: {
    backgroundColor: theme.colors.surface,
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: theme.isDark ? 0.22 : 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  syncCard: {
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.borderLight,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  syncDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
  },
  syncButtonDisabled: {
    opacity: 0.7,
  },
  syncButtonText: {
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: theme.isDark ? 0.22 : 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  usageCard: {
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.borderLight,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
