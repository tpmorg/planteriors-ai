import { DiagnosticRecorder } from '../diagnostics/recorder';
import { isValidPose } from './coordinates';
import { selectFeedback } from './feedback';
import {
  applyTransform,
  createPlacedObject,
  markLost,
  retarget,
  toObjectSnapshot,
  type InternalObject,
} from './placements';
import { occupancy, commandBlockedBySession, isSessionActive } from './session';
import { SurfaceRegistry } from './surfaces';
import { evaluateTarget, isFreshTarget, planeLocalFromTarget } from './targeting';
import {
  DEFAULT_POLICY,
  err,
  ok,
  type ARPlacementCallbacks,
  type ARSnapshot,
  type AdapterCapabilities,
  type CommandResult,
  type ContentDescriptor,
  type FeedbackSnapshot,
  type IdSource,
  type IntervalScheduler,
  type NormalizedEvent,
  type ObjectSnapshot,
  type PlacementAdapter,
  type PlacementPolicy,
  type RuntimeClock,
  type SessionSnapshot,
  type TargetSnapshot,
} from './types';

export interface ControllerOptions {
  adapter: PlacementAdapter;
  policy?: Partial<PlacementPolicy>;
  contents?: ContentDescriptor[];
  callbacks?: ARPlacementCallbacks;
  clock?: RuntimeClock;
  ids?: Partial<IdSource>;
  scheduler?: IntervalScheduler;
  hostMeta?: { platform?: string; deviceModel?: string; osVersion?: string; appRevision?: string; buildId?: string };
}

const idleFeedback: FeedbackSnapshot = {
  code: 'session.idle',
  severity: 'info',
  params: {},
  heuristic: false,
};

export class ARPlacementController {
  readonly id: string;
  readonly adapter: PlacementAdapter;
  private policy: PlacementPolicy;
  private readonly contents = new Map<string, ContentDescriptor>();
  private callbacks: ARPlacementCallbacks;
  private readonly clock: RuntimeClock;
  private readonly ids: IdSource;
  private readonly scheduler: IntervalScheduler;
  private readonly listeners = new Set<() => void>();
  private readonly objects = new Map<string, InternalObject>();
  private readonly pendingReleases = new Map<string, { handleId: string; generation: number; attempts: number }>();
  private surfaces: SurfaceRegistry;
  private recorder: DiagnosticRecorder;
  private snapshot: ARSnapshot;
  private target: TargetSnapshot | null = null;
  private targetVersion = 0;
  private selection: string | null = null;
  private generation = 0;
  sessionId = 'idle';
  private lifecycle: SessionSnapshot['lifecycle'] = 'idle';
  private tracking: SessionSnapshot['tracking'] = 'unavailable';
  private trackingReason: SessionSnapshot['trackingReason'] = 'none';
  private startedAt: number | null = null;
  private failure: SessionSnapshot['failure'] = null;
  private platform: SessionSnapshot['platform'] = null;
  private placementsClearedOnRestart = false;
  private hitInFlight = false;
  private cancelHitLoop: (() => void) | null = null;
  private disposed = false;
  private mutationTail: Promise<void> = Promise.resolve();
  private placeInFlight: Promise<CommandResult<{ objectId: string }>> | null = null;

  constructor(options: ControllerOptions) {
    this.adapter = options.adapter;
    this.policy = { ...DEFAULT_POLICY, ...options.policy };
    (options.contents ?? []).forEach((content) => this.contents.set(content.contentId, content));
    this.callbacks = { ...options.callbacks };
    this.clock = options.clock ?? { now: () => Date.now() };
    this.ids = {
      sessionId: options.ids?.sessionId ?? (() => `session-${this.clock.now()}`),
      objectId: options.ids?.objectId ?? (() => `obj-${this.clock.now()}-${Math.random().toString(36).slice(2, 8)}`),
      operationId: options.ids?.operationId ?? (() => `op-${this.clock.now()}-${Math.random().toString(36).slice(2, 6)}`),
      controllerId: options.ids?.controllerId ?? (() => `ctl-${Math.random().toString(36).slice(2, 10)}`),
      surfaceId: options.ids?.surfaceId ?? ((nativeId: string) => `surf-${nativeId}`),
    };
    this.scheduler = options.scheduler ?? {
      interval: (ms, fn) => {
        const handle = setInterval(fn, ms);
        return () => clearInterval(handle);
      },
    };
    this.id = this.ids.controllerId();
    this.surfaces = new SurfaceRegistry(this.ids, this.policy);
    this.recorder = new DiagnosticRecorder(options.hostMeta, this.adapter.capabilities, this.policy);
    this.snapshot = this.buildSnapshot();
  }

