export const EVENT_SCHEMA_VERSION = 1;

export type Vec3 = readonly [number, number, number];
export type Quat = readonly [number, number, number, number];

export interface Pose {
  position: Vec3;
  rotation: Quat;
}

export type SessionLifecycle =
  | 'idle'
  | 'checking'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'interrupted'
  | 'failed';

export type TrackingState = 'unavailable' | 'limited' | 'normal' | 'unknown';
export type TrackingReason =
  | 'none'
  | 'excessive-motion'
  | 'insufficient-features'
  | 'unknown';

export type SurfaceAlignment =
  | 'horizontal-upward'
  | 'horizontal-downward'
  | 'vertical'
  | 'unknown';

export type HitType =
  | 'existing-plane-extent'
  | 'existing-plane'
  | 'estimated-horizontal'
  | 'feature-point'
  | 'depth-point'
  | 'none';

export type PlacementLifecycle =
  | 'placing'
  | 'placed'
  | 'moving'
  | 'confirmed'
  | 'lost'
  | 'removing';

export type CommandErrorCode =
  | 'unsupported'
  | 'permission-denied'
  | 'inactive-session'
  | 'tracking-limited'
  | 'no-valid-target'
  | 'stale-target'
  | 'limit-reached'
  | 'object-not-found'
  | 'operation-cancelled'
  | 'anchor-create-failed'
  | 'anchor-release-failed'
  | 'session-busy'
  | 'native-error'
  | 'malformed-event';

export interface CommandError {
  code: CommandErrorCode;
  recoverable: boolean;
  message: string;
}

export type CommandResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; error: CommandError };

export type AnchoringStrategy =
  | 'explicit-app-owned-anchors'
  | 'library-owned-plane-attachment'
  | 'targeted-adapter-extension';

export type EvidenceStatus = 'source' | 'declared' | 'device-pending' | 'unsupported' | 'unknown';

export interface CapabilityEvidence {
  jsSymbol: string;
  shape: string;
  nativeEvidence: string;
  ownership: string;
  failureBehavior: string;
  deviceValidation: EvidenceStatus;
}

export interface AdapterCapabilities {
  adapterId: string;
  strategy: AnchoringStrategy;
  platform: 'ios' | 'android' | 'unknown';
  viroVersion: string;
  support: CapabilityEvidence;
  sessionLifecycle: CapabilityEvidence;
  planeDiscovery: CapabilityEvidence;
  planeReplacement: CapabilityEvidence;
  tracking: CapabilityEvidence;
  hitTesting: CapabilityEvidence;
  anchorCreate: CapabilityEvidence;
  anchorRender: CapabilityEvidence;
  anchorRelease: CapabilityEvidence;
  contentSelection: CapabilityEvidence;
  frameData: CapabilityEvidence;
  surfaceReplacement: 'unsupported' | 'native' | 'unknown';
  placementIndependence: 'plane-dependent' | 'independent' | 'unknown';
  objectPicking: 'unsupported' | 'declared-unverified' | 'verified';
  requiresNativeView: boolean;
  pollHitTest: boolean;
}

export interface PlacementPolicy {
  surface: 'horizontal-upward';
  maxObjects: number;
  hitTestHz: number;
  readyStableMs: number;
  maxTargetAgeMs: number;
  rangeMinM: number;
  rangeMaxM: number;
  hysteresisMs: number;
  minExtentM: number;
}

export const DEFAULT_POLICY: PlacementPolicy = {
  surface: 'horizontal-upward',
  maxObjects: 1,
  hitTestHz: 10,
  readyStableMs: 300,
  maxTargetAgeMs: 250,
  rangeMinM: 0.3,
  rangeMaxM: 3,
  hysteresisMs: 150,
  minExtentM: 0.1,
};

export interface ContentDescriptor {
  contentId: string;
  dimensions: { width: number; height: number; depth: number };
  pivot: Vec3;
  minScale: number;
  maxScale: number;
}

export interface SessionSnapshot {
  generation: number;
  sessionId: string;
  lifecycle: SessionLifecycle;
  tracking: TrackingState;
  trackingReason: TrackingReason;
  startedAt: number | null;
  failure: CommandError | null;
  platform: { os: string; version?: string } | null;
  placementsClearedOnRestart: boolean;
}

export interface SurfaceEligibility {
  eligible: boolean;
  reasons: string[];
}

export interface SurfaceSnapshot {
  id: string;
  alignment: SurfaceAlignment;
  pose: Pose;
  extent: { width: number; height: number } | null;
  boundary: Vec3[] | null;
  firstObservedAt: number;
  lastUpdatedAt: number;
  replacedById: string | null;
  eligibility: SurfaceEligibility;
  nativePresent: boolean;
}

export interface TargetSnapshot {
  generation: number;
  version: number;
  hitType: HitType;
  surfaceId: string | null;
  pose: Pose;
  planeLocalPosition: Vec3 | null;
  sampleTime: number;
  eligible: boolean;
  rejectionReasons: string[];
  stableMs: number;
  ready: boolean;
  readyIsHeuristic: true;
  fit: 'fits' | 'unknown' | 'too-large';
}

export interface LocalTransform {
  translation: Vec3;
  yawRadians: number;
  scale: number;
}

