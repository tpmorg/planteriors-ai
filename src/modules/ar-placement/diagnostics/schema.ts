import { EVENT_SCHEMA_VERSION, type EventEnvelope } from '../core/types';

export const RECORDER_EVENT_LIMIT = 5000;
export const RECORDER_BYTE_LIMIT = 5 * 1024 * 1024;

export interface RecorderCheckpoint {
  at: number;
  sessionId: string;
  generation: number;
  note: string;
}

export interface DiagnosticReport {
  schemaVersion: number;
  exportedAt: number;
  diagnosticOnly: boolean;
  truncated: boolean;
  droppedEvents: number;
  checkpoints: RecorderCheckpoint[];
  capabilities: unknown;
  policy: unknown;
  host: {
    platform?: string;
    deviceModel?: string;
    osVersion?: string;
    appRevision?: string;
    buildId?: string;
  };
  milestones: {
    startToNormalTrackingMs: number | null;
    firstRawPlaneMs: number | null;
    firstEligiblePlaneMs: number | null;
    firstReadyTargetMs: number | null;
    firstPlacementMs: number | null;
    resetCount: number;
    rejectionCount: number;
    interruptionCount: number;
    pendingCleanup: number;
  };
  events: EventEnvelope[];
}

export function emptyMilestones(): DiagnosticReport['milestones'] {
  return {
    startToNormalTrackingMs: null,
    firstRawPlaneMs: null,
    firstEligiblePlaneMs: null,
    firstReadyTargetMs: null,
    firstPlacementMs: null,
    resetCount: 0,
    rejectionCount: 0,
    interruptionCount: 0,
    pendingCleanup: 0,
  };
}

export { EVENT_SCHEMA_VERSION };