  getCapabilities(): AdapterCapabilities {
    return this.adapter.capabilities;
  }

  getSnapshot = (): ARSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  setCallbacks(callbacks: ARPlacementCallbacks): void {
    this.callbacks = { ...callbacks };
  }

  registerContent(content: ContentDescriptor): void {
    this.contents.set(content.contentId, content);
  }

  setPolicy(policy: Partial<PlacementPolicy>): CommandResult {
    const restartKeys: (keyof PlacementPolicy)[] = ['surface'];
    if (restartKeys.some((key) => policy[key] !== undefined && policy[key] !== this.policy[key])) {
      return err('inactive-session', 'Surface policy changes require an explicit session restart', true);
    }
    this.policy = { ...this.policy, ...policy };
    this.surfaces = this.rebuildRegistryKeepingSurfaces();
    this.publish();
    return ok(undefined);
  }

  async start(): Promise<CommandResult> {
    if (this.disposed) return err('inactive-session', 'Controller is disposed', false);
    if (!occupancy.claim(this.id)) {
      return this.failCommand('start', err('session-busy', 'Another AR session is already running', true));
    }
    this.stopHitLoop();
    this.generation += 1;
    const generation = this.generation;
    this.sessionId = this.ids.sessionId();
    this.lifecycle = 'checking';
    this.failure = null;
    this.tracking = 'unavailable';
    this.trackingReason = 'none';
    this.target = null;
    this.objects.clear();
    this.surfaces.clear();
    this.selection = null;
    this.startedAt = this.clock.now();
    this.placementsClearedOnRestart = generation > 1;
    this.recorder.resetSession(this.sessionId, generation, this.startedAt);
    this.publish();

    const env = await this.adapter.checkEnvironment();
    if (!this.isCurrent(generation) || this.lifecycle !== 'checking') {
      occupancy.release(this.id);
      return err('operation-cancelled', 'Session was stopped during environment check', true);
    }
    if (!env.ok) {
      occupancy.release(this.id);
      this.lifecycle = 'failed';
      this.failure = env.error;
      this.emitError(env.error);
      this.publish();
      return env;
    }
    this.platform = env.value.platform;
    this.lifecycle = 'starting';
    this.publish();

    const started = await this.adapter.startSession(generation);
    if (!this.isCurrent(generation) || this.lifecycle !== 'starting') {
      occupancy.release(this.id);
      if (started.ok) await this.adapter.stopSession(generation);
      return err('operation-cancelled', 'Session was stopped during start', true);
    }
    if (!started.ok) {
      occupancy.release(this.id);
      this.lifecycle = 'failed';
      this.failure = started.error;
      this.emitError(started.error);
      this.publish();
      return started;
    }

    if (!this.adapter.capabilities.requiresNativeView) {
      this.enterRunning(generation);
    }
    return ok(undefined);
  }

  async stop(): Promise<CommandResult> {
    return this.shutdown('stopped');
  }

  async reset(): Promise<CommandResult> {
    const stopped = await this.shutdown('stopped');
    if (!stopped.ok && stopped.error.code !== 'inactive-session') return stopped;
    return this.start();
  }

  async place(input: { contentId: string }): Promise<CommandResult<{ objectId: string }>> {
    if (this.placeInFlight) return this.placeInFlight;
    const run = this.enqueue(async () => this.placeNow(input));
    this.placeInFlight = run;
    try {
      return await run;
    } finally {
      this.placeInFlight = null;
    }
  }

