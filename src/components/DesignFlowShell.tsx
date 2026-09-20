import React, { useRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../contexts/ThemeContext';
import { AppButton } from './AppButton';
import { ScrollMoreCue, useScrollOverflow } from './ScrollMoreCue';

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
  const scrollRef = useRef<ScrollView>(null);
  const overflow = useScrollOverflow();
  const body = scroll ? (
    <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator
      keyboardDismissMode="on-drag"
      onLayout={overflow.onLayout}
      onContentSizeChange={overflow.onContentSizeChange}
      onScroll={overflow.onScroll}
      scrollEventThrottle={32}>
      {children}
    </ScrollView>
  ) : <View style={styles.content}>{children}</View>;

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container}>
      <KeyboardAvoidingView style={styles.keyboardArea} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        {onBack ? (
          <AppButton
            variant="icon"
            icon="ArrowLeft"
            onPress={onBack}
            accessibilityLabel="Back"
            testID="design-flow-back"
          />
        ) : <View style={styles.iconPlaceholder} />}
        <View style={styles.heading}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {onClose ? (
          <AppButton
            variant="icon"
            icon="X"
            onPress={onClose}
            accessibilityLabel="Close"
            testID="design-flow-close"
          />
        ) : <View style={styles.iconPlaceholder} />}
      </View>
      {body}
      {scroll ? <ScrollMoreCue visible={overflow.hasMoreBelow} onPress={() => scrollRef.current?.scrollTo({ y: overflow.nextOffset(), animated: true })} /> : null}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  iconPlaceholder: { width: 44 },
  heading: { flex: 1, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.text, textAlign: 'center' },
  subtitle: { marginTop: 2, fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center' },
  content: { flex: 1, paddingHorizontal: 20, paddingBottom: 18 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 },
  scroll: { flex: 1 },
  keyboardArea: { flex: 1 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface },
});
