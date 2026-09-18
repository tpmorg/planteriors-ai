import type { IdSource, RuntimeClock } from './types';

export function createMemoryClock(start = 0): RuntimeClock & { advance(ms: number): void; set(ms: number): void } {
  let now = start;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
    set: (ms: number) => {
      now = ms;
    },
  };
}

export function createSequentialIds(prefix = 't'): IdSource {
  let session = 0;
  let object = 0;
  let operation = 0;
  let controller = 0;
  return {
    sessionId: () => `${prefix}-session-${++session}`,
    objectId: () => `${prefix}-obj-${++object}`,
    operationId: () => `${prefix}-op-${++operation}`,
    controllerId: () => `${prefix}-ctl-${++controller}`,
    surfaceId: (nativeId: string) => `${prefix}-surf-${nativeId}`,
  };
}
