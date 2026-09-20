import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';
import { AppIcon } from '../components/AppIcon';
import { useTabBar } from '../contexts/TabBarContext';
import { useNetworkGuard } from '../contexts/NetworkContext';
import { useTheme, ThemeMode } from '../contexts/ThemeContext';
import { onboardingService } from '../services/onboardingService';
import { subscriptionService } from '../services/subscriptionService';
import { useDebugPreferences } from '../contexts/DebugPreferencesContext';
import { useAuth } from '../contexts/AuthContext';

interface SettingsScreenProps {
  onOpenOnboarding?: () => void;
}

const getAppVersionDisplay = (): string => {
  const nativeConstants = Constants as typeof Constants & {
    nativeAppVersion?: string | null;
    nativeBuildVersion?: string | null;
  };
  const appVersion =
    nativeConstants.nativeAppVersion ||
    Constants.expoConfig?.version ||
    '1.0.0';
  const buildNumber =
    nativeConstants.nativeBuildVersion ||
    Constants.platform?.ios?.buildNumber ||
    Constants.platform?.android?.versionCode?.toString() ||
    Constants.expoConfig?.ios?.buildNumber ||
    Constants.expoConfig?.android?.versionCode?.toString();

  return buildNumber ? `${appVersion}(${buildNumber})` : appVersion;
};

interface SettingsRowProps {
  icon: string;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  value?: string;
  hint?: string;
  styles: any;
  theme: any;
}

/**
 * Shared tappable settings row: 56pt+ target, real pressed feedback and
 * accessibility role/state, so every row in this screen behaves identically.
 */
