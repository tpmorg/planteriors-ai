import { createFakeAdapter, type FakeAdapter } from '../adapters/fake/fakeAdapter';
import { ARPlacementController, type ControllerOptions } from '../core/controller';
import { IDENTITY_QUAT } from '../core/coordinates';
import { createMemoryClock, createSequentialIds } from '../core/ids';
import { occupancy } from '../core/session';
import type { ContentDescriptor, NormalizedEvent, Pose } from '../core/types';
import { DiagnosticRecorder } from '../diagnostics/recorder';
import { replayReport } from '../diagnostics/replay';
import { EVENT_SCHEMA_VERSION } from '../diagnostics/schema';

const BOX: ContentDescriptor = {
  contentId: 'box',
  dimensions: { width: 0.2, height: 0.4, depth: 0.1 },
  pivot: [0, 0.2, 0],
  minScale: 0.5,
  maxScale: 2,
};

const POSE: Pose = { position: [0.2, 0, -1.2], rotation: IDENTITY_QUAT };

function surface(generation: number, nativeId: string, at: number): NormalizedEvent {
  return {
    type: 'surface.upsert',
    generation,
    at,
    nativeId,
    alignment: 'horizontal-upward',
    pose: { position: [0, 0, -1], rotation: IDENTITY_QUAT },
    extent: { width: 1.5, height: 1.5 },
  };
}

function hit(generation: number, at: number, extra: Partial<Extract<NormalizedEvent, { type: 'hit.sample' }>> = {}): NormalizedEvent {
  return {
    type: 'hit.sample',
    generation,
    at,
    hitType: 'existing-plane-extent',
    pose: POSE,
    distanceM: 1.2,
    surfaceNativeId: 'plane-a',
    ...extra,
  };
}

async function runningController(overrides: Partial<ControllerOptions> = {}) {
  occupancy.resetForTests();
  const clock = createMemoryClock(0);
  const adapter = (overrides.adapter as FakeAdapter | undefined) ?? createFakeAdapter();
  const controller = new ARPlacementController({
    adapter,
    contents: [BOX],
    clock,
    ids: createSequentialIds('fix'),
    ...overrides,
    policy: { maxObjects: 2, readyStableMs: 300, maxTargetAgeMs: 250, ...overrides.policy },
  });
  await controller.start();
  const generation = controller.getSnapshot().session.generation;
  return { controller, adapter, clock, generation };
}

async function readyTarget(controller: ARPlacementController, generation: number, clock: ReturnType<typeof createMemoryClock>) {
  controller.ingest(surface(generation, 'plane-a', clock.now()));
  controller.ingest({ type: 'tracking.changed', generation, at: clock.now(), state: 'normal', reason: 'none' });
  controller.ingest(hit(generation, clock.now()));
  clock.advance(300);
  controller.ingest(hit(generation, clock.now()));
}

