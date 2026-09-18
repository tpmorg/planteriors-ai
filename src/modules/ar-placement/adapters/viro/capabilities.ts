import type { AdapterCapabilities, CapabilityEvidence } from '../../core/types';

const VERSION = '2.53.1';

function row(
  jsSymbol: string,
  shape: string,
  nativeEvidence: string,
  ownership: string,
  failureBehavior: string
): CapabilityEvidence {
  return {
    jsSymbol,
    shape,
    nativeEvidence,
    ownership,
    failureBehavior,
    deviceValidation: 'device-pending',
  };
}

export const VIRO_ANCHORING_STRATEGY = 'library-owned-plane-attachment' as const;

export const VIRO_CAPABILITIES: AdapterCapabilities = {
  adapterId: 'viro',
  strategy: VIRO_ANCHORING_STRATEGY,
  platform: 'unknown',
  viroVersion: VERSION,
  support: row(
    'isARSupportedOnDevice, NativeModules.VRTARSceneNavigatorModule',
    '{ isARSupported: boolean }',
    'JS export plus native module names in 2.53.1',
    'host probe before import',
    'unsupported / missing-native-module'
  ),
  sessionLifecycle: row(
    'ViroARSceneNavigator mount/unmount',
    'navigator present while starting|running',
    'component unmount releases the session in the installed JS',
    'ViroSessionView',
    'onError → native-error; background unmount → stop'
  ),
  planeDiscovery: row(
    'ViroARScene onAnchorFound/Updated/Removed',
    'ViroAnchor: id, type, position, rotation(deg), width/height, alignment, vertices?',
    'components/Types/ViroEvents.ts ViroAnchor; onAnchorRemoved may be undefined',
    'JS registry keyed by nativeId',
    'malformed payloads recorded and ignored'
  ),
  planeReplacement: row(
    'none',
    'parent identity not present on ViroAnchor',
    'no subsumedBy/parent field in 2.53.1 types',
    'unsupported',
    'surfaceReplacement: unsupported; no synthesized ids'
  ),
  tracking: row(
    'onTrackingUpdated(state, reason)',
    'UNAVAILABLE=1 LIMITED=2 NORMAL=3; reasons none/motion/features',
    'ViroConstants.ts mirrored values',
    'session tracking axis',
    'non-normal tracking invalidates confirmation'
  ),
  hitTesting: row(
    'ViroARScene.performARHitTestWithPoint(x,y)',
    'ViroARHitTestResult[] with type, transform, _hitResultId; no plane id',
    'ViroARScene.tsx + ViroEvents.ts; hit tokens expire in 30s',
    'adapter, discarded after one sample',
    'empty/estimated hits are not confirmed placements'
  ),
  anchorCreate: row(
    'createAnchoredNode(hitResult)',
    'Promise<ViroARNodeReference | null>',
    'comment: ViroARNode is not yet implemented; not used',
    'not selected',
    'callable method is not a proven create/render/update/release lifecycle'
  ),
  anchorRender: row(
    'ViroARPlane anchorId={nativeId}',
    'children in plane-local space',
    'ViroARPlane.tsx native VRTARPlane',
    'library-owned plane attachment',
    'unmount removes the view; not labeled as native anchor detach'
  ),
  anchorRelease: row(
    'unmount ViroARPlane children / component',
    'no explicit detach API for createAnchoredNode',
    'no releaseAnchoredNode in 2.53.1 JS',
    'adapter-owned JS handles + view unmount',
    'pending release retained on failure'
  ),
  contentSelection: row(
    'explicit object list (Viro onClick declared, unverified)',
    'select(objectId)',
    'onClick exists on ViroBase; not device-verified',
    'controller selection',
    'object-not-found'
  ),
  frameData: row(
    'event.at from controller clock; nativeTime optional',
    'plane events have no documented timestamp',
    'onCameraARHitTest has cameraOrientation array',
    'controller',
    'missing native timestamps stay null'
  ),
  surfaceReplacement: 'unsupported',
  placementIndependence: 'plane-dependent',
  objectPicking: 'declared-unverified',
  requiresNativeView: true,
  pollHitTest: true,
};

export const VIRO_NATIVE_MODULE_NAMES = {
  navigator: 'VRTARSceneNavigatorModule',
  iosUtils: 'VRTARUtils',
} as const;
