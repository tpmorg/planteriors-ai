/**
 * Pure state, validation and transform helpers for the AR surface placement POC.
 *
 * This module deliberately has **no Viro or native imports** so that the placement
 * rules can be unit tested without a device (see `__tests__/placementState.test.ts`).
 * Native tracking constants are mirrored here as plain numbers; parity with
 * `@reactvision/react-viro@2.53.1` is asserted in the test file.
 *
 * Coordinate frames used by the POC:
 * - `planeLocalOrigin` is always `[0, 0, 0]`. `ViroARPlaneSelector` already wraps its
 *   children in a node positioned at the tap point in plane-local space (Y = 0 on the
 *   surface), so the app must NOT apply a world-space tap position again.
 * - The pot assembly is modelled around its own centre. The surface contact offset is
 *   half the nominal height multiplied by scale, and the scale/rotation transform is
 *   applied at the base so the base stays on the surface.
 */

export type Vec3 = [number, number, number];

/** Nominal footprint of the pot proxy in metres (~0.25 m wide). */
export const NOMINAL_POT_WIDTH_M = 0.25;
/** Nominal total height of the pot proxy in metres (~0.40 m tall). */
export const NOMINAL_POT_HEIGHT_M = 0.4;
/** Half the nominal height; local Y offset that puts a centred assembly's base on the surface. */
export const NOMINAL_POT_HALF_HEIGHT_M = NOMINAL_POT_HEIGHT_M / 2;

export const MIN_SCALE = 0.5;
export const MAX_SCALE = 2.0;
export const SCALE_STEP = 0.1;
export const ROTATION_STEP_DEG = 15;

/** How long to wait before offering detection guidance. UX threshold, not a guarantee. */
export const NO_PLANE_GUIDANCE_MS = 15000;
/** Planes smaller than this are not offered for placement. */
export const MIN_PLANE_EXTENT_M = 0.1;

/**
 * Mirrors `ViroTrackingStateConstants` from `@reactvision/react-viro@2.53.1`
 * (`components/ViroConstants.ts`). Asserted in tests.
 */
export const TRACKING_STATE = {
  UNAVAILABLE: 1,
  LIMITED: 2,
  NORMAL: 3,
} as const;

/**
 * Mirrors `ViroARTrackingReasonConstants` from `@reactvision/react-viro@2.53.1`
 * (`components/ViroConstants.ts`). Asserted in tests.
 */
export const TRACKING_REASON = {
  NONE: 1,
  EXCESSIVE_MOTION: 2,
  INSUFFICIENT_FEATURES: 3,
} as const;

export type TrackingStateValue = (typeof TRACKING_STATE)[keyof typeof TRACKING_STATE];
export type TrackingReasonValue = (typeof TRACKING_REASON)[keyof typeof TRACKING_REASON];

/**
 * Suggested flow: checking support/permission -> scanning -> surface available ->
 * placed -> confirmed. Permission denial and an unsupported runtime are terminal
 * states handled by the host screen. `placement-invalid` is a recoverable state
 * that requires the user to tap a surface again.
 */
export type PlacementPhase =
  | 'scanning'
  | 'surface-available'
  | 'placed'
  | 'confirmed'
  | 'placement-invalid';

export type PlacementInvalidReason =
  | 'anchor-removed'
  | 'tracking-not-usable'
  | null;

export interface ARPlacementState {
  sessionId: string;
  phase: PlacementPhase;
  trackingState: number;
  trackingReason: number;
  /** True only for `TRACKING_NORMAL`. Placement and confirmation require usable tracking. */
  trackingUsable: boolean;
  /** Number of plane anchors accepted by the selector (keyed by anchor id in the scene). */
  planeCount: number;
  /** Anchor id of the plane the object was placed on, or null. */
  anchorId: string | null;
  /** Always [0, 0, 0]; see the module doc for why no tap offset is applied here. */
  planeLocalOrigin: Vec3;
  /** World-space tap point. Recorded for diagnostics only, never applied as an offset. */
  tapWorldPosition: Vec3 | null;
  /** Yaw in degrees about the surface normal, applied at the object base. */
  rotationYawDeg: number;
  /** Uniform scale in [MIN_SCALE, MAX_SCALE], applied at the object base. */
  scale: number;
  confirmedAt: number | null;
  invalidReason: PlacementInvalidReason;
}

export type ARPlacementAction =
  | { type: 'session/start'; sessionId: string }
  | { type: 'planes/changed'; planeCount: number }
  | { type: 'plane/selected'; anchorId: string; tapWorldPosition: Vec3 | null }
  | { type: 'anchor/removed'; anchorId: string }
  | { type: 'tracking/changed'; trackingState: number; trackingReason: number }
  | { type: 'transform/rotate'; direction: 'left' | 'right' }
  | { type: 'transform/scale'; direction: 'smaller' | 'larger' }
  | { type: 'placement/clear' }
  | { type: 'placement/confirm'; at: number }
  | { type: 'placement/edit' };