  async beginMove(objectId: string): Promise<CommandResult> {
    return this.enqueue(async () => {
      const blocked = this.guard('beginMove');
      if (blocked) return blocked;
      const object = this.objects.get(objectId);
      if (!object) return this.failCommand('beginMove', err('object-not-found', `Unknown object ${objectId}`, true));
      object.moveBackup = {
        handleId: object.handleId,
        surfaceId: object.surfaceId,
        nativeSurfaceId: object.nativeSurfaceId,
        anchorPose: object.anchorPose,
        localTransform: { ...object.localTransform },
      };
      object.lifecycle = 'moving';
      object.confirmed = false;
      this.selection = objectId;
      this.record('command', 'placement.move.begin', { objectId });
      this.emitPlacement(object);
      this.publish();
      return ok(undefined);
    });
  }

  async commitMove(objectId: string): Promise<CommandResult> {
    return this.enqueue(async () => {
      const blocked = this.guard('commitMove');
      if (blocked) return blocked;
      const object = this.objects.get(objectId);
      if (!object || object.lifecycle !== 'moving') {
        return this.failCommand('commitMove', err('object-not-found', 'Object is not moving', true));
      }
      const prepared = this.prepareTargetPlacement(object.content);
      if (!prepared.ok) return this.failCommand('commitMove', prepared);

      const previousHandle = object.handleId;
      const created = await this.adapter.createPlacement({
        objectId,
        contentId: object.contentId,
        surfaceId: prepared.value.surfaceId,
        nativeSurfaceId: prepared.value.nativeSurfaceId,
        pose: prepared.value.anchorPose,
        localTransform: object.localTransform,
        generation: this.generation,
        operationId: this.ids.operationId(),
      });
      if (!this.isCurrent(this.generation)) {
        if (created.ok) await this.releaseHandle(created.value.handleId);
        return err('operation-cancelled', 'Session generation changed', true);
      }
      if (!created.ok) {
        this.record('effect', 'placement.create.failed', created.error);
        return this.failCommand('commitMove', created);
      }
      object.handleId = created.value.handleId;
      object.previousHandleId = previousHandle;
      const moved = retarget(object, prepared.value.surfaceId, prepared.value.nativeSurfaceId, prepared.value.anchorPose);
      moved.lifecycle = 'placed';
      moved.moveBackup = null;
      this.objects.set(objectId, moved);
      if (previousHandle && previousHandle !== created.value.handleId) {
        await this.releaseHandle(previousHandle);
      }
      this.record('effect', 'placement.changed', { objectId, lifecycle: 'placed', reason: 'move' });
      this.emitPlacement(moved);
      this.publish();
      return ok(undefined);
    });
  }

  async cancelMove(objectId: string): Promise<CommandResult> {
    return this.enqueue(async () => {
      const object = this.objects.get(objectId);
      if (!object) return this.failCommand('cancelMove', err('object-not-found', `Unknown object ${objectId}`, true));
      if (object.lifecycle !== 'moving' || !object.moveBackup) {
        return ok(undefined);
      }
      const backup = object.moveBackup;
      object.surfaceId = backup.surfaceId;
      object.nativeSurfaceId = backup.nativeSurfaceId;
      object.handleId = backup.handleId;
      object.anchorPose = backup.anchorPose;
      object.localTransform = backup.localTransform;
      object.pose = object.pose;
      const restored = retarget(
        object,
        backup.surfaceId ?? object.surfaceId ?? '',
        backup.nativeSurfaceId ?? object.nativeSurfaceId ?? '',
        backup.anchorPose
      );
      restored.handleId = backup.handleId;
      restored.lifecycle = 'placed';
      restored.moveBackup = null;
      this.objects.set(objectId, restored);
      this.record('command', 'placement.move.cancel', { objectId });
      this.emitPlacement(restored);
      this.publish();
      return ok(undefined);
    });
  }