export interface ObjectSnapshot {
  id: string;
  contentId: string;
  lifecycle: PlacementLifecycle;
  surfaceId: string | null;
  pose: Pose;
  localTransform: LocalTransform;
  dimensions: { width: number; height: number; depth: number };
  pivot: Vec3;
  confirmed: boolean;
  lostReason: string | null;
}

export type FeedbackSeverity = 'fatal' | 'error' | 'warning' | 'info' | 'success';

export interface FeedbackSnapshot {
  code: string;
  severity: FeedbackSeverity;
  params: Record<string, string | number | boolean>;
  heuristic: boolean;
}

export interface DiagnosticCounters {
  eventCount: number;
  droppedEvents: number;
  pendingOperations: number;
  nativeSurfaceCount: number;
  acceptedSurfaceCount: number;
  ownedPlacementCount: number;
  pendingReleaseCount: number;
  recorderTruncated: boolean;
  recorderDiagnosticOnly: boolean;
  resourceCountKind: 'adapter-owned' | 'estimated' | 'native-measured';
}

export interface ARSnapshot {
  capabilities: AdapterCapabilities;
  policy: PlacementPolicy;
  session: SessionSnapshot;
  surfaces: SurfaceSnapshot[];
  target: TargetSnapshot | null;
  objects: ObjectSnapshot[];
  selection: string | null;
  feedback: FeedbackSnapshot;
  diagnostics: DiagnosticCounters;
}

export interface ARPlacementCallbacks {
  onTrackingChanged?: (tracking: TrackingState, reason: TrackingReason) => void;
  onSurfaceAdded?: (surface: SurfaceSnapshot) => void;
  onSurfaceUpdated?: (surface: SurfaceSnapshot) => void;
  onSurfaceRemoved?: (surfaceId: string) => void;
  onSurfaceReplaced?: (fromId: string, toId: string) => void;
  onTargetChanged?: (target: TargetSnapshot | null) => void;
  onPlacementChanged?: (object: ObjectSnapshot) => void;
  onPlacementLost?: (objectId: string, reason: string) => void;
  onError?: (error: CommandError) => void;
  onSessionRestarted?: () => void;
}

export type EventSource = 'native' | 'command' | 'effect' | 'lifecycle';

export interface EventEnvelope<TPayload = unknown> {
  schemaVersion: number;
  sessionId: string;
  generation: number;
  seq: number;
  at: number;
  nativeTime: number | null;
  source: EventSource;
  operationId: string | null;
  type: string;
  payload: TPayload;
}

export type NormalizedEvent =
  | {
      type: 'session.nativeReady';
      generation: number;
      at: number;
      platform?: { os: string; version?: string };
    }
  | {
      type: 'session.nativeError';
      generation: number;
      at: number;
      message: string;
      recoverable: boolean;
    }
  | {
      type: 'session.interrupted';
      generation: number;
      at: number;
    }
  | {
      type: 'tracking.changed';
      generation: number;
      at: number;
      nativeTime?: number | null;
      state: TrackingState;
      reason: TrackingReason;
    }
  | {
      type: 'surface.upsert';
      generation: number;
      at: number;
      nativeTime?: number | null;
      nativeId: string;
      alignment: SurfaceAlignment;
      pose: Pose;
      extent?: { width: number; height: number };
      boundary?: Vec3[];
      nativeTrackingState?: string;
    }
  | {
      type: 'surface.remove';
      generation: number;
      at: number;
      nativeId: string;
    }
  | {
      type: 'surface.replace';
      generation: number;
      at: number;
      childNativeId: string;
      parentNativeId: string;
    }
  | {
      type: 'hit.sample';
      generation: number;
      at: number;
      nativeTime?: number | null;
      hitType: HitType;
      pose: Pose;
      distanceM?: number;
      surfaceNativeId?: string;
    }
  | {
      type: 'hit.empty';
      generation: number;
      at: number;
    };

export interface CreatePlacementRequest {
  objectId: string;
  contentId: string;
  surfaceId: string;
  nativeSurfaceId: string;
  pose: Pose;
  localTransform: LocalTransform;
  generation: number;
  operationId: string;
}

export interface AdapterPlacementHandle {
  handleId: string;
  objectId: string;
  nativeSurfaceId: string;
}

export interface PlacementAdapter {
  capabilities: AdapterCapabilities;
  checkEnvironment(): Promise<CommandResult<{ platform: { os: string; version?: string } | null }>>;
  startSession(generation: number): Promise<CommandResult>;
  stopSession(generation: number): Promise<CommandResult>;
  hitTest(generation: number): Promise<NormalizedEvent | null>;
  createPlacement(
    request: CreatePlacementRequest
  ): Promise<CommandResult<AdapterPlacementHandle>>;
  releasePlacement(handleId: string, generation: number): Promise<CommandResult>;
}

export interface RuntimeClock {
  now(): number;
}

export interface IdSource {
  sessionId(): string;
  objectId(): string;
  operationId(): string;
  controllerId(): string;
  surfaceId(nativeId: string): string;
}

export interface IntervalScheduler {
  interval(ms: number, fn: () => void): () => void;
}

export function ok<T = void>(value: T): CommandResult<T> {
  return { ok: true, value };
}

export function err(code: CommandErrorCode, message: string, recoverable = true): CommandResult<never> {
  return { ok: false, error: { code, recoverable, message } };
}

export function recoverable(code: CommandErrorCode): boolean {
  return (
    code !== 'unsupported' &&
    code !== 'permission-denied' &&
    code !== 'native-error'
  );
}