export interface ARPlacementSnapshot {
  sessionId: string;
  anchorId: string;
  /** Local (plane-space) origin of the placed content. Always [0, 0, 0]. */
  planeLocalOrigin: Vec3;
  /** World-space tap point, diagnostics only. */
  tapWorldPosition: Vec3 | null;
  rotationYawDeg: number;
  scale: number;
  widthM: number;
  heightM: number;
  /** Local Y offset of the centred assembly above the base contact point. */
  baseContactOffsetY: number;
  confirmedAt: number | null;
}

export interface ARPlacementStatus extends ARPlacementState {
  lastError: string | null;
  snapshot: ARPlacementSnapshot | null;
}

export interface ARPlacementSceneApi {
  rotate: (direction: 'left' | 'right') => void;
  scale: (direction: 'smaller' | 'larger') => void;
  placeAgain: () => void;
  confirm: () => void;
  editPlacement: () => void;
}

/**
 * Props handed to the scene through the AR navigator's `viroAppProps`. In
 * `@reactvision/react-viro@2.53.1` the navigator copies `viroAppProps` onto the
 * `sceneNavigator`/`arSceneNavigator` objects that are passed to every scene, so the
 * scene resolves these from either location.
 */
export interface ARPlacementAppProps {
  sessionId: string;
  onStatusChange: (status: ARPlacementStatus) => void;
  onReady: (api: ARPlacementSceneApi) => void;
}

export function createInitialARPlacementState(sessionId: string): ARPlacementState {
  return {
    sessionId,
    phase: 'scanning',
    trackingState: TRACKING_STATE.UNAVAILABLE,
    trackingReason: TRACKING_REASON.NONE,
    trackingUsable: false,
    planeCount: 0,
    anchorId: null,
    planeLocalOrigin: [0, 0, 0],
    tapWorldPosition: null,
    rotationYawDeg: 0,
    scale: 1,
    confirmedAt: null,
    invalidReason: null,
  };
}

export function isTrackingUsable(trackingState: number): boolean {
  return trackingState === TRACKING_STATE.NORMAL;
}

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

export function nextScale(scale: number, direction: 'smaller' | 'larger'): number {
  const delta = direction === 'larger' ? SCALE_STEP : -SCALE_STEP;
  const clamped = clampScale(scale);
  // Round to avoid floating point drift across repeated steps.
  return clampScale(Number((clamped + delta).toFixed(4)));
}

