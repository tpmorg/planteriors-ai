import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { ARPlacementController, type ControllerOptions } from '../core/controller';
import type { ARPlacementCallbacks, CommandResult, PlacementPolicy } from '../core/types';

export interface UseARPlacementOptions {
  adapter: ControllerOptions['adapter'];
  policy?: Partial<PlacementPolicy>;
  contents?: ControllerOptions['contents'];
  stopOnBackground?: boolean;
  hostMeta?: ControllerOptions['hostMeta'];
  onTrackingChanged?: ARPlacementCallbacks['onTrackingChanged'];
  onSurfaceAdded?: ARPlacementCallbacks['onSurfaceAdded'];
  onSurfaceUpdated?: ARPlacementCallbacks['onSurfaceUpdated'];
  onSurfaceRemoved?: ARPlacementCallbacks['onSurfaceRemoved'];
  onSurfaceReplaced?: ARPlacementCallbacks['onSurfaceReplaced'];
  onTargetChanged?: ARPlacementCallbacks['onTargetChanged'];
  onPlacementChanged?: ARPlacementCallbacks['onPlacementChanged'];
  onPlacementLost?: ARPlacementCallbacks['onPlacementLost'];
  onError?: ARPlacementCallbacks['onError'];
  onSessionRestarted?: ARPlacementCallbacks['onSessionRestarted'];
}

export function useARPlacement(options: UseARPlacementOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [controller] = useState(() => {
    return new ARPlacementController({
      adapter: options.adapter,
      policy: options.policy,
      contents: options.contents,
      hostMeta: options.hostMeta,
      callbacks: pickCallbacks(options),
    });
  });

  useEffect(() => {
    controller.setCallbacks(pickCallbacks(optionsRef.current));
  });

  useEffect(() => {
    return () => {
      void controller.stop();
      controller.dispose();
    };
  }, [controller]);

  useEffect(() => {
    if (options.stopOnBackground === false) return undefined;
    const appState = { current: AppState.currentState };
    let resume = false;
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const previous = appState.current;
      appState.current = next;
      if (next === 'background' || next === 'inactive') {
        const lifecycle = controller.getSnapshot().session.lifecycle;
        resume = lifecycle === 'running' || lifecycle === 'starting' || lifecycle === 'checking';
        if (resume) void controller.stop();
        return;
      }
      if (next === 'active' && (previous === 'background' || previous === 'inactive') && resume) {
        resume = false;
        void controller.start().then(() => {
          optionsRef.current.onSessionRestarted?.();
        });
      }
    });
    return () => sub.remove();
  }, [controller, options.stopOnBackground]);

  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);

  const start = useCallback(() => controller.start(), [controller]);
  const stop = useCallback(() => controller.stop(), [controller]);
  const reset = useCallback(() => controller.reset(), [controller]);
  const place = useCallback((input: { contentId: string }) => controller.place(input), [controller]);
  const beginMove = useCallback((objectId: string) => controller.beginMove(objectId), [controller]);
  const commitMove = useCallback((objectId: string) => controller.commitMove(objectId), [controller]);
  const cancelMove = useCallback((objectId: string) => controller.cancelMove(objectId), [controller]);
  const setTransform = useCallback(
    (objectId: string, transform: { yawRadians?: number; scale?: number }) =>
      controller.setTransform(objectId, transform),
    [controller]
  );
  const confirm = useCallback((objectId: string) => controller.confirm(objectId), [controller]);
  const remove = useCallback((objectId: string) => controller.remove(objectId), [controller]);
  const clear = useCallback(() => controller.clear(), [controller]);
  const select = useCallback((objectId: string | null): CommandResult => controller.select(objectId), [controller]);

  return useMemo(
    () => ({
      controller,
      snapshot,
      start,
      stop,
      reset,
      place,
      beginMove,
      commitMove,
      cancelMove,
      setTransform,
      confirm,
      remove,
      clear,
      select,
      exportDiagnostics: () => controller.exportDiagnostics(),
      clearDiagnostics: () => controller.clearDiagnostics(),
    }),
    [
      beginMove,
      cancelMove,
      clear,
      commitMove,
      confirm,
      controller,
      place,
      remove,
      reset,
      select,
      setTransform,
      snapshot,
      start,
      stop,
    ]
  );
}

function pickCallbacks(options: UseARPlacementOptions): ARPlacementCallbacks {
  return {
    onTrackingChanged: options.onTrackingChanged,
    onSurfaceAdded: options.onSurfaceAdded,
    onSurfaceUpdated: options.onSurfaceUpdated,
    onSurfaceRemoved: options.onSurfaceRemoved,
    onSurfaceReplaced: options.onSurfaceReplaced,
    onTargetChanged: options.onTargetChanged,
    onPlacementChanged: options.onPlacementChanged,
    onPlacementLost: options.onPlacementLost,
    onError: options.onError,
    onSessionRestarted: options.onSessionRestarted,
  };
}