  async setTransform(objectId: string, transform: { yawRadians?: number; scale?: number }): Promise<CommandResult> {
    return this.enqueue(async () => {
      const blocked = this.guard('setTransform');
      if (blocked) return blocked;
      const object = this.objects.get(objectId);
      if (!object) return this.failCommand('setTransform', err('object-not-found', `Unknown object ${objectId}`, true));
      if (object.lifecycle !== 'placed' && object.lifecycle !== 'moving') {
        return this.failCommand('setTransform', err('inactive-session', 'Object cannot be transformed now', true));
      }
      const next = applyTransform(object, transform);
      this.objects.set(objectId, next);
      this.record('command', 'placement.transform', { objectId, transform });
      this.emitPlacement(next);
      this.publish();
      return ok(undefined);
    });
  }

  async confirm(objectId: string): Promise<CommandResult> {
    return this.enqueue(async () => {
      const blocked = this.guard('confirm');
      if (blocked) return blocked;
      const object = this.objects.get(objectId);
      if (!object) return this.failCommand('confirm', err('object-not-found', `Unknown object ${objectId}`, true));
      if (this.lifecycle === 'failed' || this.tracking !== 'normal' || object.lifecycle === 'lost') {
        return this.failCommand('confirm', err('tracking-limited', 'Confirmation is not available', true));
      }
      if (object.lifecycle !== 'placed' && object.lifecycle !== 'moving') {
        return this.failCommand('confirm', err('inactive-session', 'Object is not placed', true));
      }
      object.lifecycle = 'confirmed';
      object.confirmed = true;
      this.record('command', 'placement.confirm', { objectId });
      this.emitPlacement(object);
      this.publish();
      return ok(undefined);
    });
  }

  async remove(objectId: string): Promise<CommandResult> {
    return this.enqueue(async () => this.removeNow(objectId));
  }

  async clear(): Promise<CommandResult> {
    return this.enqueue(async () => {
      const ids = [...this.objects.keys()];
      for (const id of ids) {
        const result = await this.removeNow(id);
        if (!result.ok && result.error.code === 'anchor-release-failed') return result;
      }
      return ok(undefined);
    });
  }

  select(objectId: string | null): CommandResult {
    if (objectId && !this.objects.has(objectId)) {
      return err('object-not-found', `Unknown object ${objectId}`, true);
    }
    this.selection = objectId;
    this.publish();
    return ok(undefined);
  }

  ingest(event: NormalizedEvent): void {
    if (this.disposed) return;
    if (event.generation !== this.generation) {
      this.recorder.record({
        sessionId: this.sessionId,
        generation: this.generation,
        at: this.clock.now(),
        source: 'native',
        type: 'event.stale-generation',
        payload: { event },
      });
      return;
    }
    switch (event.type) {
      case 'session.nativeReady':
        this.platform = event.platform ?? this.platform;
        this.enterRunning(event.generation);
        break;
      case 'session.nativeError':
        this.onNativeError(event.message, event.recoverable);
        break;
      case 'session.interrupted':
        this.lifecycle = 'interrupted';
        this.invalidateConfirmation('session-interrupted');
        this.target = null;
        this.record('lifecycle', 'session.interrupted', {});
        this.publish();
        break;
      case 'tracking.changed':
        this.onTracking(event);
        break;
      case 'surface.upsert':
        this.onSurfaceUpsert(event);
        break;
      case 'surface.remove':
        this.onSurfaceRemove(event);
        break;
      case 'surface.replace':
        this.onSurfaceReplace(event);
        break;
      case 'hit.sample':
        this.onHit(event);
        break;
      case 'hit.empty':
        this.target = null;
        this.emitCallback('onTargetChanged', null);
        this.publish();
        break;
      default:
        this.record('native', 'event.malformed', { event });
    }
  }

  nativeSurfaceIdFor(surfaceId: string): string | null {
    return this.surfaces.getBySurfaceId(surfaceId)?.nativeId ?? null;
  }

  exportDiagnostics(): ReturnType<DiagnosticRecorder['exportReport']> {
    return this.recorder.exportReport(this.clock.now());
  }

  clearDiagnostics(): void {
    this.recorder.clear();
    this.publish();
  }

  dispose(): void {
    this.disposed = true;
    this.stopHitLoop();
    occupancy.release(this.id);
    this.listeners.clear();
    this.callbacks = {};
  }

