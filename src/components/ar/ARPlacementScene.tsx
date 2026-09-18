/**
 * AR surface placement scene.
 *
 * Native boundary: this module imports `./viroBridge`, which imports
 * `@reactvision/react-viro`. The host screen only loads this module with a dynamic
 * `import()` after verifying the Viro native module is present, so ordinary app
 * screens never initialise AR.
 *
 * API contract verified against `@reactvision/react-viro@2.53.1`:
 * - `ViroARScene` forwards `onAnchorFound` / `onAnchorUpdated` / `onAnchorRemoved`
 *   (the removed payload can be `undefined`) plus `onTrackingUpdated(state, reason)`
 *   and `onError`.
 * - `ViroARPlaneSelector` no longer self-discovers planes: the scene's anchor events
 *   must be forwarded to its `handleAnchorFound` / `handleAnchorUpdated` /
 *   `handleAnchorRemoved` ref methods. `onPlaneRemoved` receives an anchor id.
 * - Children of `ViroARPlaneSelector` are wrapped in a `ViroNode` positioned at the tap
 *   point in plane-local space (Y = 0 on the surface). The tap transform is therefore
 *   applied exactly once by the selector; this scene only applies its own base offset,
 *   yaw and scale.
 */

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import {
  ViroARPlaneSelector,
  ViroARScene,
  ViroAmbientLight,
  ViroBox,
  ViroDirectionalLight,
  ViroMaterials,
  ViroNode,
  ViroSphere,
} from './viroBridge';
import type { ViroAnchor } from './viroBridge';
import {
  ARPlacementAppProps,
  ARPlacementSceneApi,
  MIN_PLANE_EXTENT_M,
  TRACKING_REASON,
  TRACKING_STATE,
  Vec3,
  arPlacementReducer,
  createInitialARPlacementState,
  getBaseContactOffsetY,
  getPlacementSnapshot,
  isTrackingUsable,
} from './placementState';

ViroMaterials.createMaterials({
  arPlacementPotBody: {
    lightingModel: 'Blinn',
    diffuseColor: '#b4653b',
  },
  arPlacementPotRim: {
    lightingModel: 'Blinn',
    diffuseColor: '#8c4a2a',
  },
  arPlacementSoil: {
    lightingModel: 'Lambert',
    diffuseColor: '#3a2a1e',
  },
  arPlacementFoliage: {
    lightingModel: 'Blinn',
    diffuseColor: '#3e8e5a',
  },
  arPlacementOrientationMark: {
    lightingModel: 'Constant',
    diffuseColor: '#f2c14e',
  },
});

/**
 * The navigator renders the scene class it is given and passes `sceneNavigator` /
 * `arSceneNavigator` down to it. In 2.53.1 the navigator mirrors `viroAppProps` onto
 * both of those objects on every render, so resolve the app props from either place.
 */
type SceneComponentProps = {
  viroAppProps?: ARPlacementAppProps;
  sceneNavigator?: { viroAppProps?: ARPlacementAppProps };
  arSceneNavigator?: { viroAppProps?: ARPlacementAppProps };
};

function resolveAppProps(props: SceneComponentProps): ARPlacementAppProps | undefined {
  return (
    props.viroAppProps ?? props.sceneNavigator?.viroAppProps ?? props.arSceneNavigator?.viroAppProps
  );
}

/**
 * Pot proxy assembled from Viro primitives and modelled around its own centre, so the
 * assembly spans y = [-0.2, +0.2] at nominal scale (0.25 m wide, 0.40 m tall overall).
 * The small yellow box on the +Z face is the orientation mark that makes yaw visible.
 */
