import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from 'react-native';

import { AppIcon } from './AppIcon';
import type { IconWeight } from './AppIcon';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Single source of truth for tappable surfaces.
 *
 * Replaces the ad-hoc `TouchableOpacity` + `activeOpacity={0.7..0.9}` spread
 * across the app. Every variant guarantees a 44pt+ touch target, themed
 * contrast (no raw `white`), a real pressed state, and accessibility metadata.
 */
export type AppButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'destructive'
  | 'icon'
  | 'chip';

export type AppButtonSize = 'sm' | 'md' | 'lg';

interface SizeTokens {
  minHeight: number;
  paddingHorizontal: number;
  borderRadius: number;
  fontSize: number;
  iconSize: number;
  /** Square edge length for icon buttons / min-height for chips. */
  box: number;
  gap: number;
}

const SIZE_TOKENS: Record<AppButtonSize, SizeTokens> = {
  sm: { minHeight: 44, paddingHorizontal: 14, borderRadius: 12, fontSize: 15, iconSize: 18, box: 40, gap: 8 },
  md: { minHeight: 48, paddingHorizontal: 16, borderRadius: 16, fontSize: 16, iconSize: 19, box: 44, gap: 9 },
  lg: { minHeight: 54, paddingHorizontal: 18, borderRadius: 18, fontSize: 17, iconSize: 20, box: 48, gap: 10 },
};

export interface AppButtonProps {
  /** Label. Required for every variant except `icon`. */
  title?: string;
  onPress?: () => void;
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  /** Phosphor icon name (see `AppIcon`). */
  icon?: string;
  iconPosition?: 'left' | 'right';
  /** Overrides the variant's icon/spinner colour (e.g. brand logos). */
  iconColor?: string;
  /** Phosphor stroke weight (e.g. `fill` for active toggles). */
  iconWeight?: IconWeight;
  /** Chip-only: renders the selected treatment. */
  selected?: boolean;
  /**
   * Always-dark treatment for buttons that sit on photos (camera, design
   * detail, generation). Deliberately ignores the light/dark theme, matching
   * the app's existing overlay chrome.
   */
  overlay?: boolean;
  loading?: boolean;
  disabled?: boolean;
  /** Adds the themed drop shadow used by hero CTAs. */
  elevated?: boolean;
  /** Defaults to true for labelled variants, false for `icon` / `chip`. */
  fullWidth?: boolean;
  /** Extra slop beyond the built-in 8pt on `icon` / `chip`. */
  hitSlop?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

interface VariantStyle {
  container: ViewStyle;
  label: string;
  icon: string;
  pressed: ViewStyle;
}

export const AppButton: React.FC<AppButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  iconColor,
  iconWeight,
  selected = false,
  overlay = false,
  loading = false,
  disabled = false,
  elevated = false,
  fullWidth,
  hitSlop,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
  testID,
}) => {
  const { theme } = useTheme();
  const tokens = SIZE_TOKENS[size];
  const isDisabled = disabled || loading;
  const isIcon = variant === 'icon';
  const isChip = variant === 'chip';
  const stretch = fullWidth ?? (!isIcon && !isChip);

  const palette = useMemo<VariantStyle>(() => {
    const c = theme.colors;

    switch (variant) {
      case 'secondary':
        return {
          container: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
          label: c.text,
          icon: c.text,
          pressed: { opacity: 0.75 },
        };
      case 'ghost':
        return {
          container: { backgroundColor: 'transparent' },
          label: c.text,
          icon: c.text,
          pressed: { opacity: 0.6 },
        };
      case 'destructive':
        return {
          container: {
            backgroundColor: c.destructiveSurface,
            borderWidth: 1,
            borderColor: c.destructiveBorder,
          },
          label: c.destructive,
          icon: c.destructive,
          pressed: { opacity: 0.7 },
        };
      case 'icon':
        return {
          container: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
          label: c.text,
          icon: c.text,
          pressed: { backgroundColor: c.borderLight, opacity: 0.9 },
        };
      case 'chip':
        return selected
          ? {
              container: { backgroundColor: c.primary, borderWidth: 1, borderColor: c.primary },
              label: c.onPrimary,
              icon: c.onPrimary,
              pressed: { opacity: 0.85 },
            }
          : {
              container: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
              label: c.textSecondary,
              icon: c.textSecondary,
              pressed: { backgroundColor: c.borderLight },
            };
      case 'primary':
      default:
        return {
          container: { backgroundColor: c.primary },
          label: c.onPrimary,
          icon: c.onPrimary,
          pressed: { opacity: 0.9 },
        };
    }
  }, [theme, variant, selected]);

  const overlayPalette = useMemo<Partial<VariantStyle>>(() => {
    const onDark = '#ffffff';

    switch (variant) {
      case 'icon':
        return {
          container: {
            backgroundColor: 'rgba(16,16,16,0.52)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.18)',
          },
          label: onDark,
          icon: onDark,
          pressed: { opacity: 0.82 },
        };
      case 'chip':
        return {
          container: selected
            ? {
                backgroundColor: 'rgba(47,122,82,0.92)',
                borderWidth: 1,
                borderColor: 'rgba(134,239,172,0.5)',
              }
            : {
                backgroundColor: theme.isDark ? 'rgba(26,26,26,0.92)' : 'rgba(18,18,18,0.76)',
                borderWidth: 1,
                borderColor: theme.isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.22)',
              },
          label: onDark,
          icon: onDark,
          pressed: { opacity: 0.85 },
        };
      case 'ghost':
        return { label: onDark, icon: onDark, pressed: { opacity: 0.6 } };
      default:
        return { label: onDark, icon: onDark };
    }
  }, [variant, selected, theme.isDark]);

  const surface: VariantStyle = overlay ? { ...palette, ...overlayPalette } : palette;

  const elevation = elevated && !isDisabled
    ? {
        shadowColor: theme.colors.shadow,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: theme.isDark ? 0.28 : 0.16,
        shadowRadius: 12,
        elevation: 4,
      }
    : null;

  const resolvedIconColor = iconColor ?? surface.icon;
  const showIcon = !!icon && !loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      testID={testID}
      hitSlop={hitSlop ?? (isIcon || isChip ? 8 : undefined)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          borderRadius: tokens.borderRadius,
          paddingHorizontal: tokens.paddingHorizontal,
          gap: tokens.gap,
        },
        isIcon && {
          width: tokens.box,
          height: tokens.box,
          borderRadius: tokens.box / 2,
          paddingHorizontal: 0,
        },
        isChip && { minHeight: tokens.box, borderRadius: 999 },
        !isIcon && !isChip && { minHeight: tokens.minHeight },
        surface.container,
        elevation,
        stretch && styles.stretch,
        pressed && !isDisabled && styles.pressed,
        pressed && !isDisabled && surface.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={resolvedIconColor} /> : null}
      {showIcon && iconPosition === 'left' ? (
        <AppIcon
          name={icon as string}
          size={tokens.iconSize}
          color={resolvedIconColor}
          weight={iconWeight}
        />
      ) : null}
      {title ? (
        <Text
          style={[styles.label, { fontSize: tokens.fontSize, color: surface.label }, textStyle]}
        >
          {title}
        </Text>
      ) : null}
      {showIcon && iconPosition === 'right' ? (
        <AppIcon
          name={icon as string}
          size={tokens.iconSize}
          color={resolvedIconColor}
          weight={iconWeight}
        />
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stretch: {
    alignSelf: 'stretch',
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'center',
  },
});
