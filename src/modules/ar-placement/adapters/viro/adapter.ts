import { NativeModules, Platform } from 'react-native';
import { Camera } from 'expo-camera';

import { identityPose, isFiniteVec3, quatFromViroEulerDegrees } from '../../core/coordinates';
import { err, ok, type CommandResult, type CreatePlacementRequest, type HitType, type NormalizedEvent, type PlacementAdapter, type SurfaceAlignment, type TrackingReason, type TrackingState } from '../../core/types';
import { VIRO_CAPABILITIES, VIRO_NATIVE_MODULE_NAMES } from './capabilities';
import type { ViroARHitTestResult, ViroAnchor } from './nativeImports';

export interface ViroSceneBinder {
  hitTestCenter(): Promise<ViroARHitTestResult[] | null>;
}

export function hasViroNativeModules(): boolean {
  try {
    const modules = NativeModules as Record<string, unknown>;
    if (!modules?.[VIRO_NATIVE_MODULE_NAMES.navigator]) return false;
    if (Platform.OS === 'ios' && !modules[VIRO_NATIVE_MODULE_NAMES.iosUtils]) return false;
    return true;
  } catch {
    return false;
  }
}

export class ViroPlacementAdapter implements PlacementAdapter {
  capabilities = {
    ...VIRO_CAPABILITIES,
    platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'unknown',
  } as const;
  readonly handles = new Set<string>();
  private binder: ViroSceneBinder | null = null;
  private generation = 0;

  bindScene(binder: ViroSceneBinder): void {
    this.binder = binder;
  }

  unbindScene(): void {
    this.binder = null;
  }

  async checkEnvironment(): Promise<CommandResult<{ platform: { os: string; version?: string } | null }>> {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      return err('unsupported', 'AR needs a physical iOS or Android phone', false);
    }
    if (!hasViroNativeModules()) {
      return err('unsupported', 'Viro native modules are not present in this build', false);
    }
    try {
      const current = await Camera.getCameraPermissionsAsync();
      let granted = current.granted;
      if (!granted && current.canAskAgain) {
        granted = (await Camera.requestCameraPermissionsAsync()).granted;
      }
      if (!granted) return err('permission-denied', 'Camera permission is off', true);
    } catch {
      return err('permission-denied', 'Camera permission could not be checked', true);
    }
    try {
      const bridge = await import('./nativeImports');
      const support = await bridge.isARSupportedOnDevice();
      if (!support?.isARSupported) {
        return err('unsupported', 'isARSupportedOnDevice reported false', false);
      }
    } catch {
      return err('unsupported', 'Viro JS module failed to load', false);
    }
    return ok({ platform: { os: Platform.OS, version: String(Platform.Version) } });
  }

  async startSession(generation: number): Promise<CommandResult> {
    this.generation = generation;
    return ok(undefined);
  }

  async stopSession(): Promise<CommandResult> {
    this.unbindScene();
    this.handles.clear();
    return ok(undefined);
  }

  async hitTest(generation: number): Promise<NormalizedEvent | null> {
    if (generation !== this.generation || !this.binder) return null;
    const results = await this.binder.hitTestCenter();
    if (!results || results.length === 0) {
      return { type: 'hit.empty', generation, at: Date.now() };
    }
    const chosen =
      results.find((result) => result.type === 'ExistingPlaneUsingExtent') ??
      results.find((result) => result.type === 'ExistingPlane') ??
      results[0];
    const position = chosen?.transform?.position;
    const rotation = chosen?.transform?.rotation;
    if (!isFiniteVec3(position)) {
      return { type: 'hit.empty', generation, at: Date.now() };
    }
    return {
      type: 'hit.sample',
      generation,
      at: Date.now(),
      hitType: mapHitType(chosen.type),
      pose: {
        position,
        rotation: isFiniteVec3(rotation) ? quatFromViroEulerDegrees(rotation) : identityPose().rotation,
      },
    };
  }

  async createPlacement(request: CreatePlacementRequest) {
    const handleId = `viro-plane:${request.nativeSurfaceId}:${request.objectId}`;
    this.handles.add(handleId);
    return ok({ handleId, objectId: request.objectId, nativeSurfaceId: request.nativeSurfaceId });
  }

  async releasePlacement(handleId: string) {
    this.handles.delete(handleId);
    return ok(undefined);
  }
}

export function createViroAdapter(): ViroPlacementAdapter {
  return new ViroPlacementAdapter();
}

export function mapAnchor(anchor: ViroAnchor, generation: number, at: number): NormalizedEvent | null {
  if (!anchor?.anchorId || anchor.type !== 'plane') return null;
  if (!isFiniteVec3(anchor.position) || !isFiniteVec3(anchor.rotation)) return null;
  return {
    type: 'surface.upsert',
    generation,
    at,
    nativeId: anchor.anchorId,
    alignment: mapAlignment(anchor.alignment),
    pose: {
      position: anchor.position,
      rotation: quatFromViroEulerDegrees(anchor.rotation),
    },
    extent:
      Number.isFinite(anchor.width) && Number.isFinite(anchor.height)
        ? { width: anchor.width as number, height: anchor.height as number }
        : undefined,
    boundary: Array.isArray(anchor.vertices) ? (anchor.vertices as [number, number, number][]) : undefined,
  };
}

export function mapTracking(state: number, reason: number): { state: TrackingState; reason: TrackingReason } {
  return {
    state: state === 3 ? 'normal' : state === 2 ? 'limited' : state === 1 ? 'unavailable' : 'unknown',
    reason: reason === 3 ? 'insufficient-features' : reason === 2 ? 'excessive-motion' : reason === 1 ? 'none' : 'unknown',
  };
}

function mapAlignment(alignment?: string): SurfaceAlignment {
  if (alignment === 'HorizontalUpward' || alignment === 'Horizontal') return 'horizontal-upward';
  if (alignment === 'HorizontalDownward') return 'horizontal-downward';
  if (alignment === 'Vertical') return 'vertical';
  return 'unknown';
}

function mapHitType(type: ViroARHitTestResult['type']): HitType {
  switch (type) {
    case 'ExistingPlaneUsingExtent':
      return 'existing-plane-extent';
    case 'ExistingPlane':
      return 'existing-plane';
    case 'EstimatedHorizontalPlane':
      return 'estimated-horizontal';
    case 'FeaturePoint':
      return 'feature-point';
    case 'DepthPoint':
      return 'depth-point';
    default:
      return 'none';
  }
}