export function normalizeYaw(yaw: number): number {
  const normalized = yaw % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function rotateYaw(yaw: number, direction: 'left' | 'right'): number {
  const delta = direction === 'left' ? -ROTATION_STEP_DEG : ROTATION_STEP_DEG;
  return normalizeYaw(yaw + delta);
}

/** Dimensions of the pot proxy at the given scale. */
export function getPotDimensions(scale: number): { widthM: number; heightM: number } {
  const clamped = clampScale(scale);
  return {
    widthM: NOMINAL_POT_WIDTH_M * clamped,
    heightM: NOMINAL_POT_HEIGHT_M * clamped,
  };
}

/**
 * Local Y offset applied to the centred pot assembly so its base rests on the surface.
 * Because the offset and the assembly are both scaled from the base, the base stays at
 * Y = 0 for every scale in [MIN_SCALE, MAX_SCALE].
 */
export function getBaseContactOffsetY(scale: number): number {
  return NOMINAL_POT_HALF_HEIGHT_M * clampScale(scale);
}

/** True when the supplied local Y offset keeps the object's base on the plane surface. */
export function isBaseOnSurface(offsetY: number, scale: number): boolean {
  return Math.abs(offsetY - getBaseContactOffsetY(scale)) < 1e-9;
}

export function getPlacementSnapshot(state: ARPlacementState): ARPlacementSnapshot | null {
  if (!state.anchorId) return null;
  if (state.phase !== 'placed' && state.phase !== 'confirmed') return null;

  const dimensions = getPotDimensions(state.scale);
  return {
    sessionId: state.sessionId,
    anchorId: state.anchorId,
    planeLocalOrigin: state.planeLocalOrigin,
    tapWorldPosition: state.tapWorldPosition,
    rotationYawDeg: state.rotationYawDeg,
    scale: state.scale,
    widthM: dimensions.widthM,
    heightM: dimensions.heightM,
    baseContactOffsetY: getBaseContactOffsetY(state.scale),
    confirmedAt: state.confirmedAt,
  };
}

export function describeTrackingReason(reason: number): string {
  switch (reason) {
    case TRACKING_REASON.EXCESSIVE_MOTION:
      return 'moving too fast';
    case TRACKING_REASON.INSUFFICIENT_FEATURES:
      return 'not enough visible detail';
    case TRACKING_REASON.NONE:
      return 'no reason reported';
    default:
      return `reason ${reason}`;
  }
}

export function describeTrackingState(trackingState: number, trackingReason: number): string {
  switch (trackingState) {
    case TRACKING_STATE.NORMAL:
      return 'normal';
    case TRACKING_STATE.LIMITED:
      return `limited (${describeTrackingReason(trackingReason)})`;
    case TRACKING_STATE.UNAVAILABLE:
      return `unavailable (${describeTrackingReason(trackingReason)})`;
    default:
      return 'unknown';
  }
}

/**
 * Placement state machine.
 *
 * Invariants covered by tests:
 * - A selected anchor disappears  -> confirmation is invalidated and the object
 *   requires re-placement (no silent camera-relative fallback).
 * - Tracking leaves `normal`      -> confirmation is invalidated and placing/confirming
 *   is blocked until tracking recovers.
 * - Reset / place again           -> selection and confirmation are cleared together.
 * - Scaling                       -> base contact with the plane is preserved.
 */
export function arPlacementReducer(
  state: ARPlacementState,
  action: ARPlacementAction
): ARPlacementState {
  switch (action.type) {
    case 'session/start':
      return createInitialARPlacementState(action.sessionId);

    case 'planes/changed': {
      if (state.planeCount === action.planeCount) return state;

      let phase = state.phase;
      if (phase === 'scanning' && action.planeCount > 0) {
        phase = 'surface-available';
      } else if (phase === 'surface-available' && action.planeCount === 0) {
        phase = 'scanning';
      }

      return { ...state, planeCount: action.planeCount, phase };
    }

    case 'plane/selected': {
      if (!state.trackingUsable) {
        // Never accept a placement without usable tracking.
        return {
          ...state,
          phase: 'placement-invalid',
          anchorId: null,
          tapWorldPosition: null,
          confirmedAt: null,
          invalidReason: 'tracking-not-usable',
        };
      }

      return {
        ...state,
        phase: 'placed',
        anchorId: action.anchorId,
        tapWorldPosition: action.tapWorldPosition,
        planeLocalOrigin: [0, 0, 0],
        rotationYawDeg: 0,
        scale: 1,
        confirmedAt: null,
        invalidReason: null,
      };
    }

    case 'anchor/removed': {
      if (state.anchorId !== action.anchorId) return state;

      // The plane the object was anchored to is gone: invalidate the placement and
      // require the user to place again. No camera-relative fallback.
      return {
        ...state,
        phase: 'placement-invalid',
        anchorId: null,
        tapWorldPosition: null,
        confirmedAt: null,
        invalidReason: 'anchor-removed',
      };
    }

    case 'tracking/changed': {
      const trackingUsable = isTrackingUsable(action.trackingState);
      if (
        state.trackingState === action.trackingState &&
        state.trackingReason === action.trackingReason &&
        state.trackingUsable === trackingUsable
      ) {
        return state;
      }

      const next: ARPlacementState = {
        ...state,
        trackingState: action.trackingState,
        trackingReason: action.trackingReason,
        trackingUsable,
      };

      if (!trackingUsable && state.phase === 'confirmed') {
        // Invalidate confirmation on tracking loss, but keep the object visible so the
        // user can confirm again once tracking recovers.
        return {
          ...next,
          phase: 'placed',
          confirmedAt: null,
          invalidReason: 'tracking-not-usable',
        };
      }

      return next;
    }

    case 'transform/rotate': {
      if (state.phase !== 'placed') return state;
      return { ...state, rotationYawDeg: rotateYaw(state.rotationYawDeg, action.direction) };
    }

    case 'transform/scale': {
      if (state.phase !== 'placed') return state;
      return { ...state, scale: nextScale(state.scale, action.direction) };
    }

    case 'placement/clear': {
      // "Place again": clear the old selection and show surfaces again.
      return {
        ...state,
        phase: state.planeCount > 0 ? 'surface-available' : 'scanning',
        anchorId: null,
        tapWorldPosition: null,
        planeLocalOrigin: [0, 0, 0],
        rotationYawDeg: 0,
        scale: 1,
        confirmedAt: null,
        invalidReason: null,
      };
    }

    case 'placement/confirm': {
      if (state.phase !== 'placed' || !state.trackingUsable || !state.anchorId) return state;
      return {
        ...state,
        phase: 'confirmed',
        confirmedAt: action.at,
        invalidReason: null,
      };
    }

    case 'placement/edit': {
      if (state.phase !== 'confirmed') return state;
      return { ...state, phase: 'placed', confirmedAt: null };
    }

    default:
      return state;
  }
}

export function canConfirm(state: ARPlacementState): boolean {
  return state.phase === 'placed' && state.trackingUsable && state.anchorId !== null;
}

export function canAdjust(state: ARPlacementState): boolean {
  return state.phase === 'placed';
}

export function statusCopy(status: ARPlacementStatus): string {
  switch (status.phase) {
    case 'scanning':
      return 'Move your phone slowly to find a floor or table.';
    case 'surface-available':
      return 'Tap a highlighted surface.';
    case 'placed':
      return status.trackingUsable
        ? 'Adjust the pot, then confirm.'
        : 'Tracking interrupted — hold still until tracking recovers.';
    case 'confirmed':
      return 'Placement confirmed.';
    case 'placement-invalid':
      return status.invalidReason === 'anchor-removed'
        ? 'The surface was lost. Tap a highlighted surface to place again.'
        : 'Tracking was not usable, so nothing was placed. Tap a highlighted surface.';
    default:
      return '';
  }
}
