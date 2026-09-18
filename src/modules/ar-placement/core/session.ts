import type { CommandErrorCode, SessionLifecycle, TrackingState } from './types';

export const occupancy = {
  ownerId: null as string | null,
  claim(id: string): boolean {
    if (this.ownerId && this.ownerId !== id) return false;
    this.ownerId = id;
    return true;
  },
  release(id: string): void {
    if (this.ownerId === id) this.ownerId = null;
  },
  resetForTests(): void {
    this.ownerId = null;
  },
};

const ACTIVE: ReadonlySet<SessionLifecycle> = new Set(['checking', 'starting', 'running', 'interrupted']);

export function isSessionActive(lifecycle: SessionLifecycle): boolean {
  return ACTIVE.has(lifecycle);
}

export function isSessionCommandable(lifecycle: SessionLifecycle): boolean {
  return lifecycle === 'running' || lifecycle === 'interrupted';
}

export function commandBlockedBySession(
  lifecycle: SessionLifecycle,
  tracking: TrackingState,
  command: string
): CommandErrorCode | null {
  if (command === 'start') {
    return null;
  }
  if (command === 'stop' || command === 'reset') {
    return null;
  }
  if (!isSessionCommandable(lifecycle)) {
    return 'inactive-session';
  }
  if (
    (command === 'place' || command === 'commitMove' || command === 'confirm') &&
    tracking !== 'normal'
  ) {
    return 'tracking-limited';
  }
  return null;
}

export function nextGeneration(current: number): number {
  return current + 1;
}
