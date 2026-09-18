import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Dimensions } from 'react-native';

import type { ARPlacementController } from '../../core/controller';
import type { ARSnapshot } from '../../core/types';
import { mapAnchor, mapTracking, type ViroPlacementAdapter } from './adapter';
import { ViroPlacementContent, type RenderObject } from './ViroContent';
import {
  ViroARScene,
  ViroARSceneNavigator,
  ViroAmbientLight,
  ViroDirectionalLight,
  type ViroAnchor,
} from './nativeImports';

type SceneProps = {
  viroAppProps?: ViroAppProps;
  sceneNavigator?: { viroAppProps?: ViroAppProps };
  arSceneNavigator?: { viroAppProps?: ViroAppProps };
};

interface ViroAppProps {
  controller: ARPlacementController;
  adapter: ViroPlacementAdapter;
  renderObject: RenderObject;
  showOverlays: boolean;
  snapshot: ARSnapshot;
}

function resolveAppProps(props: SceneProps): ViroAppProps | undefined {
  return props.viroAppProps ?? props.sceneNavigator?.viroAppProps ?? props.arSceneNavigator?.viroAppProps;
}

function ViroPlacementScene(props: SceneProps) {
  const app = resolveAppProps(props);
  const sceneRef = useRef<ViroARScene | null>(null);
  const appRef = useRef(app);
  appRef.current = app;

  useEffect(() => {
    const adapter = app?.adapter;
    if (!adapter) return;
    adapter.bindScene({
      hitTestCenter: async () => {
        const { width, height } = Dimensions.get('window');
        const scene = sceneRef.current as unknown as {
          performARHitTestWithPoint?: (x: number, y: number) => Promise<unknown>;
        };
        if (!scene?.performARHitTestWithPoint) return null;
        const results = await scene.performARHitTestWithPoint(width / 2, height / 2);
        return Array.isArray(results) ? results : null;
      },
    });
    const generation = app.controller.getSnapshot().session.generation;
    app.controller.ingest({
      type: 'session.nativeReady',
      generation,
      at: Date.now(),
      platform: { os: 'native' },
    });
    return () => adapter.unbindScene();
  }, [app?.adapter, app?.controller]);

  const onAnchorFound = useCallback((anchor: ViroAnchor) => {
    const current = appRef.current;
    if (!current) return;
    const event = mapAnchor(anchor, current.controller.getSnapshot().session.generation, Date.now());
    if (event) current.controller.ingest(event);
  }, []);

  const onAnchorUpdated = useCallback((anchor: ViroAnchor) => {
    onAnchorFound(anchor);
  }, [onAnchorFound]);

  const onAnchorRemoved = useCallback((anchor?: ViroAnchor) => {
    const current = appRef.current;
    if (!current || !anchor?.anchorId) return;
    current.controller.ingest({
      type: 'surface.remove',
      generation: current.controller.getSnapshot().session.generation,
      at: Date.now(),
      nativeId: anchor.anchorId,
    });
  }, []);

  const onTrackingUpdated = useCallback((state: number, reason: number) => {
    const current = appRef.current;
    if (!current) return;
    const mapped = mapTracking(state, reason);
    current.controller.ingest({
      type: 'tracking.changed',
      generation: current.controller.getSnapshot().session.generation,
      at: Date.now(),
      state: mapped.state,
      reason: mapped.reason,
    });
  }, []);

  const onError = useCallback((event: { nativeEvent?: { error?: Error } }) => {
    const current = appRef.current;
    if (!current) return;
    current.controller.ingest({
      type: 'session.nativeError',
      generation: current.controller.getSnapshot().session.generation,
      at: Date.now(),
      message: event?.nativeEvent?.error?.message ?? 'Native AR session error',
      recoverable: true,
    });
  }, []);

  if (!app) return null;

  return (
    <ViroARScene
      ref={sceneRef as never}
      anchorDetectionTypes={['PlanesHorizontal']}
      onTrackingUpdated={onTrackingUpdated}
      onAnchorFound={onAnchorFound}
      onAnchorUpdated={onAnchorUpdated}
      onAnchorRemoved={onAnchorRemoved}
      onError={onError}
    >
      <ViroAmbientLight color="#ffffff" intensity={220} />
      <ViroDirectionalLight color="#ffffff" direction={[0, -1, -0.6]} intensity={320} />
      <ViroPlacementContent
        snapshot={app.snapshot}
        controller={app.controller}
        renderObject={app.renderObject}
        showOverlays={app.showOverlays}
      />
    </ViroARScene>
  );
}

export function ViroSessionView({
  controller,
  adapter,
  renderObject,
  showOverlays,
  snapshot,
}: {
  controller: ARPlacementController;
  adapter: ViroPlacementAdapter;
  renderObject: RenderObject;
  showOverlays: boolean;
  snapshot: ARSnapshot;
}) {
  const viroAppProps = useMemo(
    () => ({ controller, adapter, renderObject, showOverlays, snapshot }),
    [controller, adapter, renderObject, showOverlays, snapshot]
  );
  const initialScene = useMemo(() => ({ scene: ViroPlacementScene as unknown as () => React.JSX.Element }), []);

  return (
    <ViroARSceneNavigator
      key={snapshot.session.generation}
      style={{ flex: 1 }}
      initialScene={initialScene}
      viroAppProps={viroAppProps}
      provider="none"
      autofocus
    />
  );
}
