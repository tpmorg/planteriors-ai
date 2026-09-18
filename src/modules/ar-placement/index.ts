export { useARPlacement, type UseARPlacementOptions } from './react/useARPlacement';
export { ARPlacementView } from './react/ARPlacementView';
export { createViroAdapter, ViroPlacementAdapter } from './adapters/viro/adapter';
export { createFakeAdapter, FakeAdapter } from './adapters/fake/fakeAdapter';
export { createController, ARPlacementController } from './core/controller';
export { DEFAULT_POLICY } from './core/types';
export type { RenderObject, RenderObjectContext } from './adapters/viro/ViroContent';
export type {
  AdapterCapabilities,
  ARPlacementCallbacks,
  ARSnapshot,
  CommandError,
  CommandResult,
  ContentDescriptor,
  FeedbackSnapshot,
  ObjectSnapshot,
  PlacementPolicy,
  SurfaceSnapshot,
  TargetSnapshot,
} from './core/types';
export { EVENT_SCHEMA_VERSION } from './diagnostics/schema';
export type { DiagnosticReport } from './diagnostics/schema';
