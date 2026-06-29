import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '../components/AppIcon';
import { useTheme } from '../contexts/ThemeContext';

interface CreateEntryScreenProps {
  onClose: () => void;
  onCreateDesign: () => void;
  onIdentifyPlant: () => void;
}

export const CreateEntryScreen: React.FC<CreateEntryScreenProps> = ({
  onClose,
  onCreateDesign,
  onIdentifyPlant,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Close start flow"
        >
          <AppIcon name="X" size={20} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.heroBadge}>
          <AppIcon name="Plus" size={24} color="white" weight="bold" />
        </View>
        <Text style={styles.title}>Start With A Photo</Text>
        <Text style={styles.subtitle}>
          Choose the fastest path. Create a room design, or identify a plant and add it to your library.
        </Text>

        <View style={styles.optionStack}>
          <TouchableOpacity
            style={[styles.optionCard, styles.primaryCard]}
            onPress={onCreateDesign}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="Create design"
            accessibilityHint="Capture a room photo and start the AI design flow"
          >
            <View style={styles.primaryIconWrap}>
              <AppIcon name="Camera" size={24} color="white" />
            </View>
            <View style={styles.optionCopy}>
              <Text style={styles.optionEyebrowPrimary}>Main Flow</Text>
              <Text style={styles.optionTitlePrimary}>New Room Photo</Text>
              <Text style={styles.optionSubtitlePrimary}>
                Take, import, or reuse a recent room photo for AI plant styling.
              </Text>
            </View>
            <AppIcon name="ArrowRight" size={20} color="white" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionCard, styles.secondaryCard]}
            onPress={onIdentifyPlant}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="Identify plant"
            accessibilityHint="Open the plant identification flow"
          >
            <View style={styles.secondaryIconWrap}>
              <AppIcon name="MagnifyingGlass" size={22} color={theme.colors.primary} />
            </View>
            <View style={styles.optionCopy}>
              <Text style={styles.optionEyebrowSecondary}>Plant Library</Text>
              <Text style={styles.optionTitleSecondary}>ID Plant</Text>
              <Text style={styles.optionSubtitleSecondary}>
                Snap or upload a plant photo to identify it and save it.
              </Text>
            </View>
            <AppIcon name="ArrowRight" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 6,
    },
    headerSpacer: {
      width: 44,
      height: 44,
    },
    closeButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 28,
      paddingBottom: 28,
    },
    heroBadge: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      marginBottom: 20,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: theme.isDark ? 0.34 : 0.18,
      shadowRadius: 18,
      elevation: 8,
    },
    title: {
      fontSize: 30,
      fontWeight: '800',
      color: theme.colors.text,
    },
    subtitle: {
      marginTop: 10,
      fontSize: 16,
      lineHeight: 23,
      color: theme.colors.textSecondary,
      maxWidth: 340,
    },
    optionStack: {
      marginTop: 28,
      gap: 14,
    },
    optionCard: {
      borderRadius: 22,
      padding: 18,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: theme.isDark ? 0.28 : 0.12,
      shadowRadius: 18,
      elevation: 6,
    },
    primaryCard: {
      backgroundColor: theme.isDark ? '#295f48' : '#2f7a52',
      borderColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(47,122,82,0.16)',
    },
    secondaryCard: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
    },
    primaryIconWrap: {
      width: 54,
      height: 54,
      borderRadius: 27,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    secondaryIconWrap: {
      width: 54,
      height: 54,
      borderRadius: 27,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.isDark ? 'rgba(143,179,154,0.18)' : '#edf7f0',
    },
    optionCopy: {
      flex: 1,
      marginLeft: 14,
      marginRight: 12,
    },
    optionEyebrowPrimary: {
      fontSize: 11,
      fontWeight: '700',
      color: 'rgba(255,255,255,0.74)',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 4,
    },
    optionEyebrowSecondary: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 4,
    },
    optionTitlePrimary: {
      fontSize: 22,
      fontWeight: '800',
      color: 'white',
    },
    optionTitleSecondary: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.colors.text,
    },
    optionSubtitlePrimary: {
      marginTop: 4,
      fontSize: 14,
      lineHeight: 19,
      color: 'rgba(255,255,255,0.84)',
    },
    optionSubtitleSecondary: {
      marginTop: 4,
      fontSize: 14,
      lineHeight: 19,
      color: theme.colors.textSecondary,
    },
  });
