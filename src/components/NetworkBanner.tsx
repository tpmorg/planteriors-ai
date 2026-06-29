import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from './AppIcon';
import { useTheme } from '../contexts/ThemeContext';

type NetworkBannerVariant = 'offline' | 'degraded';

interface NetworkBannerProps {
  variant: NetworkBannerVariant;
}

export const NetworkBanner: React.FC<NetworkBannerProps> = ({ variant }) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const iconColor =
    variant === 'offline'
      ? theme.isDark
        ? '#fca5a5'
        : '#b91c1c'
      : theme.isDark
        ? '#fcd34d'
        : '#b45309';

  const copy =
    variant === 'offline'
      ? {
          icon: 'WifiSlash',
          title: 'No internet connection',
          subtitle: 'Some actions may not work until your connection returns.',
        }
      : {
          icon: 'WarningCircle',
          title: 'Connection seems unstable',
          subtitle: 'Google services may be slow or temporarily unavailable.',
        };

  return (
    <View
      pointerEvents="none"
      style={[styles.overlay, { top: Math.max(insets.top, 12) + 8 }]}
    >
      <View style={[styles.banner, variant === 'offline' ? styles.offline : styles.degraded]}>
        <AppIcon
          name={copy.icon}
          size={18}
          color={iconColor}
        />
        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={1}>
            {copy.title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {copy.subtitle}
          </Text>
        </View>
      </View>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    overlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      alignItems: 'center',
      paddingHorizontal: 16,
      zIndex: 9998,
      elevation: 9998,
    },
    banner: {
      width: '100%',
      maxWidth: 480,
      minHeight: 50,
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: theme.isDark ? 0.24 : 0.12,
      shadowRadius: 16,
      elevation: 8,
    },
    offline: {
      backgroundColor: theme.isDark ? '#241616' : '#fff5f5',
      borderColor: theme.isDark ? '#6e2a2a' : '#fecaca',
    },
    degraded: {
      backgroundColor: theme.isDark ? '#201d13' : '#fffbeb',
      borderColor: theme.isDark ? '#6b5b1f' : '#fde68a',
    },
    copy: {
      flex: 1,
      marginLeft: 10,
    },
    title: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    subtitle: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      lineHeight: 16,
      marginTop: 1,
    },
  });
