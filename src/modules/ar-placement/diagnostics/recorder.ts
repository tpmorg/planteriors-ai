import { EVENT_SCHEMA_VERSION, type EventEnvelope, type EventSource } from '../core/types';
import {
  RECORDER_BYTE_LIMIT,
  RECORDER_EVENT_LIMIT,
  emptyMilestones,
  type DiagnosticReport,
  type RecorderCheckpoint,
} from './schema';

export interface RecordInput {
  sessionId: string;
  generation: number;
  at: number;
  nativeTime?: number | null;
  source: EventSource;
  operationId?: string | null;
  type: string;
  payload: unknown;
}

export class DiagnosticRecorder {
  private events: EventEnvelope[] = [];
  private seq = 0;
  private dropped = 0;
  private truncated = false;
  private diagnosticOnly = false;
  private bytes = 0;
  private readonly checkpoints: RecorderCheckpoint[] = [];
  private readonly milestones = emptyMilestones();
  private sessionStartedAt: number | null = null;
  private stoppedForLimit = false;

  constructor(
    private readonly host: DiagnosticReport['host'] = {},
    private readonly capabilities: unknown = {},
    private readonly policy: unknown = {},
    private readonly limits: { events?: number; bytes?: number } = {}
  ) {}

  resetSession(sessionId: string, generation: number, at: number): void {
    this.sessionStartedAt = at;
    this.checkpoints.push({ at, sessionId, generation, note: 'session-start' });
    this.milestones.resetCount += generation > 1 ? 1 : 0;
    this.record({
      sessionId,
      generation,
      at,
      source: 'lifecycle',
      type: 'session.checkpoint',
      payload: { note: 'session-start' },
    });
  }

  record(input: RecordInput): void {
    if (this.stoppedForLimit) {
      this.dropped += 1;
      return;
    }
    const previous = this.events[this.events.length - 1];
    if (
      previous &&
      input.type === 'surface.upsert' &&
      previous.type === 'surface.upsert' &&
      sameSurface(previous.payload, input.payload)
    ) {
      previous.at = input.at;
      previous.payload = input.payload;
      previous.nativeTime = input.nativeTime ?? null;
      return;
    }

    const envelope: EventEnvelope = {
      schemaVersion: EVENT_SCHEMA_VERSION,
      sessionId: input.sessionId,
      generation: input.generation,
      seq: this.seq += 1,
      at: input.at,
      nativeTime: input.nativeTime ?? null,
      source: input.source,
      operationId: input.operationId ?? null,
      type: input.type,
      payload: input.payload,
    };

    const encoded = jsonSize(envelope);
    const overCount = this.events.length >= (this.limits.events ?? RECORDER_EVENT_LIMIT);
    const overBytes = this.bytes + encoded > (this.limits.bytes ?? RECORDER_BYTE_LIMIT);
    if (overCount || overBytes) {
      this.truncated = true;
      this.dropped += 1;
      if (isProtected(input.type)) {
        this.diagnosticOnly = true;
        this.stoppedForLimit = true;
        this.events.push({
          ...envelope,
          type: 'recorder.limit',
          payload: { dropped: this.dropped, protectedType: input.type },
        });
      }
      return;
    }

    this.events.push(envelope);
    this.bytes += encoded;
    this.observeMilestone(envelope);
  }

  counters(): { eventCount: number; droppedEvents: number; truncated: boolean; diagnosticOnly: boolean } {
    return {
      eventCount: this.events.length,
      droppedEvents: this.dropped,
      truncated: this.truncated,
      diagnosticOnly: this.diagnosticOnly,
    };
  }

  exportReport(exportedAt: number): DiagnosticReport {
    return {
      schemaVersion: EVENT_SCHEMA_VERSION,
      exportedAt,
      diagnosticOnly: this.diagnosticOnly,
      truncated: this.truncated,
      droppedEvents: this.dropped,
      checkpoints: [...this.checkpoints],
      capabilities: this.capabilities,
      policy: this.policy,
      host: this.host,
      milestones: { ...this.milestones },
      events: [...this.events],
    };
  }

  clear(): void {
    this.events = [];
    this.seq = 0;
    this.dropped = 0;
    this.truncated = false;
    this.diagnosticOnly = false;
    this.bytes = 0;
    this.checkpoints.length = 0;
    this.stoppedForLimit = false;
    this.sessionStartedAt = null;
    Object.assign(this.milestones, emptyMilestones());
  }

  private observeMilestone(envelope: EventEnvelope): void {
    const rel = this.sessionStartedAt === null ? null : envelope.at - this.sessionStartedAt;
    if (envelope.type === 'tracking.changed' && (envelope.payload as { state?: string }).state === 'normal') {
      this.milestones.startToNormalTrackingMs ??= rel;
    }
    if (envelope.type === 'surface.upsert') {
      this.milestones.firstRawPlaneMs ??= rel;
      if ((envelope.payload as { eligible?: boolean }).eligible) {
        this.milestones.firstEligiblePlaneMs ??= rel;
      }
    }
    if (envelope.type === 'target.changed' && (envelope.payload as { ready?: boolean }).ready) {
      this.milestones.firstReadyTargetMs ??= rel;
    }
    if (envelope.type === 'placement.changed' && (envelope.payload as { lifecycle?: string }).lifecycle === 'placed') {
      this.milestones.firstPlacementMs ??= rel;
    }
    if (envelope.type === 'command.rejected') this.milestones.rejectionCount += 1;
    if (envelope.type === 'session.interrupted' || envelope.type === 'tracking.changed') {
      if ((envelope.payload as { state?: string }).state === 'limited') {
        this.milestones.interruptionCount += 1;
      }
    }
  }
}

function sameSurface(a: unknown, b: unknown): boolean {
  const left = a as { nativeId?: string };
  const right = b as { nativeId?: string };
  return !!left?.nativeId && left.nativeId === right?.nativeId;
}

function isProtected(type: string): boolean {
  return (
    type.startsWith('session.') ||
    type.startsWith('placement.release') ||
    type === 'placement.lost' ||
    type === 'recorder.limit'
  );
}

function jsonSize(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return 0;
  }
}
