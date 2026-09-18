import {
  NOMINAL_POT_HEIGHT_M,
  NOMINAL_POT_WIDTH_M,
  MAX_SCALE,
  MIN_SCALE,
  ROTATION_STEP_DEG,
  TRACKING_REASON,
  TRACKING_STATE,
  arPlacementReducer,
  canConfirm,
  clampScale,
  createInitialARPlacementState,
  getBaseContactOffsetY,
  getPlacementSnapshot,
  getPotDimensions,
  isBaseOnSurface,
  nextScale,
  normalizeYaw,
  rotateYaw,
} from '../placementState';
import type { ARPlacementState } from '../placementState';

const SESSION_ID = 'session-test';
const NORMAL = TRACKING_STATE.NORMAL;
const REASON_NONE = TRACKING_REASON.NONE;

function base(): ARPlacementState {
  return createInitialARPlacementState(SESSION_ID);
}

function withPlanes(planeCount: number, state: ARPlacementState = base()): ARPlacementState {
  return arPlacementReducer(state, { type: 'planes/changed', planeCount });
}

function trackingNormal(state: ARPlacementState): ARPlacementState {
  return arPlacementReducer(state, {
    type: 'tracking/changed',
    trackingState: NORMAL,
    trackingReason: REASON_NONE,
  });
}

function placedState(): ARPlacementState {
  return arPlacementReducer(trackingNormal(withPlanes(1)), {
    type: 'plane/selected',
    anchorId: 'anchor-1',
    tapWorldPosition: [0.5, 0, -1],
  });
}

function confirmedState(): ARPlacementState {
  return arPlacementReducer(placedState(), { type: 'placement/confirm', at: 1234 });
}

