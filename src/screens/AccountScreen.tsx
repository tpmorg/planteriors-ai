import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Linking,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../components/AppButton';
import { AppIcon } from '../components/AppIcon';
import { useNetworkGuard } from '../contexts/NetworkContext';
import { useAuth } from '../contexts/AuthContext';
import { useTabBar } from '../contexts/TabBarContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { firestoreSyncService } from '../services/firestoreSyncService';
import { requestAccountDeletion } from '../services/accountDeletionService';
import { databaseService } from '../services/databaseService';

interface AccountScreenProps {
  onUpgradePress?: (initialProductKind?: 'monthly' | 'room_pack') => void;
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
    restorePurchases,
  } = useSubscription();
  const styles = createStyles(theme);
  const hasCloudSyncAccess = subscription?.isActive === true;
  const hasRoomPack = subscription?.hasRoomPackPurchase === true;
  const roomPackPurchaseCount = subscription?.roomPackPurchaseCount || 0;
  const isSheetPresentation = presentation === 'sheet';

  const [isRestoring, setRestoring] = React.useState(false);
  const [isSyncingLibrary, setSyncingLibrary] = React.useState(false);
  const [isDeletingAccount, setDeletingAccount] = React.useState(false);

  const handleLogout = () => {
    signOut();
  };

  const handleDeleteAccount = () => {
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to delete your account.');
      return;
    }
    if (!user.email?.trim()) {
      Alert.alert(
        'Email needed',
        'Open account settings on the website to provide an email for the completion notice.',
        [
          { text: 'Open account settings', onPress: () => openExternalLink('https://planterior.app/app/account') },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
      return;
    }

    Alert.alert(
      'Delete your account?',
      'This permanently deletes your account and cloud-stored designs and photos. Designs saved on this device will be removed now. A subscription billed by an app store must be cancelled there separately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request deletion',
          style: 'destructive',
          onPress: () => { void submitDeletionRequest(); },
        },
      ],
    );
  };

  const submitDeletionRequest = async () => {
    if (!user || !requireNetwork('Please connect to the internet to delete your account.')) return;
    setDeletingAccount(true);
    let requestAccepted = false;
    try {
      await requestAccountDeletion(user.email);
      requestAccepted = true;
      await databaseService.deleteLocalAccountData(user.id);
      await AsyncStorage.multiRemove([
        `@planterior/design-draft/v1/${user.id}`,
        `@planterior_token_banner_seen:${user.id}`,
      ]);
      await signOut();
      Alert.alert('Deletion requested', 'Your request was received. We will complete it within 30 days and email you when it is done.');
    } catch (error) {
      console.error('Account deletion request failed:', error);
      Alert.alert(
        requestAccepted ? 'Local cleanup incomplete' : 'Could not request deletion',
        requestAccepted
          ? 'Your cloud deletion request was received, but this device could not finish removing local data. Please try Delete Account again.'
          : 'Please try again when you are connected.',
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleUpgrade = (initialProductKind: 'monthly' | 'room_pack' = 'monthly') => {
    if (onUpgradePress) {
      onUpgradePress(initialProductKind);
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
      Alert.alert('Backup complete', `Backed up ${result.designs} design(s) and ${result.collections} collection(s) from this device.`);
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
      Alert.alert('Cloud merge complete', `Merged ${result.designs} design(s) and ${result.collections} collection(s) from the cloud. Unsynced local changes were preserved.`);
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
          { text: 'View Monthly Plan', onPress: () => handleUpgrade('monthly') },
          { text: 'Not Now', style: 'cancel' },
        ]
      );
      return;
    }

    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to sync your library.');
      return;
    }

    Alert.alert('Cloud Library', 'Back up this device, or safely merge records from your cloud library.', [
      {
        text: 'Back Up This Device',
        onPress: async () => {
          if (!requireNetwork('Please connect to the internet to sync your library.')) {
            return;
          }

          try {
            const preflight = await firestoreSyncService.getSyncPreflight(user.id);
            if (preflight.hasPotentialMergeRisk) {
              Alert.alert(
                'Local and cloud records found',
                `This device has ${preflight.localUnsyncedDesigns} unsynced design(s) and ${preflight.localUnsyncedCollections} unsynced collection(s), while your cloud library has ${preflight.remoteDesigns} design(s) and ${preflight.remoteCollections} collection(s).\n\nMerge from Cloud preserves unsynced local changes. Back Up Anyway uploads this device's records to the cloud.`,
                [
                  {
                    text: 'Merge from Cloud',
                    onPress: async () => {
                      if (!requireNetwork('Please connect to the internet to restore your library.')) {
                        return;
                      }
                      await runRestoreNow();
                    },
                  },
                  {
                    text: 'Back Up Anyway',
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
        text: 'Merge from Cloud',
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
              <Text style={styles.title} testID="screen-account">Account</Text>
              <Text style={styles.subtitle}>Your plan, profile, and preferences</Text>
            </View>
            {isSheetPresentation && onClose ? (
              <AppButton
                variant="icon"
                size="md"
                icon="X"
                onPress={onClose}
                accessibilityLabel="Close account"
                style={styles.closeButton}
                testID="account-close"
              />
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

        {/* Current credit balance and paid purchases */}
        <View style={styles.subscriptionSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your design credits</Text>
            <Text style={styles.sectionDescription}>Ready to use on new plant designs</Text>
          </View>

          <View style={styles.creditBalanceCard}>
            <View style={styles.creditBalanceIcon}>
              <AppIcon name="Leaf" size={24} color={theme.colors.primary} weight="fill" />
            </View>
            <View style={styles.creditBalanceCopy}>
              <Text style={styles.creditBalanceValue}>{freeGenerationsRemaining}</Text>
              <Text style={styles.creditBalanceLabel}>
                {freeGenerationsRemaining === 1 ? 'design credit available' : 'design credits available'}
              </Text>
            </View>
          </View>

          <View style={styles.ownershipCard}>
            <Text style={styles.ownershipHeading}>Your purchases</Text>

            {subscription?.isActive ? (
              <View style={styles.ownershipItem} testID="account-active-monthly-plan">
                <View style={styles.ownershipIcon}>
                  <AppIcon name="CheckCircle" size={21} color={theme.colors.primary} weight="fill" />
                </View>
                <View style={styles.ownershipCopy}>
                  <Text style={styles.ownershipTitle}>
                    {subscription.type === 'annual' ? 'Legacy annual plan' : 'Monthly plan'}
                  </Text>
                  <Text style={styles.ownershipDescription}>
                    {subscription.expiryDate
                      ? `Active · Renews ${formatDate(subscription.expiryDate)}`
                      : 'Active · 30 new credits each billing cycle'}
                  </Text>
                </View>
                <AppButton
                  variant="ghost"
                  size="sm"
                  title="Manage"
                  onPress={handleManageSubscription}
                  testID="account-manage"
                />
              </View>
            ) : null}

            {hasRoomPack ? (
              <View style={styles.ownershipItem} testID="account-owned-room-pack">
                <View style={styles.ownershipIcon}>
                  <AppIcon name="CheckCircle" size={21} color={theme.colors.primary} weight="fill" />
                </View>
                <View style={styles.ownershipCopy}>
                  <Text style={styles.ownershipTitle}>
                    {roomPackPurchaseCount > 1 ? `${roomPackPurchaseCount} Room Packs purchased` : 'Room Pack purchased'}
                  </Text>
                  <Text style={styles.ownershipDescription}>
                    One-time credits never expire
                    {subscription?.latestRoomPackPurchaseDate
                      ? ` · Last purchased ${formatDate(subscription.latestRoomPackPurchaseDate)}`
                      : ''}
                  </Text>
                </View>
              </View>
            ) : null}

            {!subscription?.isActive && !hasRoomPack ? (
              <Text style={styles.noPurchasesText}>No paid plan or credit pack yet.</Text>
            ) : null}

            {subscription?.isMock && __DEV__ ? (
              <View style={styles.mockBadge}>
                <Text style={styles.mockBadgeText}>MOCK SUBSCRIPTION</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Optional products are intentionally separate from owned products. */}
        <View style={styles.purchaseSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Get more credits</Text>
            <Text style={styles.sectionDescription}>Choose the option that fits how you design</Text>
          </View>

          <View style={styles.purchaseOptions}>
            {!subscription?.isActive ? (
              <View style={styles.purchaseOption}>
                <View style={styles.purchaseOptionHeader}>
                  <AppIcon name="CalendarCheck" size={22} color={theme.colors.primary} />
                  <View style={styles.purchaseOptionCopy}>
                    <Text style={styles.purchaseOptionTitle}>Monthly plan</Text>
                    <Text style={styles.purchaseOptionDescription}>30 credits every month, plus cloud backup</Text>
                  </View>
                </View>
                <AppButton
                  variant="secondary"
                  size="sm"
                  title="View monthly plan"
                  onPress={() => handleUpgrade('monthly')}
                  testID="account-monthly-plan"
                />
              </View>
            ) : null}

            <View style={styles.purchaseOption}>
              <View style={styles.purchaseOptionHeader}>
                <AppIcon name="Receipt" size={22} color={theme.colors.primary} />
                <View style={styles.purchaseOptionCopy}>
                  <Text style={styles.purchaseOptionTitle}>Room Pack</Text>
                  <Text style={styles.purchaseOptionDescription}>20 one-time credits that never expire</Text>
                </View>
              </View>
              <AppButton
                variant="primary"
                size="sm"
                title={hasRoomPack ? 'Buy another Room Pack' : 'Buy Room Pack'}
                onPress={() => handleUpgrade('room_pack')}
                testID="account-room-pack"
              />
            </View>
          </View>
        </View>

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
            <AppButton
              variant="primary"
              size="sm"
              icon={hasCloudSyncAccess ? 'ArrowCircleUp' : 'Lock'}
              title={hasCloudSyncAccess ? 'Sync / Restore Library' : 'View Monthly Plan'}
              loading={isSyncingLibrary}
              onPress={handleCloudSync}
              style={styles.syncButton}
              testID="account-cloud-sync"
            />
          </View>
        </View>

        <View style={styles.menuSection}>
          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={() => openExternalLink('https://planterior.app/contact')}
            accessibilityRole="button"
            accessibilityLabel="Support"
            accessibilityHint="Opens in your browser"
          >
            <AppIcon name="Question" size={24} color={theme.colors.text} />
            <Text style={styles.menuText}>Support</Text>
            <AppIcon name="CaretRight" size={20} color={theme.colors.textSecondary} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={() => openExternalLink('https://planterior.app/privacy')}
            accessibilityRole="button"
            accessibilityLabel="Privacy Policy"
            accessibilityHint="Opens in your browser"
          >
            <AppIcon name="FileText" size={24} color={theme.colors.text} />
            <Text style={styles.menuText}>Privacy Policy</Text>
            <AppIcon name="CaretRight" size={20} color={theme.colors.textSecondary} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.menuItem, styles.menuItemLast, pressed && styles.menuItemPressed]}
            onPress={handleDeleteAccount}
            disabled={isDeletingAccount}
            accessibilityRole="button"
            accessibilityLabel="Delete account"
            testID="account-delete"
          >
            <AppIcon name="Trash" size={24} color={theme.colors.destructive} />
            <Text style={[styles.menuText, { color: theme.colors.destructive }]}>
              {isDeletingAccount ? 'Requesting deletion…' : 'Delete Account'}
            </Text>
            <AppIcon name="CaretRight" size={20} color={theme.colors.destructive} />
          </Pressable>
        </View>

        <View style={styles.logoutSection}>
          <AppButton
            variant="destructive"
            size="md"
            icon="SignOut"
            title="Sign Out"
            onPress={handleLogout}
            style={styles.logoutButton}
            testID="account-sign-out"
          />
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
    backgroundColor: theme.colors.surface,
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
    minHeight: 56,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  menuItemPressed: {
    backgroundColor: theme.colors.borderLight,
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
    borderColor: theme.colors.destructiveBorder,
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
  sectionDescription: {
    marginTop: 4,
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  creditBalanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.borderLight,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  creditBalanceIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  creditBalanceCopy: {
    flex: 1,
  },
  creditBalanceValue: {
    color: theme.colors.text,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
  },
  creditBalanceLabel: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginTop: 1,
  },
  ownershipCard: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    padding: 16,
    gap: 14,
  },
  ownershipHeading: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  ownershipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ownershipIcon: {
    alignSelf: 'flex-start',
    paddingTop: 1,
  },
  ownershipCopy: {
    flex: 1,
  },
  ownershipTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  ownershipDescription: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  noPurchasesText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  purchaseSection: {
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
  purchaseOptions: {
    gap: 12,
  },
  purchaseOption: {
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  purchaseOptionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  purchaseOptionCopy: {
    flex: 1,
  },
  purchaseOptionTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  purchaseOptionDescription: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
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
    marginTop: 2,
  },
});