  private async placeNow(input: { contentId: string }): Promise<CommandResult<{ objectId: string }>> {
    const blocked = this.guard('place');
    if (blocked) return blocked as CommandResult<{ objectId: string }>;
    const content = this.contents.get(input.contentId);
    if (!content) {
      return this.failCommand('place', err('object-not-found', `Unknown content ${input.contentId}`, true));
    }
    const live = [...this.objects.values()].filter((object) => object.lifecycle !== 'lost' && object.lifecycle !== 'removing');
    if (live.length >= this.policy.maxObjects) {
      return this.failCommand('place', err('limit-reached', 'Object limit reached', true));
    }
    const prepared = this.prepareTargetPlacement(content);
    if (!prepared.ok) return this.failCommand('place', prepared);

    const objectId = this.ids.objectId();
    const object = createPlacedObject({
      id: objectId,
      content,
      surfaceId: prepared.value.surfaceId,
      nativeSurfaceId: prepared.value.nativeSurfaceId,
      anchorPose: prepared.value.anchorPose,
      localTranslation: prepared.value.localTranslation,
    });
    this.objects.set(objectId, object);
    this.selection = objectId;
    this.publish();

    const created = await this.adapter.createPlacement({
      objectId,
      contentId: content.contentId,
      surfaceId: prepared.value.surfaceId,
      nativeSurfaceId: prepared.value.nativeSurfaceId,
      pose: prepared.value.anchorPose,
      localTransform: object.localTransform,
      generation: this.generation,
      operationId: this.ids.operationId(),
    });
    if (!this.isCurrent(this.generation) || !this.objects.has(objectId)) {
      if (created.ok) await this.releaseHandle(created.value.handleId);
      this.objects.delete(objectId);
      return err('operation-cancelled', 'Placement cancelled', true);
    }
    if (!created.ok) {
      this.objects.delete(objectId);
      this.record('effect', 'placement.create.failed', created.error);
      this.publish();
      return this.failCommand('place', created);
    }
    object.handleId = created.value.handleId;
    object.lifecycle = 'placed';
    this.record('effect', 'placement.changed', { objectId, lifecycle: 'placed' });
    this.emitPlacement(object);
    this.publish();
    return ok({ objectId });
  }

  private async removeNow(objectId: string): Promise<CommandResult> {
    const object = this.objects.get(objectId);
    if (!object) return ok(undefined);
    object.lifecycle = 'removing';
    this.publish();
    if (object.handleId) {
      const released = await this.releaseHandle(object.handleId);
      if (!released.ok) {
        object.lifecycle = 'placed';
        this.publish();
        return this.failCommand('remove', released);
      }
    }
    this.objects.delete(objectId);
    if (this.selection === objectId) this.selection = null;
    this.record('command', 'placement.removed', { objectId });
    this.publish();
    return ok(undefined);
  }

  private prepareTargetPlacement(content: ContentDescriptor): CommandResult<{
    surfaceId: string;
    nativeSurfaceId: string;
    anchorPose: import('./types').Pose;
    localTranslation: readonly [number, number, number];
  }> {
    const now = this.clock.now();
    if (!isFreshTarget(this.target, now, this.policy)) {
      const code = this.target ? 'stale-target' : 'no-valid-target';
      return err(code, 'No freshly validated surface target', true);
    }
    const surface = this.target?.surfaceId ? this.surfaces.getBySurfaceId(this.target.surfaceId) : undefined;
    if (!surface || !this.target) return err('no-valid-target', 'Target surface is gone', true);
    const local = planeLocalFromTarget(this.target, this.surfaces);
    if (!local || !isValidPose(this.target.pose)) {
      return err('no-valid-target', 'Could not convert target into plane space', true);
    }
    void content;
    return ok({
      surfaceId: surface.id,
      nativeSurfaceId: surface.nativeId,
      anchorPose: { position: this.target.pose.position, rotation: surface.pose.rotation },
      localTranslation: local.position,
    });
  }

  private enterRunning(generation: number): void {
    if (!this.isCurrent(generation) || this.lifecycle === 'running') return;
    this.lifecycle = 'running';
    this.record('lifecycle', 'session.running', {});
    this.startHitLoop();
    this.publish();
  }

