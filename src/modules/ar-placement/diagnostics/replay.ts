import { ARPlacementController } from '../core/controller';
import { createFakeAdapter } from '../adapters/fake/fakeAdapter';
import { occupancy } from '../core/session';
import { createMemoryClock, createSequentialIds } from '../core/ids';
import type { ContentDescriptor, NormalizedEvent, PlacementPolicy } from '../core/types';
import type { DiagnosticReport } from './schema';
import { EVENT_SCHEMA_VERSION } from './schema';

export interface ReplayFixture {
  name: string;
  policy?: Partial<PlacementPolicy>;
  contents: ContentDescriptor[];
  independence?: 'plane-dependent' | 'independent';
  surfaceReplacement?: 'unsupported' | 'native';
  events: Array<NormalizedEvent | { type: 'command'; name: string; args?: unknown }>;
}

export interface ReplayResult {
  snapshot: ReturnType<ARPlacementController['getSnapshot']>;
  handlesRemaining: number;
  report: DiagnosticReport;
}

export async function replayFixture(fixture: ReplayFixture): Promise<ReplayResult> {
  occupancy.resetForTests();
  const clock = createMemoryClock(0);
  const adapter = createFakeAdapter({
    placementIndependence: fixture.independence ?? 'plane-dependent',
    surfaceReplacement: fixture.surfaceReplacement ?? 'native',
  });
  const controller = new ARPlacementController({
    adapter,
    policy: fixture.policy,
    contents: fixture.contents,
    clock,
    ids: createSequentialIds(fixture.name),
  });

  for (const event of fixture.events) {
    if (isNormalizedEvent(event)) {
      clock.set(event.at);
      if (controller.getSnapshot().session.lifecycle === 'idle' && event.type !== 'session.nativeReady') {
        await controller.start();
      }
      controller.ingest(event);
      continue;
    }
    await runCommand(controller, event.name, event.args);
  }

  return {
    snapshot: controller.getSnapshot(),
    handlesRemaining: adapter.handles.size,
    report: controller.exportDiagnostics(),
  };
}

export async function replayReport(report: DiagnosticReport, contents: ContentDescriptor[]): Promise<ReplayResult | { ok: false; error: string }> {
  if (report.schemaVersion !== EVENT_SCHEMA_VERSION) {
    return { ok: false, error: 'schema-incompatible' };
  }
  occupancy.resetForTests();
  const clock = createMemoryClock(0);
  const adapter = createFakeAdapter();
  const controller = new ARPlacementController({
    adapter,
    contents,
    clock,
    ids: createSequentialIds('replay'),
  });
  await controller.start();
  for (const envelope of report.events) {
    clock.set(envelope.at);
    if (envelope.source !== 'native' && envelope.source !== 'lifecycle') continue;
    if (envelope.type === 'session.checkpoint' || envelope.type === 'session.running') continue;
    const payload = envelope.payload as NormalizedEvent | { event?: NormalizedEvent };
    const event = (payload as { event?: NormalizedEvent }).event ?? (payload as NormalizedEvent);
    if (event && typeof event === 'object' && 'type' in event) {
      controller.ingest({ ...event, generation: controller.getSnapshot().session.generation, at: envelope.at });
    }
  }
  return {
    snapshot: controller.getSnapshot(),
    handlesRemaining: adapter.handles.size,
    report: controller.exportDiagnostics(),
  };
}

function isNormalizedEvent(
  event: ReplayFixture['events'][number]
): event is NormalizedEvent {
  return event.type !== 'command' && 'generation' in event;
}

async function runCommand(controller: ARPlacementController, name: string, args: unknown): Promise<void> {
  switch (name) {
    case 'start':
      await controller.start();
      break;
    case 'stop':
      await controller.stop();
      break;
    case 'reset':
      await controller.reset();
      break;
    case 'place':
      await controller.place((args as { contentId: string }) ?? { contentId: 'box' });
      break;
    case 'confirm':
      await controller.confirm(String((args as { objectId?: string })?.objectId ?? controller.getSnapshot().selection));
      break;
    case 'remove':
      await controller.remove(String((args as { objectId?: string })?.objectId ?? controller.getSnapshot().selection));
      break;
    case 'clear':
      await controller.clear();
      break;
    case 'beginMove':
      await controller.beginMove(String((args as { objectId?: string })?.objectId ?? controller.getSnapshot().selection));
      break;
    case 'commitMove':
      await controller.commitMove(String((args as { objectId?: string })?.objectId ?? controller.getSnapshot().selection));
      break;
    case 'cancelMove':
      await controller.cancelMove(String((args as { objectId?: string })?.objectId ?? controller.getSnapshot().selection));
      break;
    case 'setTransform':
      await controller.setTransform(
        String((args as { objectId?: string })?.objectId ?? controller.getSnapshot().selection),
        (args as { yawRadians?: number; scale?: number }) ?? {}
      );
      break;
    default:
      break;
  }
}
