import React, { useRef, useState } from 'react';
import { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, StyleSheet, View } from 'react-native';
import { AppButton } from './AppButton';

export function useScrollOverflow() {
  const metrics = useRef({ height: 0, content: 0, offset: 0 });
  const [hasMoreBelow, setHasMoreBelow] = useState(false);
  const update = () => {
    const { height, content, offset } = metrics.current;
    setHasMoreBelow(height > 0 && content - height - Math.max(0, offset) > 8);
  };
  return {
    hasMoreBelow,
    onLayout: (event: LayoutChangeEvent) => { metrics.current.height = event.nativeEvent.layout.height; update(); },
    onContentSizeChange: (_width: number, height: number) => { metrics.current.content = height; update(); },
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => { metrics.current.offset = event.nativeEvent.contentOffset.y; update(); },
    nextOffset: () => Math.max(0, Math.min(metrics.current.content - metrics.current.height, Math.max(0, metrics.current.offset) + metrics.current.height * 0.75)),
  };
}

export function ScrollMoreCue({ visible, onPress }: { visible: boolean; onPress: () => void }) {
  // Retain space at the end to avoid a layout/overflow feedback loop.
  return <View style={styles.slot}>
    {visible ? <AppButton variant="ghost" size="sm" title="More below" icon="CaretDown" iconPosition="right"
      accessibilityLabel="More below. Scroll down" onPress={onPress} /> : null}
  </View>;
}

const styles = StyleSheet.create({ slot: { minHeight: 44 } });