  private onTracking(event: Extract<NormalizedEvent, { type: 'tracking.changed' }>): void {
    const previous = this.tracking;
    this.tracking = event.state;
    this.trackingReason = event.reason;
    if (event.state !== 'normal') {
      this.invalidateConfirmation('tracking-not-usable');
    }
    this.record('native', 'tracking.changed', { state: event.state, reason: event.reason }, event.nativeTime);
    if (previous !== event.state) {
      this.emitCallback('onTrackingChanged', event.state, event.reason);
    }
    this.publish();
  }

  private onSurfaceUpsert(event: Extract<NormalizedEvent, { type: 'surface.upsert' }>): void {
    const change = this.surfaces.upsert(event);
    if (change.kind === 'rejected') {
      this.record('native', 'event.malformed', { reason: change.reason, event });
      return;
    }
    if (change.kind === 'added' && change.surface) {
      this.record('native', 'surface.upsert', { nativeId: event.nativeId, eligible: change.surface.eligibility.eligible });
      this.emitCallback('onSurfaceAdded', change.surface);
    } else if (change.kind === 'updated' && change.surface) {
      this.record('native', 'surface.upsert', { nativeId: event.nativeId, eligible: change.surface.eligibility.eligible });
      this.emitCallback('onSurfaceUpdated', change.surface);
    }
    this.publish();
  }

  private onSurfaceRemove(event: Extract<NormalizedEvent, { type: 'surface.remove' }>): void {
    const change = this.surfaces.remove(event.nativeId, event.at);
    if (change.kind === 'removed' && change.surface) {
      this.record('native', 'surface.remove', { nativeId: event.nativeId, surfaceId: change.surface.id });
      this.emitCallback('onSurfaceRemoved', change.surface.id);
      if (this.target?.surfaceId === change.surface.id) {
        this.target = null;
        this.emitCallback('onTargetChanged', null);
      }
      this.handleSurfaceLoss(change.surface.id);
    }
    this.publish();
  }

  private onSurfaceReplace(event: Extract<NormalizedEvent, { type: 'surface.replace' }>): void {
    if (this.adapter.capabilities.surfaceReplacement === 'unsupported') {
      this.record('native', 'surface.replace.unsupported', event);
      return;
    }
    const change = this.surfaces.replace(event.childNativeId, event.parentNativeId, event.at);
    if (change.kind === 'rejected') {
      this.record('native', 'event.malformed', { reason: change.reason, event });
      return;
    }
    if (change.fromId && change.toId) {
      this.record('native', 'surface.replace', { fromId: change.fromId, toId: change.toId });
      this.emitCallback('onSurfaceReplaced', change.fromId, change.toId);
      for (const object of this.objects.values()) {
        if (object.surfaceId === change.fromId) {
          const parent = this.surfaces.get(event.parentNativeId);
          if (parent) {
            const next = retarget(object, parent.id, parent.nativeId, parent.pose);
            this.objects.set(object.id, next);
            this.emitPlacement(next);
          }
        }
      }
    }
    this.publish();
  }

  private onHit(event: Extract<NormalizedEvent, { type: 'hit.sample' }>): void {
    const evaluated = evaluateTarget({
      generation: this.generation,
      version: (this.targetVersion += 1),
      at: event.at,
      hitType: event.hitType,
      pose: event.pose,
      distanceM: event.distanceM,
      surfaceNativeId: event.surfaceNativeId,
      surfaces: this.surfaces,
      policy: this.policy,
      previous: this.target,
    });
    if ('rejected' in evaluated) {
      this.record('native', 'event.malformed', { reason: evaluated.reason });
      return;
    }
    const previous = this.target;
    const local = planeLocalFromTarget(evaluated, this.surfaces);
    this.target = {
      ...evaluated,
      planeLocalPosition: local ? [local.position[0], 0, local.position[2]] : null,
    };
    if (!previous || previous.surfaceId !== evaluated.surfaceId || previous.ready !== evaluated.ready || previous.eligible !== evaluated.eligible) {
      this.record('native', 'target.changed', { surfaceId: evaluated.surfaceId, ready: evaluated.ready, eligible: evaluated.eligible });
      this.emitCallback('onTargetChanged', evaluated);
    }
    this.publish();
  }