const SettingsRow: React.FC<SettingsRowProps> = ({
  icon,
  label,
  onPress,
  disabled = false,
  value,
  hint,
  styles,
  theme,
}) => (
  <Pressable
    style={({ pressed }) => [
      styles.menuItem,
      pressed && !disabled && styles.rowPressed,
      disabled && styles.menuItemDisabled,
    ]}
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityHint={hint}
    accessibilityState={{ disabled }}
  >
    <AppIcon name={icon} size={24} color={theme.colors.text} />
    <Text style={styles.menuText}>{label}</Text>
    {value ? <Text style={styles.menuValueText}>{value}</Text> : null}
    <AppIcon name="CaretRight" size={20} color={theme.colors.textSecondary} />
  </Pressable>
);

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onOpenOnboarding }) => {
  const [notifications, setNotifications] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [diagnosticTapCount, setDiagnosticTapCount] = useState(0);
  const [showDiagnostics, setShowDiagnostics] = useState(__DEV__);
  const { handleScroll, tabBarHeight } = useTabBar();
  const { theme, themeMode, setThemeMode } = useTheme();
  const requireNetwork = useNetworkGuard();
  const { suppressFreePlanWarnings, setSuppressFreePlanWarnings } = useDebugPreferences();
  const { user } = useAuth();
  const appVersionDisplay = getAppVersionDisplay();

  useFocusEffect(
    React.useCallback(() => {
      let isMounted = true;

      const loadOnboardingStatus = async () => {
        const completed = await onboardingService.isCompleted();
        if (isMounted) {
          setOnboardingCompleted(completed);
        }
      };

      loadOnboardingStatus();

      return () => {
        isMounted = false;
      };
    }, [])
  );

  const getThemeModeDisplayName = (mode: ThemeMode): string => {
    switch (mode) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
      case 'system':
        return 'System';
    }
  };

  const cycleThroughThemeModes = () => {
    const modes: ThemeMode[] = ['system', 'light', 'dark'];
    const currentIndex = modes.indexOf(themeMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setThemeMode(modes[nextIndex]);
  };

  const handleDebugOnboardingToggle = async (value: boolean) => {
    await onboardingService.setCompleted(value);
    setOnboardingCompleted(value);
  };

  const handleVersionPress = () => {
    if (showDiagnostics) return;

    const nextCount = diagnosticTapCount + 1;
    setDiagnosticTapCount(nextCount);

    if (nextCount >= 7) {
      setShowDiagnostics(true);
      Alert.alert('Diagnostics Enabled', 'Developer diagnostics are now visible in Settings.');
    }
  };

  const handleSendSentryTestEvent = async () => {
    const sentryEventTime = new Date().toISOString();
    const payload = {
      source: 'planterior.settings.debug',
      scenario: 'manual_test_event',
      sentryEventTime,
    };

    Sentry.setContext('settings_test', payload);
    Sentry.captureMessage('Planterior Sentry test event', 'info');
    Sentry.captureException(new Error(`Planterior Sentry test exception (${sentryEventTime})`));

    Alert.alert('Sentry Test', 'Sent test message + error to Sentry. Check your Sentry issue list.');
  };

  const handleDebugRevenueCatOfferings = async () => {
    const payload = await subscriptionService.debugOfferings(user?.id);
    const json = JSON.stringify(payload, null, 2);
    console.log('RevenueCat offerings debug:', json);

    Sentry.withScope((scope) => {
      scope.setTag('area', 'subscription');
      scope.setContext('revenuecat_offerings_debug', payload);
      Sentry.captureMessage('RevenueCat offerings debug requested from settings', 'warning');
    });

    Alert.alert(
      'RevenueCat Offerings',
      json.length > 3500 ? `${json.slice(0, 3500)}\n\n...truncated; full payload is in device logs.` : json
    );
  };

  const handleDebugRevenueCatSanityCheck = async () => {
    const payload = await subscriptionService.debugSubscriptionState(user?.id);
    const json = JSON.stringify(payload, null, 2);
    console.log('RevenueCat subscription sanity check:', json);

    Sentry.withScope((scope) => {
      scope.setTag('area', 'subscription');
      scope.setContext('revenuecat_subscription_sanity_check', payload);
      Sentry.captureMessage('RevenueCat subscription sanity check requested from settings', 'warning');
    });

    Alert.alert(
      'RevenueCat Sanity Check',
      json.length > 3500 ? `${json.slice(0, 3500)}\n\n...truncated; full payload is in device logs.` : json
    );
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

  const styles = createStyles(theme);

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container}>
      <View style={styles.backdropBlobA} />
      <View style={styles.backdropBlobB} />
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 20 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Control quality and app behavior</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>

          <SettingsRow
            icon="Palette"
            label="Theme"
            value={getThemeModeDisplayName(themeMode)}
            hint="Cycles between system, light and dark appearance"
            styles={styles}
            theme={theme}
            onPress={cycleThroughThemeModes}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <AppIcon name="Bell" size={24} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Push Notifications</Text>
                <Text style={styles.settingDescription}>
                  Receive updates about new features and tips
                </Text>
              </View>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: theme.colors.switchTrackFalse, true: theme.colors.switchTrackTrue }}
              thumbColor={theme.colors.switchThumb}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Guided Tour</Text>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Onboarding</Text>
            <View style={styles.onboardingStatus}>
              <AppIcon
                name={onboardingCompleted ? 'CheckCircle' : 'Clock'}
                size={16}
                color={onboardingCompleted ? theme.colors.primary : theme.colors.textSecondary}
              />
              <Text style={styles.infoValue}>
                {onboardingCompleted ? 'Completed' : 'Not completed'}
              </Text>
            </View>
          </View>

          <SettingsRow
            icon="Slideshow"
            label="View Onboarding Again"
            disabled={!onOpenOnboarding}
            styles={styles}
            theme={theme}
            onPress={onOpenOnboarding}
          />

          {showDiagnostics && (
            <>
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <AppIcon name="BugBeetle" size={24} color={theme.colors.text} />
                  <View style={styles.settingText}>
                    <Text style={styles.settingLabel}>Mark Onboarding Complete (Debug)</Text>
                    <Text style={styles.settingDescription}>
                      Turn off to reset onboarding and show it on next app launch.
                    </Text>
                  </View>
                </View>
                <Switch
                  value={onboardingCompleted}
                  onValueChange={handleDebugOnboardingToggle}
                  trackColor={{ false: theme.colors.switchTrackFalse, true: theme.colors.switchTrackTrue }}
                  thumbColor={theme.colors.switchThumb}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <AppIcon name="Crown" size={24} color={theme.colors.text} />
                  <View style={styles.settingText}>
                    <Text style={styles.settingLabel}>Hide Free Plan Warnings (Debug)</Text>
                    <Text style={styles.settingDescription}>
                      Show paid layout preview without free-tier warning UI.
                    </Text>
                  </View>
                </View>
                <Switch
                  value={suppressFreePlanWarnings}
                  onValueChange={setSuppressFreePlanWarnings}
                  trackColor={{ false: theme.colors.switchTrackFalse, true: theme.colors.switchTrackTrue }}
                  thumbColor={theme.colors.switchThumb}
                />
              </View>

              <SettingsRow
                icon="BugBeetle"
                label="Send Sentry Test Event"
                styles={styles}
                theme={theme}
                onPress={handleSendSentryTestEvent}
              />

              <SettingsRow
                icon="Receipt"
                label="Debug RevenueCat Offerings"
                styles={styles}
                theme={theme}
                onPress={handleDebugRevenueCatOfferings}
              />

              <SettingsRow
                icon="ShieldCheck"
                label="RevenueCat Sanity Check"
                styles={styles}
                theme={theme}
                onPress={handleDebugRevenueCatSanityCheck}
              />

            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>

          <Pressable
            style={({ pressed }) => [styles.infoItem, pressed && styles.rowPressed]}
            onPress={handleVersionPress}
            accessibilityRole="button"
            accessibilityLabel="App version"
            accessibilityHint="Shows developer diagnostics after several taps"
          >
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>{appVersionDisplay}</Text>
          </Pressable>

          <SettingsRow
            icon="FileText"
            label="Privacy Policy"
            hint="Opens in your browser"
            styles={styles}
            theme={theme}
            onPress={() => openExternalLink('https://planterior.app/privacy')}
          />

          <SettingsRow
            icon="ShieldCheck"
            label="Terms of Service"
            hint="Opens in your browser"
            styles={styles}
            theme={theme}
            onPress={() => openExternalLink('https://planterior.app/terms')}
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
  section: {
    backgroundColor: theme.colors.surface,
    marginTop: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: theme.isDark ? 0.22 : 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    paddingHorizontal: 20,
    paddingVertical: 10,
    letterSpacing: 0.2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    flex: 1,
    marginLeft: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
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
  rowPressed: {
    backgroundColor: theme.colors.borderLight,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
    marginLeft: 16,
  },
  menuItemDisabled: {
    opacity: 0.55,
  },
  menuValueText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginRight: 8,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  infoLabel: {
    fontSize: 16,
    color: theme.colors.text,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  onboardingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
