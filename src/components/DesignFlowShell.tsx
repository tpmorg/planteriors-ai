import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../contexts/ThemeContext';
import { AppButton } from './AppButton';

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
  const metrics = useRef({ height: 0, content: 0, offset: 0 });
  const [hasMoreBelow, setHasMoreBelow] = useState(false);
  const updateOverflow = () => {
    const { height, content, offset } = metrics.current;
    setHasMoreBelow(height > 0 && content - height - Math.max(0, offset) > 8);
  };
  const body = scroll ? (
    <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator
      onLayout={(event) => { metrics.current.height = event.nativeEvent.layout.height; updateOverflow(); }}
      onContentSizeChange={(_, height) => { metrics.current.content = height; updateOverflow(); }}
      onScroll={(event) => { metrics.current.offset = event.nativeEvent.contentOffset.y; updateOverflow(); }}
      scrollEventThrottle={32}>
      {children}
    </ScrollView>
  ) : <View style={styles.content}>{children}</View>;

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container}>
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
      {scroll ? <View style={styles.scrollCueSlot}>
        {hasMoreBelow ? <AppButton
          variant="ghost"
          size="sm"
          title="More below"
          icon="CaretDown"
          iconPosition="right"
          accessibilityLabel="More below. Scroll down"
          onPress={() => scrollRef.current?.scrollTo({ y: Math.min(metrics.current.content - metrics.current.height, metrics.current.offset + metrics.current.height * 0.75), animated: true })} />
          : null}
      </View> : null}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
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
  scrollCueSlot: { height: 44, backgroundColor: theme.colors.background },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface },
});
