import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from './AppIcon';
import { useTheme } from '../contexts/ThemeContext';

export interface ActionSheetAction {
  key: string;
  label: string;
  icon?: string;
  /** Renders the row in the destructive token colour. */
  destructive?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
}

interface ActionSheetProps {
  visible: boolean;
  title?: string;
  actions: ActionSheetAction[];
  onDismiss: () => void;
  cancelLabel?: string;
}

/**
 * Bottom sheet used for secondary / overflow actions so primary bars can stay
 * at three items. Rows are 56pt tall with an explicit pressed state.
 */
export const ActionSheet: React.FC<ActionSheetProps> = ({
  visible,
  title,
  actions,
  onDismiss,
  cancelLabel = 'Cancel',
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.root}>
        <Pressable
          style={styles.scrim}
          onPress={onDismiss}
          accessibilityLabel="Dismiss menu"
          accessibilityRole="button"
        />
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}
          accessibilityViewIsModal
        >
          <View style={styles.handle} />
          {title ? <Text style={styles.title}>{title}</Text> : null}

          <ScrollView bounces={false} style={styles.list}>
            {actions.map((action) => {
              const tint = action.destructive ? theme.colors.destructive : theme.colors.text;

              return (
                <Pressable
                  key={action.key}
                  testID={`action-sheet-${action.key}`}
                  onPress={action.onPress}
                  disabled={action.disabled || action.loading}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  accessibilityState={{ disabled: !!action.disabled || !!action.loading }}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && !action.disabled && !action.loading && styles.rowPressed,
                    (action.disabled || action.loading) && styles.rowDisabled,
                  ]}
                >
                  {action.icon ? (
                    <AppIcon
                      name={action.loading ? 'Hourglass' : action.icon}
                      size={22}
                      color={tint}
                    />
                  ) : null}
                  <Text style={[styles.rowLabel, { color: tint }]}>{action.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel={cancelLabel}
            style={({ pressed }) => [styles.cancel, pressed && styles.rowPressed]}
          >
            <Text style={styles.cancelLabel}>{cancelLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: theme.colors.scrim,
    },
    scrim: {
      ...StyleSheet.absoluteFillObject,
    },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 8,
      paddingHorizontal: 12,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.border,
      alignSelf: 'center',
      marginBottom: 12,
    },
    title: {
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: theme.colors.textSecondary,
      paddingHorizontal: 10,
      marginBottom: 6,
    },
    list: {
      flexGrow: 0,
    },
    row: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 10,
      borderRadius: 14,
    },
    rowPressed: {
      backgroundColor: theme.colors.borderLight,
    },
    rowDisabled: {
      opacity: 0.5,
    },
    rowLabel: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
    },
    cancel: {
      minHeight: 52,
      marginTop: 6,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
  });