  private handleSurfaceLoss(surfaceId: string): void {
    const independent = this.adapter.capabilities.placementIndependence === 'independent';
    for (const object of [...this.objects.values()]) {
      if (object.surfaceId !== surfaceId) continue;
      if (independent && object.handleId) continue;
      const lost = markLost(object, 'surface-removed');
      this.objects.set(object.id, lost);
      this.record('lifecycle', 'placement.lost', { objectId: object.id, reason: 'surface-removed' });
      this.emitCallback('onPlacementLost', object.id, 'surface-removed');
    }
  }

  private invalidateConfirmation(reason: string): void {
    for (const object of this.objects.values()) {
      if (object.confirmed || object.lifecycle === 'confirmed') {
        object.confirmed = false;
        object.lifecycle = object.lifecycle === 'lost' ? 'lost' : 'placed';
        this.emitPlacement(object);
      }
    }
    this.record('lifecycle', 'placement.unconfirmed', { reason });
  }

  private onNativeError(message: string, recoverable: boolean): void {
    this.failure = { code: 'native-error', recoverable, message };
    this.lifecycle = recoverable ? 'interrupted' : 'failed';
    this.invalidateConfirmation('native-error');
    this.target = null;
    this.record('native', 'session.nativeError', this.failure);
    this.emitError(this.failure);
    this.publish();
  }

  private startHitLoop(): void {
    this.stopHitLoop();
    if (!this.adapter.capabilities.pollHitTest) return;
    const period = Math.max(50, Math.round(1000 / this.policy.hitTestHz));
    const generation = this.generation;
    this.cancelHitLoop = this.scheduler.interval(period, () => {
      void this.pollHit(generation);
    });
  }

  private stopHitLoop(): void {
    this.cancelHitLoop?.();
    this.cancelHitLoop = null;
    this.hitInFlight = false;
  }

  private async pollHit(generation: number): Promise<void> {
    if (!this.isCurrent(generation) || this.hitInFlight || this.lifecycle !== 'running') return;
    this.hitInFlight = true;
    try {
      const event = await this.adapter.hitTest(generation);
      if (!this.isCurrent(generation)) return;
      if (event) this.ingest(event);
    } finally {
      this.hitInFlight = false;
    }
  }

  private async shutdown(next: 'stopped' | 'failed'): Promise<CommandResult> {
    const generation = this.generation;
    this.stopHitLoop();
    this.lifecycle = 'stopping';
    this.publish();
    const ids = [...this.objects.keys()];
    for (const id of ids) {
      await this.removeNow(id);
    }
    for (const pending of [...this.pendingReleases.values()]) {
      await this.releaseHandle(pending.handleId);
    }
    const stopped = await this.adapter.stopSession(generation);
    occupancy.release(this.id);
    this.lifecycle = next;
    this.target = null;
    this.surfaces.clear();
    this.objects.clear();
    this.record('lifecycle', 'session.stopped', {});
    this.publish();
    return stopped.ok ? ok(undefined) : stopped;
  }

  private async releaseHandle(handleId: string): Promise<CommandResult> {
    const generation = this.generation;
    const result = await this.adapter.releasePlacement(handleId, generation);
    if (result.ok) {
      this.pendingReleases.delete(handleId);
      this.record('effect', 'placement.release', { handleId, ok: true });
      return result;
    }
    const pending = this.pendingReleases.get(handleId) ?? { handleId, generation, attempts: 0 };
    pending.attempts += 1;
    this.pendingReleases.set(handleId, pending);
    this.record('effect', 'placement.release', { handleId, ok: false, attempts: pending.attempts });
    if (pending.attempts >= 3) {
      return err('anchor-release-failed', result.error.message, false);
    }
    return result;
  }

  private queueRelease(handleId: string, generation: number): void {
    this.pendingReleases.set(handleId, { handleId, generation, attempts: 0 });
    void this.releaseHandle(handleId);
  }

