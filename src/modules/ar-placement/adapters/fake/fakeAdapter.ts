import {
  err,
  ok,
  type AdapterCapabilities,
  type AdapterPlacementHandle,
  type CommandResult,
  type CreatePlacementRequest,
  type NormalizedEvent,
  type PlacementAdapter,
} from '../../core/types';

export const FAKE_CAPABILITIES: AdapterCapabilities = {
  adapterId: 'fake',
  strategy: 'library-owned-plane-attachment',
  platform: 'unknown',
  viroVersion: 'none',
  support: evidence('fake', 'always', 'test double', 'none', 'returns configured result', 'source'),
  sessionLifecycle: evidence('startSession/stopSession', 'generation', 'in-memory', 'adapter', 'command result', 'source'),
  planeDiscovery: evidence('ingest surface.*', 'normalized events', 'test', 'registry', 'malformed rejected', 'source'),
  planeReplacement: evidence('surface.replace', 'child/parent native ids', 'optional', 'registry', 'cycle rejected', 'source'),
  tracking: evidence('tracking.changed', 'state/reason', 'test', 'session', 'invalidates confirm', 'source'),
  hitTesting: evidence('hit.sample', 'pose + optional surface id', 'test', 'controller', 'stale ignored', 'source'),
  anchorCreate: evidence('createPlacement', 'handleId', 'in-memory set', 'adapter', 'can fail', 'source'),
  anchorRender: evidence('none', 'n/a', 'no renderer', 'none', 'n/a', 'source'),
  anchorRelease: evidence('releasePlacement', 'handleId', 'in-memory set', 'adapter', 'can fail', 'source'),
  contentSelection: evidence('select()', 'object id', 'explicit list', 'controller', 'object-not-found', 'source'),
  frameData: evidence('event.at', 'controller clock', 'injected', 'controller', 'nativeTime nullable', 'source'),
  surfaceReplacement: 'native',
  placementIndependence: 'plane-dependent',
  objectPicking: 'unsupported',
  requiresNativeView: false,
  pollHitTest: false,
};

function evidence(
  jsSymbol: string,
  shape: string,
  nativeEvidence: string,
  ownership: string,
  failureBehavior: string,
  deviceValidation: AdapterCapabilities['support']['deviceValidation']
): AdapterCapabilities['support'] {
  return { jsSymbol, shape, nativeEvidence, ownership, failureBehavior, deviceValidation };
}

export class FakeAdapter implements PlacementAdapter {
  capabilities: AdapterCapabilities;
  readonly handles = new Set<string>();
  readonly released: string[] = [];
  createShouldFail = false;
  releaseShouldFail = false;
  environmentResult: CommandResult<{ platform: { os: string; version?: string } | null }> = ok({
    platform: { os: 'fake', version: 'test' },
  });
  startResult: CommandResult = ok(undefined);
  stopResult: CommandResult = ok(undefined);
  nextHit: NormalizedEvent | null = null;
  handleSeq = 0;
  delayedCreates: CreatePlacementRequest[] = [];
  createGate: Promise<void> | null = null;

  constructor(overrides: Partial<AdapterCapabilities> = {}) {
    this.capabilities = { ...FAKE_CAPABILITIES, ...overrides };
  }

  async checkEnvironment() {
    return this.environmentResult;
  }

  async startSession() {
    return this.startResult;
  }

  async stopSession() {
    return this.stopResult;
  }

  async hitTest(): Promise<NormalizedEvent | null> {
    return this.nextHit;
  }

  async createPlacement(request: CreatePlacementRequest): Promise<CommandResult<AdapterPlacementHandle>> {
    if (this.createGate) await this.createGate;
    if (this.createShouldFail) {
      return err('anchor-create-failed', 'Fake create failed', true);
    }
    this.handleSeq += 1;
    const handleId = `handle-${this.handleSeq}`;
    this.handles.add(handleId);
    this.delayedCreates.push(request);
    return ok({
      handleId,
      objectId: request.objectId,
      nativeSurfaceId: request.nativeSurfaceId,
    });
  }

  async releasePlacement(handleId: string): Promise<CommandResult> {
    if (this.releaseShouldFail) {
      return err('anchor-release-failed', 'Fake release failed', false);
    }
    this.handles.delete(handleId);
    this.released.push(handleId);
    return ok(undefined);
  }
}

export function createFakeAdapter(overrides?: Partial<AdapterCapabilities>): FakeAdapter {
  return new FakeAdapter(overrides);
}
