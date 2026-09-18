import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ARPlacementController } from '../core/controller';
import type { ViroPlacementAdapter } from '../adapters/viro/adapter';
import type { RenderObject } from '../adapters/viro/ViroContent';

export function ARPlacementView({
  controller,
  renderObject,
  showOverlays = false,
}: {
  controller: ARPlacementController;
  renderObject: RenderObject;
  showOverlays?: boolean;
}) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [SessionView, setSessionView] = useState<null | typeof import('../adapters/viro/ViroSessionView').ViroSessionView>(
    null
  );
  const needsNative =
    snapshot.capabilities.requiresNativeView &&
    (snapshot.session.lifecycle === 'starting' || snapshot.session.lifecycle === 'running');

  useEffect(() => {
    if (!needsNative || SessionView) return;
    let cancelled = false;
    void import('../adapters/viro/ViroSessionView').then((module) => {
      if (!cancelled) setSessionView(() => module.ViroSessionView);
    });
    return () => {
      cancelled = true;
    };
  }, [needsNative, SessionView]);

  if (!needsNative || !SessionView) {
    return <View style={styles.fill} />;
  }

  return (
    <SessionView
      controller={controller}
      adapter={controller.adapter as ViroPlacementAdapter}
      renderObject={renderObject}
      showOverlays={showOverlays}
      snapshot={snapshot}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000000' },
});