  private guard(command: string): CommandResult | null {
    const blocked = commandBlockedBySession(this.lifecycle, this.tracking, command);
    if (!blocked) return null;
    return err(
      blocked,
      blocked === 'tracking-limited' ? 'Tracking is not normal' : 'Session is not running',
      true
    );
  }

  private failCommand<T>(command: string, result: CommandResult<T>): CommandResult<T> {
    if (!result.ok) {
      this.record('command', 'command.rejected', { command, error: result.error });
    }
    return result;
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const run = this.mutationTail.then(work, work);
    this.mutationTail = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  private isCurrent(generation: number): boolean {
    return !this.disposed && this.generation === generation;
  }

  private emitPlacement(object: InternalObject): void {
    this.emitCallback('onPlacementChanged', toObjectSnapshot(object));
  }

  private emitError(error: NonNullable<SessionSnapshot['failure']>): void {
    this.emitCallback('onError', error);
  }

  private emitCallback<K extends keyof ARPlacementCallbacks>(
    name: K,
    ...args: Parameters<NonNullable<ARPlacementCallbacks[K]>>
  ): void {
    const callback = this.callbacks[name];
    if (!callback) return;
    try {
      (callback as (...cbArgs: unknown[]) => void)(...args);
    } catch {
      this.record('lifecycle', 'callback.error', { name });
    }
  }

  private record(source: 'native' | 'command' | 'effect' | 'lifecycle', type: string, payload: unknown, nativeTime?: number | null): void {
    this.recorder.record({
      sessionId: this.sessionId,
      generation: this.generation,
      at: this.clock.now(),
      nativeTime,
      source,
      type,
      payload,
    });
  }

  private rebuildRegistryKeepingSurfaces(): SurfaceRegistry {
    const next = new SurfaceRegistry(this.ids, this.policy);
    for (const surface of this.surfaces.snapshots()) {
      const internal = this.surfaces.getBySurfaceId(surface.id);
      if (!internal) continue;
      next.upsert({
        nativeId: internal.nativeId,
        alignment: internal.alignment,
        pose: internal.pose,
        at: internal.lastUpdatedAt,
        extent: internal.extent ?? undefined,
        boundary: internal.boundary ?? undefined,
      });
    }
    return next;
  }

  private publish(): void {
    this.snapshot = this.buildSnapshot();
    this.listeners.forEach((listener) => listener());
  }

  private buildSnapshot(): ARSnapshot {
    const session: SessionSnapshot = {
      generation: this.generation,
      sessionId: this.sessionId,
      lifecycle: this.lifecycle,
      tracking: this.tracking,
      trackingReason: this.trackingReason,
      startedAt: this.startedAt,
      failure: this.failure,
      platform: this.platform,
      placementsClearedOnRestart: this.placementsClearedOnRestart,
    };
    const surfaces = this.surfaces.snapshots();
    const objects: ObjectSnapshot[] = [...this.objects.values()].map(toObjectSnapshot);
    const recorder = this.recorder.counters();
    const partial = { session, target: this.target, objects, surfaces };
    return {
      capabilities: this.adapter.capabilities,
      policy: this.policy,
      session,
      surfaces,
      target: this.target,
      objects,
      selection: this.selection,
      feedback: selectFeedback(partial),
      diagnostics: {
        eventCount: recorder.eventCount,
        droppedEvents: recorder.droppedEvents,
        pendingOperations: this.placeInFlight ? 1 : 0,
        nativeSurfaceCount: this.surfaces.nativeCount(),
        acceptedSurfaceCount: this.surfaces.acceptedCount(),
        ownedPlacementCount: objects.filter((object) => object.lifecycle !== 'lost').length,
        pendingReleaseCount: this.pendingReleases.size,
        recorderTruncated: recorder.truncated,
        recorderDiagnosticOnly: recorder.diagnosticOnly,
        resourceCountKind: 'adapter-owned',
      },
    };
  }
}

export function createController(options: ControllerOptions): ARPlacementController {
  return new ARPlacementController(options);
}

void isSessionActive;
void idleFeedback;
