import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../contexts/ThemeContext';
import { AppIcon } from './AppIcon';

interface DesignFlowShellProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onClose?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  scroll?: boolean;
}

export function DesignFlowShell({
  title, subtitle, onBack, onClose, children, footer, scroll = false,
}: DesignFlowShellProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const body = scroll ? (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : <View style={styles.content}>{children}</View>;

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container}>
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity style={styles.iconButton} onPress={onBack} accessibilityRole="button" accessibilityLabel="Back">
            <AppIcon name="ArrowLeft" size={22} color={theme.colors.text} />
          </TouchableOpacity>
        ) : <View style={styles.iconPlaceholder} />}
        <View style={styles.heading}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {onClose ? (
          <TouchableOpacity style={styles.iconButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
            <AppIcon name="X" size={20} color={theme.colors.text} />
          </TouchableOpacity>
        ) : <View style={styles.iconPlaceholder} />}
      </View>
      {body}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  iconPlaceholder: { width: 44 },
  heading: { flex: 1, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.text, textAlign: 'center' },
  subtitle: { marginTop: 2, fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center' },
  content: { flex: 1, paddingHorizontal: 20, paddingBottom: 18 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface },
});
