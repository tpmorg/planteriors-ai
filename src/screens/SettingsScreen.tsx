import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AppIcon } from '../components/AppIcon';
import { useTabBar } from '../contexts/TabBarContext';
import { useTheme, ThemeMode } from '../contexts/ThemeContext';
import { onboardingService } from '../services/onboardingService';

interface SettingsScreenProps {
  onOpenOnboarding?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onOpenOnboarding }) => {
  const [notifications, setNotifications] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [highQuality, setHighQuality] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const { handleScroll, tabBarHeight } = useTabBar();
  const { theme, themeMode, setThemeMode } = useTheme();

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
          <Text style={styles.subtitle}>Control quality, storage, and app behavior</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>

          <TouchableOpacity style={styles.menuItem} onPress={cycleThroughThemeModes}>
            <AppIcon name="Palette" size={24} color={theme.colors.text} />
            <Text style={styles.menuText}>Theme</Text>
            <View style={styles.menuValue}>
              <Text style={styles.menuValueText}>{getThemeModeDisplayName(themeMode)}</Text>
              <AppIcon name="CaretRight" size={20} color={theme.colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Generation</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <AppIcon name="Image" size={24} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>High Quality Images</Text>
                <Text style={styles.settingDescription}>
                  Generate higher resolution images (uses more credits)
                </Text>
              </View>
            </View>
            <Switch
              value={highQuality}
              onValueChange={setHighQuality}
              trackColor={{ false: theme.colors.switchTrackFalse, true: theme.colors.switchTrackTrue }}
              thumbColor={theme.colors.switchThumb}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <AppIcon name="FloppyDisk" size={24} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Auto-save Designs</Text>
                <Text style={styles.settingDescription}>
                  Automatically save generated designs to gallery
                </Text>
              </View>
            </View>
            <Switch
              value={autoSave}
              onValueChange={setAutoSave}
              trackColor={{ false: theme.colors.switchTrackFalse, true: theme.colors.switchTrackTrue }}
              thumbColor={theme.colors.switchThumb}
            />
          </View>
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
          <Text style={styles.sectionTitle}>Storage</Text>

          <TouchableOpacity style={styles.menuItem}>
            <AppIcon name="Trash" size={24} color={theme.colors.text} />
            <Text style={styles.menuText}>Clear Cache</Text>
            <AppIcon name="CaretRight" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <AppIcon name="DownloadSimple" size={24} color={theme.colors.text} />
            <Text style={styles.menuText}>Manage Downloads</Text>
            <AppIcon name="CaretRight" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
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

          <TouchableOpacity
            style={styles.menuItem}
            onPress={onOpenOnboarding}
            disabled={!onOpenOnboarding}
          >
            <AppIcon name="Slideshow" size={24} color={theme.colors.text} />
            <Text style={styles.menuText}>View Onboarding Again</Text>
            <AppIcon name="CaretRight" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          {__DEV__ && (
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
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>

          <TouchableOpacity style={styles.menuItem}>
            <AppIcon name="FileText" size={24} color={theme.colors.text} />
            <Text style={styles.menuText}>Privacy Policy</Text>
            <AppIcon name="CaretRight" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <AppIcon name="ShieldCheck" size={24} color={theme.colors.text} />
            <Text style={styles.menuText}>Terms of Service</Text>
            <AppIcon name="CaretRight" size={20} color={theme.colors.textSecondary} />
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
  menuValue: {
    flexDirection: 'row',
    alignItems: 'center',
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