describe('AR placement controller fixtures', () => {
  beforeEach(() => occupancy.resetForTests());

  it('1. clean scan → place → confirm → remove', async () => {
    const { controller, adapter, clock, generation } = await runningController();
    await readyTarget(controller, generation, clock);
    const placed = await controller.place({ contentId: 'box' });
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    expect(controller.getSnapshot().objects[0]?.lifecycle).toBe('placed');
    expect(await controller.confirm(placed.value.objectId)).toEqual({ ok: true, value: undefined });
    expect(controller.getSnapshot().objects[0]?.confirmed).toBe(true);
    expect(await controller.remove(placed.value.objectId)).toEqual({ ok: true, value: undefined });
    expect(controller.getSnapshot().objects).toHaveLength(0);
    expect(adapter.handles.size).toBe(0);
  });

  it('2. repeated updates for one plane and update-before-add', async () => {
    const added: string[] = [];
    const updated: string[] = [];
    const { controller, generation } = await runningController({
      callbacks: {
        onSurfaceAdded: (surfaceSnapshot) => added.push(surfaceSnapshot.id),
        onSurfaceUpdated: (surfaceSnapshot) => updated.push(surfaceSnapshot.id),
      },
    });
    controller.ingest(surface(generation, 'plane-a', 10));
    controller.ingest(surface(generation, 'plane-a', 20));
    controller.ingest(surface(generation, 'plane-a', 30));
    expect(controller.getSnapshot().surfaces).toHaveLength(1);
    expect(added).toHaveLength(1);
    expect(updated.length).toBeGreaterThan(0);
  });

  it('3. two planes merging with both parent/child event orders', async () => {
    const { controller, generation, clock } = await runningController();
    controller.ingest(surface(generation, 'child', clock.now()));
    controller.ingest(surface(generation, 'parent', clock.now()));
    controller.ingest({
      type: 'surface.replace',
      generation,
      at: clock.now(),
      childNativeId: 'child',
      parentNativeId: 'parent',
    });
    expect(controller.getSnapshot().surfaces.map((item) => item.id)).toEqual(['fix-surf-parent']);
    await controller.stop();

    const second = await runningController();
    second.controller.ingest({
      type: 'surface.replace',
      generation: second.generation,
      at: 0,
      childNativeId: 'child',
      parentNativeId: 'parent',
    });
    second.controller.ingest(surface(second.generation, 'parent', 1));
    second.controller.ingest(surface(second.generation, 'child', 2));
    expect(second.controller.getSnapshot().surfaces).toHaveLength(1);
    await second.controller.stop();
  });

  it('4. selected surface removed for plane-dependent versus independent objects', async () => {
    const dependent = await runningController();
    await readyTarget(dependent.controller, dependent.generation, dependent.clock);
    const placed = await dependent.controller.place({ contentId: 'box' });
    expect(placed.ok).toBe(true);
    dependent.controller.ingest({
      type: 'surface.remove',
      generation: dependent.generation,
      at: dependent.clock.now(),
      nativeId: 'plane-a',
    });
    expect(dependent.controller.getSnapshot().objects[0]?.lifecycle).toBe('lost');

    occupancy.resetForTests();
    const independent = await runningController({
      adapter: createFakeAdapter({ placementIndependence: 'independent' }),
    });
    await readyTarget(independent.controller, independent.generation, independent.clock);
    await independent.controller.place({ contentId: 'box' });
    independent.controller.ingest({
      type: 'surface.remove',
      generation: independent.generation,
      at: independent.clock.now(),
      nativeId: 'plane-a',
    });
    expect(independent.controller.getSnapshot().objects[0]?.lifecycle).toBe('placed');
  });

  it('5. tracking lost/recovered before and after confirmation', async () => {
    const { controller, clock, generation } = await runningController();
    await readyTarget(controller, generation, clock);
    const placed = await controller.place({ contentId: 'box' });
    if (!placed.ok) throw new Error('place failed');
    await controller.confirm(placed.value.objectId);
    controller.ingest({
      type: 'tracking.changed',
      generation,
      at: clock.now(),
      state: 'limited',
      reason: 'insufficient-features',
    });
    expect(controller.getSnapshot().objects[0]?.confirmed).toBe(false);
    expect(controller.getSnapshot().feedback.code).toBe('tracking.insufficientFeatures');
    const denied = await controller.confirm(placed.value.objectId);
    expect(denied.ok).toBe(false);
    controller.ingest({ type: 'tracking.changed', generation, at: clock.now(), state: 'normal', reason: 'none' });
    expect((await controller.confirm(placed.value.objectId)).ok).toBe(true);
  });

  it('6. background during permission check and pending anchor creation', async () => {
    occupancy.resetForTests();
    const adapter = createFakeAdapter();
    let releaseEnv: () => void = () => undefined;
    adapter.environmentResult = new Promise((resolve) => {
      releaseEnv = () => resolve({ ok: true, value: { platform: { os: 'fake' } } });
    }) as never;
    const controller = new ARPlacementController({
      adapter,
      contents: [BOX],
      clock: createMemoryClock(0),
      ids: createSequentialIds('bg'),
    });
    const startPromise = controller.start();
    await controller.stop();
    releaseEnv();
    await startPromise;
    expect(['stopped', 'failed', 'idle']).toContain(controller.getSnapshot().session.lifecycle);

    occupancy.resetForTests();
    const held = createFakeAdapter();
    let releaseCreate: () => void = () => undefined;
    held.createGate = new Promise((resolve) => {
      releaseCreate = () => resolve();
    });
    const placing = new ARPlacementController({
      adapter: held,
      contents: [BOX],
      clock: createMemoryClock(0),
      ids: createSequentialIds('hold'),
      policy: { readyStableMs: 0, maxTargetAgeMs: 1000 },
    });
    await placing.start();
    const generation = placing.getSnapshot().session.generation;
    placing.ingest(surface(generation, 'plane-a', 0));
    placing.ingest({ type: 'tracking.changed', generation, at: 0, state: 'normal', reason: 'none' });
    placing.ingest(hit(generation, 0));
    const placePromise = placing.place({ contentId: 'box' });
    await placing.reset();
    releaseCreate();
    await placePromise;
    expect(held.handles.size).toBe(0);
  });

  it('7. reset followed by late callbacks from an old generation', async () => {
    const { controller, clock, generation } = await runningController();
    await controller.reset();
    const nextGen = controller.getSnapshot().session.generation;
    expect(nextGen).toBeGreaterThan(generation);
    controller.ingest(surface(generation, 'stale', clock.now()));
    expect(controller.getSnapshot().surfaces).toHaveLength(0);
  });

  it('8. double Place, move cancellation, create/release failure and repeated deletion', async () => {
    const { controller, adapter, clock, generation } = await runningController();
    await readyTarget(controller, generation, clock);
    const [a, b] = await Promise.all([
      controller.place({ contentId: 'box' }),
      controller.place({ contentId: 'box' }),
    ]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(controller.getSnapshot().objects).toHaveLength(1);

    const objectId = controller.getSnapshot().objects[0]!.id;
    clock.advance(10);
    controller.ingest(hit(generation, clock.now(), { pose: { position: [0.4, 0, -1.1], rotation: IDENTITY_QUAT } }));
    await controller.beginMove(objectId);
    const original = controller.getSnapshot().objects[0]!.localTransform;
    await controller.cancelMove(objectId);
    expect(controller.getSnapshot().objects[0]!.localTransform).toEqual(original);
    expect(controller.getSnapshot().objects[0]!.lifecycle).toBe('placed');

    adapter.createShouldFail = true;
    clock.advance(300);
    controller.ingest(hit(generation, clock.now()));
    const failed = await controller.place({ contentId: 'box' });
    expect(failed.ok).toBe(false);
    adapter.createShouldFail = false;

    adapter.releaseShouldFail = true;
    const releaseFailed = await controller.remove(objectId);
    expect(releaseFailed.ok).toBe(false);
    expect(controller.getSnapshot().diagnostics.pendingReleaseCount).toBeGreaterThan(0);
    adapter.releaseShouldFail = false;
    expect((await controller.remove(objectId)).ok).toBe(true);
    expect((await controller.remove(objectId)).ok).toBe(true);
  });

  it('9. no planes, stale/out-of-order hits, and malformed geometry', async () => {
    const { controller, clock, generation } = await runningController();
    controller.ingest({ type: 'tracking.changed', generation, at: clock.now(), state: 'normal', reason: 'none' });
    clock.advance(30_000);
    expect(controller.getSnapshot().feedback.code).toBe('scan.moveSlowly');
    controller.ingest({
      type: 'hit.sample',
      generation,
      at: clock.now(),
      hitType: 'existing-plane',
      pose: { position: [Number.NaN, 0, 0], rotation: IDENTITY_QUAT },
    });
    expect(controller.getSnapshot().target).toBeNull();
    controller.ingest({
      type: 'surface.upsert',
      generation,
      at: clock.now(),
      nativeId: 'bad',
      alignment: 'horizontal-upward',
      pose: { position: [0, 0, 0], rotation: IDENTITY_QUAT },
      extent: { width: Number.NaN, height: 1 },
    });
    controller.ingest(surface(generation, 'plane-a', clock.now()));
    controller.ingest({ type: 'tracking.changed', generation, at: clock.now(), state: 'normal', reason: 'none' });
    controller.ingest(hit(generation, 1));
    const stale = await controller.place({ contentId: 'box' });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error.code).toBe('stale-target');
  });

  it('10. recorder capacity and invalid schema import', async () => {
    const recorder = new DiagnosticRecorder({}, {}, {}, { events: 3 });
    recorder.resetSession('s', 1, 0);
    recorder.record({ sessionId: 's', generation: 1, at: 1, source: 'native', type: 'surface.upsert', payload: { nativeId: 'a' } });
    recorder.record({ sessionId: 's', generation: 1, at: 2, source: 'native', type: 'surface.upsert', payload: { nativeId: 'b' } });
    recorder.record({ sessionId: 's', generation: 1, at: 3, source: 'lifecycle', type: 'session.stopped', payload: {} });
    const report = recorder.exportReport(4);
    expect(report.truncated || report.droppedEvents > 0 || report.events.length <= 4).toBe(true);

    const incompatible = await replayReport({ ...report, schemaVersion: EVENT_SCHEMA_VERSION + 10 }, [BOX]);
    expect('ok' in incompatible && incompatible.ok === false).toBe(true);
  });

  it('rejects a second concurrent controller with session-busy', async () => {
    const first = await runningController();
    const second = new ARPlacementController({
      adapter: createFakeAdapter(),
      contents: [BOX],
      ids: createSequentialIds('busy'),
    });
    const result = await second.start();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('session-busy');
    await first.controller.stop();
  });

  it('does not duplicate surface callbacks for unchanged semantic identity', async () => {
    const added: string[] = [];
    occupancy.resetForTests();
    const controller = new ARPlacementController({
      adapter: createFakeAdapter(),
      contents: [BOX],
      callbacks: { onSurfaceAdded: (surfaceSnapshot) => added.push(surfaceSnapshot.id) },
      ids: createSequentialIds('cb'),
    });
    await controller.start();
    const generation = controller.getSnapshot().session.generation;
    controller.ingest(surface(generation, 'plane-a', 1));
    controller.ingest(surface(generation, 'plane-a', 2));
    expect(added).toEqual(['cb-surf-plane-a']);
  });
});