describe('arPlacementReducer', () => {
  it('starts scanning without a selection', () => {
    const state = base();

    expect(state.phase).toBe('scanning');
    expect(state.anchorId).toBeNull();
    expect(state.confirmedAt).toBeNull();
    expect(state.scale).toBe(1);
    expect(state.rotationYawDeg).toBe(0);
    expect(state.trackingUsable).toBe(false);
    expect(state.planeLocalOrigin).toEqual([0, 0, 0]);
  });

  it('moves between scanning and surface-available as planes appear and disappear', () => {
    const available = withPlanes(2);
    expect(available.phase).toBe('surface-available');
    expect(available.planeCount).toBe(2);

    const backToScanning = withPlanes(0, available);
    expect(backToScanning.phase).toBe('scanning');
  });

  it('ignores a redundant plane count update', () => {
    const available = withPlanes(1);
    expect(withPlanes(1, available)).toBe(available);
  });

  it('places the object only while tracking is normal', () => {
    const rejected = arPlacementReducer(withPlanes(1), {
      type: 'plane/selected',
      anchorId: 'anchor-1',
      tapWorldPosition: [0, 0, 0],
    });

    expect(rejected.phase).toBe('placement-invalid');
    expect(rejected.anchorId).toBeNull();
    expect(rejected.invalidReason).toBe('tracking-not-usable');

    const placed = placedState();
    expect(placed.phase).toBe('placed');
    expect(placed.anchorId).toBe('anchor-1');
    expect(placed.tapWorldPosition).toEqual([0.5, 0, -1]);
    // The tap transform is applied by the selector, so the local origin stays at zero.
    expect(placed.planeLocalOrigin).toEqual([0, 0, 0]);
  });

  it('keeps a snapshot only after a valid placement', () => {
    expect(getPlacementSnapshot(withPlanes(1))).toBeNull();

    const snapshot = getPlacementSnapshot(placedState());
    expect(snapshot).not.toBeNull();
    expect(snapshot?.anchorId).toBe('anchor-1');
    expect(snapshot?.sessionId).toBe(SESSION_ID);
    expect(snapshot?.widthM).toBeCloseTo(NOMINAL_POT_WIDTH_M, 6);
    expect(snapshot?.heightM).toBeCloseTo(NOMINAL_POT_HEIGHT_M, 6);
    expect(snapshot?.confirmedAt).toBeNull();
  });

  it('invalidates a confirmed placement when its anchor disappears', () => {
    const confirmed = confirmedState();
    expect(confirmed.phase).toBe('confirmed');
    expect(confirmed.confirmedAt).toBe(1234);

    const afterRemoval = arPlacementReducer(confirmed, {
      type: 'anchor/removed',
      anchorId: 'anchor-1',
    });

    expect(afterRemoval.phase).toBe('placement-invalid');
    expect(afterRemoval.anchorId).toBeNull();
    expect(afterRemoval.confirmedAt).toBeNull();
    expect(afterRemoval.invalidReason).toBe('anchor-removed');
    expect(getPlacementSnapshot(afterRemoval)).toBeNull();
  });

  it('invalidates an unconfirmed placement when its anchor disappears', () => {
    const afterRemoval = arPlacementReducer(placedState(), {
      type: 'anchor/removed',
      anchorId: 'anchor-1',
    });

    expect(afterRemoval.phase).toBe('placement-invalid');
    expect(afterRemoval.anchorId).toBeNull();
    expect(afterRemoval.invalidReason).toBe('anchor-removed');
  });

  it('ignores removal of an unrelated anchor', () => {
    const placed = placedState();
    const unchanged = arPlacementReducer(placed, {
      type: 'anchor/removed',
      anchorId: 'some-other-anchor',
    });

    expect(unchanged).toBe(placed);
  });

  it('invalidates confirmation when tracking is lost, without removing the object', () => {
    const confirmed = confirmedState();

    const degraded = arPlacementReducer(confirmed, {
      type: 'tracking/changed',
      trackingState: TRACKING_STATE.LIMITED,
      trackingReason: TRACKING_REASON.INSUFFICIENT_FEATURES,
    });

    expect(degraded.phase).toBe('placed');
    expect(degraded.confirmedAt).toBeNull();
    expect(degraded.invalidReason).toBe('tracking-not-usable');
    expect(degraded.anchorId).toBe('anchor-1');
    expect(degraded.trackingUsable).toBe(false);
    expect(getPlacementSnapshot(degraded)).not.toBeNull();
  });

  it('does not re-emit tracking state when nothing changed', () => {
    const normal = trackingNormal(withPlanes(1));
    const same = arPlacementReducer(normal, {
      type: 'tracking/changed',
      trackingState: NORMAL,
      trackingReason: REASON_NONE,
    });

    expect(same).toBe(normal);
  });

  it('only confirms a placed object with usable tracking', () => {
    expect(arPlacementReducer(placedState(), { type: 'placement/confirm', at: 1 }).phase).toBe(
      'confirmed'
    );

    const beforePlacement = trackingNormal(withPlanes(1));
    expect(arPlacementReducer(beforePlacement, { type: 'placement/confirm', at: 1 }).phase).toBe(
      'surface-available'
    );

    const trackingLost = arPlacementReducer(placedState(), {
      type: 'tracking/changed',
      trackingState: TRACKING_STATE.LIMITED,
      trackingReason: TRACKING_REASON.EXCESSIVE_MOTION,
    });
    expect(canConfirm(trackingLost)).toBe(false);
    expect(arPlacementReducer(trackingLost, { type: 'placement/confirm', at: 1 }).phase).toBe(
      'placed'
    );
  });

  it('unfreezes a confirmed placement when editing', () => {
    const edited = arPlacementReducer(confirmedState(), { type: 'placement/edit' });

    expect(edited.phase).toBe('placed');
    expect(edited.confirmedAt).toBeNull();
    expect(edited.anchorId).toBe('anchor-1');
  });

  it('clears the selection and confirmation when placing again', () => {
    const cleared = arPlacementReducer(confirmedState(), { type: 'placement/clear' });

    expect(cleared.phase).toBe('surface-available');
    expect(cleared.anchorId).toBeNull();
    expect(cleared.tapWorldPosition).toBeNull();
    expect(cleared.confirmedAt).toBeNull();
    expect(cleared.scale).toBe(1);
    expect(cleared.rotationYawDeg).toBe(0);
    expect(getPlacementSnapshot(cleared)).toBeNull();
  });

  it('returns to scanning when place again runs with no detected planes', () => {
    const placed = placedState();
    const noPlanes = arPlacementReducer(placed, { type: 'planes/changed', planeCount: 0 });
    const cleared = arPlacementReducer(noPlanes, { type: 'placement/clear' });

    expect(cleared.phase).toBe('scanning');
    expect(cleared.anchorId).toBeNull();
  });

  it('starts a clean session on session/start', () => {
    const restarted = arPlacementReducer(confirmedState(), {
      type: 'session/start',
      sessionId: 'session-2',
    });

    expect(restarted).toEqual(createInitialARPlacementState('session-2'));
    expect(restarted.sessionId).toBe('session-2');
    expect(restarted.anchorId).toBeNull();
    expect(restarted.confirmedAt).toBeNull();
  });

  it('only rotates and scales while placed', () => {
    const placed = placedState();
    const rotated = arPlacementReducer(placed, { type: 'transform/rotate', direction: 'right' });
    expect(rotated.rotationYawDeg).toBe(ROTATION_STEP_DEG);

    const scaled = arPlacementReducer(placed, { type: 'transform/scale', direction: 'larger' });
    expect(scaled.scale).toBeCloseTo(1.1, 6);

    const confirmed = confirmedState();
    expect(
      arPlacementReducer(confirmed, { type: 'transform/rotate', direction: 'right' })
    ).toBe(confirmed);
    expect(arPlacementReducer(confirmed, { type: 'transform/scale', direction: 'larger' })).toBe(
      confirmed
    );
  });
});