function PotProxy() {
  return (
    <>
      {/* Pot body: 0.25 m wide, spanning y = -0.20 .. 0.04 */}
      <ViroBox
        width={0.25}
        height={0.24}
        length={0.25}
        position={[0, -0.08, 0]}
        materials={['arPlacementPotBody']}
      />
      {/* Rim */}
      <ViroBox
        width={0.27}
        height={0.03}
        length={0.27}
        position={[0, 0.025, 0]}
        materials={['arPlacementPotRim']}
      />
      {/* Soil */}
      <ViroBox
        width={0.21}
        height={0.02}
        length={0.21}
        position={[0, 0.03, 0]}
        materials={['arPlacementSoil']}
      />
      {/* Foliage placeholder, reaching the nominal 0.40 m total height */}
      <ViroSphere
        radius={0.1}
        widthSegmentCount={16}
        heightSegmentCount={16}
        position={[0, 0.1, 0]}
        materials={['arPlacementFoliage']}
      />
      {/* Orientation mark so rotation is visible */}
      <ViroBox
        width={0.1}
        height={0.05}
        length={0.03}
        position={[0, -0.02, 0.125]}
        materials={['arPlacementOrientationMark']}
      />
    </>
  );
}

export function ARPlacementScene(props: SceneComponentProps) {
  const appProps = resolveAppProps(props);
  const sessionId = appProps?.sessionId ?? 'unknown-session';

  const [state, dispatch] = useReducer(
    arPlacementReducer,
    sessionId,
    createInitialARPlacementState
  );
  const [lastError, setLastError] = useState<string | null>(null);

  const selectorRef = useRef<ViroARPlaneSelector | null>(null);
  /** Diagnostic anchor map keyed by anchor id (never a per-update counter). */
  const anchorMapRef = useRef<Map<string, ViroAnchor>>(new Map());
  const trackingRef = useRef<{ state: number; reason: number }>({
    state: TRACKING_STATE.UNAVAILABLE,
    reason: TRACKING_REASON.NONE,
  });

  // The callbacks below are recreated on every render; read the latest state through a
  // ref so a scene callback can never act on a stale render.
  const stateRef = useRef(state);
  stateRef.current = state;
  const appPropsRef = useRef(appProps);
  appPropsRef.current = appProps;

  const syncPlaneCount = useCallback(() => {
    dispatch({ type: 'planes/changed', planeCount: anchorMapRef.current.size });
  }, []);

  const removePlane = useCallback(
    (anchorId: string) => {
      const existed = anchorMapRef.current.delete(anchorId);
      if (existed) {
        syncPlaneCount();
      }
      dispatch({ type: 'anchor/removed', anchorId });
    },
    [syncPlaneCount]
  );

  // --- ViroARScene anchor / tracking events -------------------------------------

  const handleAnchorFound = useCallback((anchor: ViroAnchor) => {
    if (!anchor?.anchorId) return;
    selectorRef.current?.handleAnchorFound(anchor);
  }, []);

  /**
   * Accept only upward-facing horizontal planes. The selector's own filter uses
   * `alignment="Horizontal"` so a slightly different alignment string from a platform
   * is not silently dropped; downward-facing (ceiling) planes are rejected here.
   */
  const handlePlaneDetected = useCallback(
    (plane: ViroAnchor): boolean => {
      if (!plane?.anchorId) return false;
      if (plane.alignment === 'HorizontalDownward') return false;

      anchorMapRef.current.set(plane.anchorId, plane);
      syncPlaneCount();
      return true;
    },
    [syncPlaneCount]
  );

  const handleAnchorUpdated = useCallback((anchor: ViroAnchor) => {
    if (!anchor?.anchorId) return;
    selectorRef.current?.handleAnchorUpdated(anchor);
    if (anchorMapRef.current.has(anchor.anchorId)) {
      // Refinement updates only; no React state change so per-frame updates cannot
      // trigger constant rerenders of the diagnostics panel.
      anchorMapRef.current.set(anchor.anchorId, anchor);
    }
  }, []);

  const handleAnchorRemoved = useCallback(
    (anchor?: ViroAnchor) => {
      // `ViroARScene.onAnchorRemoved` may fire with an undefined payload.
      if (!anchor?.anchorId) return;
      selectorRef.current?.handleAnchorRemoved(anchor);
      removePlane(anchor.anchorId);
    },
    [removePlane]
  );

  /** Fired by the selector (via `onPlaneRemoved`) after it clears a removed selection. */
  const handleSelectorPlaneRemoved = useCallback(
    (anchorId: string) => {
      if (!anchorId) return;
      removePlane(anchorId);
    },
    [removePlane]
  );

  const handleTrackingUpdated = useCallback((trackingState: number, trackingReason: number) => {
    const previous = trackingRef.current;
    // Throttle: only real tracking-state changes reach React state.
    if (previous.state === trackingState && previous.reason === trackingReason) return;
    trackingRef.current = { state: trackingState, reason: trackingReason };
    dispatch({ type: 'tracking/changed', trackingState, trackingReason });
  }, []);

  const handleError = useCallback((event: { nativeEvent?: { error?: Error } }) => {
    setLastError(event?.nativeEvent?.error?.message ?? 'Native AR session error');
  }, []);

  /**
   * The selector has already positioned its children at the tap point, so the world tap
   * position is recorded for diagnostics only and never applied as an offset.
   */
  const handlePlaneSelected = useCallback((plane: ViroAnchor, tapPosition?: Vec3) => {
    if (!plane?.anchorId) return;

    if (!isTrackingUsable(stateRef.current.trackingState)) {
      // Reject the placement and clear the selection the selector just made.
      selectorRef.current?.reset();
      dispatch({ type: 'plane/selected', anchorId: plane.anchorId, tapWorldPosition: null });
      return;
    }

    dispatch({
      type: 'plane/selected',
      anchorId: plane.anchorId,
      tapWorldPosition: tapPosition ?? null,
    });
  }, []);

  // --- Imperative API for the React Native controls -----------------------------

  const api = useMemo<ARPlacementSceneApi>(
    () => ({
      rotate: (direction) => dispatch({ type: 'transform/rotate', direction }),
      scale: (direction) => dispatch({ type: 'transform/scale', direction }),
      placeAgain: () => {
        selectorRef.current?.reset();
        dispatch({ type: 'placement/clear' });
      },
      confirm: () => dispatch({ type: 'placement/confirm', at: Date.now() }),
      editPlacement: () => dispatch({ type: 'placement/edit' }),
    }),
    []
  );

  useEffect(() => {
    appPropsRef.current?.onReady?.(api);
  }, [api]);

  useEffect(() => {
    appPropsRef.current?.onStatusChange?.({
      ...state,
      lastError,
      snapshot: getPlacementSnapshot(state),
    });
  }, [state, lastError]);

  const showPot = state.phase === 'placed' || state.phase === 'confirmed';
  // Effective local offset above the surface. Applied on the scaled node, whose own
  // position is in the parent's (unscaled) space, so this value is used as-is.
  const baseOffsetY = getBaseContactOffsetY(state.scale);

  return (
    <ViroARScene
      // Horizontal plane detection explicitly enabled for this POC.
      anchorDetectionTypes={['PlanesHorizontal']}
      onTrackingUpdated={handleTrackingUpdated}
      onAnchorFound={handleAnchorFound}
      onAnchorUpdated={handleAnchorUpdated}
      onAnchorRemoved={handleAnchorRemoved}
      onError={handleError}
    >
      <ViroAmbientLight color="#ffffff" intensity={220} />
      <ViroDirectionalLight color="#ffffff" direction={[0, -1, -0.6]} intensity={320} />

      <ViroARPlaneSelector
        ref={selectorRef}
        // Tolerant horizontal filter; exclusive acceptance of upward-facing planes
        // happens in handlePlaneDetected.
        alignment="Horizontal"
        minWidth={MIN_PLANE_EXTENT_M}
        minHeight={MIN_PLANE_EXTENT_M}
        // Hide the overlay on the selected plane once content is placed.
        hideOverlayOnSelection
        onPlaneDetected={handlePlaneDetected}
        onPlaneSelected={handlePlaneSelected}
        onPlaneRemoved={handleSelectorPlaneRemoved}
      >
        {showPot ? (
          // Yaw is applied at the tap point (on the surface) and scale is applied to the
          // offset assembly, so the object's base always stays in contact with the plane.
          <ViroNode position={[0, 0, 0]} rotation={[0, state.rotationYawDeg, 0]}>
            <ViroNode
              position={[0, baseOffsetY, 0]}
              scale={[state.scale, state.scale, state.scale]}
            >
              <PotProxy />
            </ViroNode>
          </ViroNode>
        ) : null}
      </ViroARPlaneSelector>
    </ViroARScene>
  );
}

export default ARPlacementScene;