describe('scale and rotation helpers', () => {
  it('clamps scale to the supported range', () => {
    expect(clampScale(0.1)).toBe(MIN_SCALE);
    expect(clampScale(5)).toBe(MAX_SCALE);
    expect(clampScale(Number.NaN)).toBe(1);
  });

  it('steps scale within bounds and never overshoots', () => {
    expect(nextScale(1, 'larger')).toBeCloseTo(1.1, 6);
    expect(nextScale(1, 'smaller')).toBeCloseTo(0.9, 6);
    expect(nextScale(MIN_SCALE, 'smaller')).toBe(MIN_SCALE);
    expect(nextScale(MAX_SCALE, 'larger')).toBe(MAX_SCALE);

    let scale = 1;
    for (let i = 0; i < 50; i += 1) {
      scale = nextScale(scale, 'larger');
    }
    expect(scale).toBe(MAX_SCALE);

    for (let i = 0; i < 50; i += 1) {
      scale = nextScale(scale, 'smaller');
    }
    expect(scale).toBe(MIN_SCALE);
  });

  it('rotates in 15 degree steps and wraps around', () => {
    expect(rotateYaw(0, 'right')).toBe(15);
    expect(rotateYaw(0, 'left')).toBe(345);
    expect(rotateYaw(355, 'right')).toBe(10);
    expect(rotateYaw(345, 'right')).toBe(0);
    // Left and right are one 15 degree step either side of the current yaw, and the yaw
    // wraps within [0, 360).
    expect(normalizeYaw(rotateYaw(10, 'left') + 2 * ROTATION_STEP_DEG)).toBe(
      rotateYaw(10, 'right')
    );
  });

  it('scales the reported dimensions with the scale factor', () => {
    expect(getPotDimensions(2).widthM).toBeCloseTo(NOMINAL_POT_WIDTH_M * 2, 6);
    expect(getPotDimensions(2).heightM).toBeCloseTo(NOMINAL_POT_HEIGHT_M * 2, 6);
    // Out-of-range values are clamped before use.
    expect(getPotDimensions(99).heightM).toBeCloseTo(NOMINAL_POT_HEIGHT_M * MAX_SCALE, 6);
  });

  it('preserves base contact with the plane across the full scale range', () => {
    for (const scale of [MIN_SCALE, 0.75, 1, 1.33, MAX_SCALE]) {
      const offset = getBaseContactOffsetY(scale);
      expect(isBaseOnSurface(offset, scale)).toBe(true);

      // base Y in plane space = offset - (half the scaled height) = 0
      const baseY = offset - (NOMINAL_POT_HEIGHT_M * scale) / 2;
      expect(baseY).toBeCloseTo(0, 9);
    }

    // A centred assembly without the half-height offset would sink into the surface.
    expect(isBaseOnSurface(0, 1)).toBe(false);
    expect(isBaseOnSurface(getBaseContactOffsetY(1), 2)).toBe(false);
  });
});

describe('tracking constants parity with @reactvision/react-viro@2.53.1', () => {
  // Deep import of a pure constants module (no native imports) so the mirrored values
  // cannot silently drift from the installed release.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const viroConstants = require('@reactvision/react-viro/dist/components/ViroConstants');

  it('matches ViroTrackingStateConstants', () => {
    expect(TRACKING_STATE.UNAVAILABLE).toBe(
      viroConstants.ViroTrackingStateConstants.TRACKING_UNAVAILABLE
    );
    expect(TRACKING_STATE.LIMITED).toBe(viroConstants.ViroTrackingStateConstants.TRACKING_LIMITED);
    expect(TRACKING_STATE.NORMAL).toBe(viroConstants.ViroTrackingStateConstants.TRACKING_NORMAL);
  });

  it('matches ViroARTrackingReasonConstants', () => {
    expect(TRACKING_REASON.NONE).toBe(
      viroConstants.ViroARTrackingReasonConstants.TRACKING_REASON_NONE
    );
    expect(TRACKING_REASON.EXCESSIVE_MOTION).toBe(
      viroConstants.ViroARTrackingReasonConstants.TRACKING_REASON_EXCESSIVE_MOTION
    );
    expect(TRACKING_REASON.INSUFFICIENT_FEATURES).toBe(
      viroConstants.ViroARTrackingReasonConstants.TRACKING_REASON_INSUFFICIENT_FEATURES
    );
  });
});
