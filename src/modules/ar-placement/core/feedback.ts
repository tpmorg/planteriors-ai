import type { ARSnapshot, FeedbackSnapshot, FeedbackSeverity } from './types';

interface Candidate {
  code: string;
  severity: FeedbackSeverity;
  params?: FeedbackSnapshot['params'];
  heuristic?: boolean;
  rank: number;
}

export function selectFeedback(snapshot: Pick<
  ARSnapshot,
  'session' | 'target' | 'objects' | 'surfaces'
>): FeedbackSnapshot {
  const candidates: Candidate[] = [];
  const { session, target, objects, surfaces } = snapshot;

  if (session.lifecycle === 'failed' && session.failure) {
    candidates.push({
      code: session.failure.code === 'unsupported' ? 'session.unsupported' : 'session.failed',
      severity: 'fatal',
      params: { message: session.failure.message, code: session.failure.code },
      rank: 0,
    });
  }
  if (session.failure?.code === 'permission-denied') {
    candidates.push({
      code: 'session.permissionDenied',
      severity: 'error',
      params: { message: session.failure.message },
      rank: 4,
    });
  }
  if (session.lifecycle === 'interrupted') {
    candidates.push({ code: 'session.interrupted', severity: 'error', rank: 1 });
  }
  if (session.tracking === 'unavailable') {
    candidates.push({ code: 'tracking.unavailable', severity: 'error', rank: 1 });
  } else if (session.tracking === 'limited') {
    const code =
      session.trackingReason === 'insufficient-features'
        ? 'tracking.insufficientFeatures'
        : session.trackingReason === 'excessive-motion'
          ? 'tracking.excessiveMotion'
          : 'tracking.limited';
    candidates.push({ code, severity: 'warning', rank: 1 });
  }

  const lost = objects.find((object) => object.lifecycle === 'lost');
  if (lost) {
    candidates.push({
      code: 'placement.lost',
      severity: 'error',
      params: { objectId: lost.id, reason: lost.lostReason ?? 'unknown' },
      rank: 2,
    });
  }

  if (session.lifecycle === 'running' && session.tracking === 'normal') {
    const eligible = surfaces.some((surface) => surface.eligibility.eligible);
    if (!eligible) {
      candidates.push({ code: 'scan.moveSlowly', severity: 'info', rank: 5 });
    } else if (!target || !target.eligible) {
      const reason = target?.rejectionReasons[0] ?? 'no-valid-hit';
      const code = reason === 'out-of-range' ? 'target.outOfRange' : 'target.none';
      candidates.push({ code, severity: 'info', params: { reason }, rank: 5 });
    } else if (target.ready) {
      candidates.push({
        code: 'target.ready',
        severity: 'success',
        heuristic: true,
        rank: 6,
      });
    } else {
      candidates.push({
        code: 'target.acquiring',
        severity: 'info',
        heuristic: true,
        rank: 6,
      });
    }
  }

  const confirmed = objects.find((object) => object.confirmed);
  if (confirmed && session.tracking === 'normal') {
    candidates.push({
      code: 'placement.confirmed',
      severity: 'success',
      params: { objectId: confirmed.id },
      rank: 7,
    });
  }

  if (session.placementsClearedOnRestart) {
    candidates.push({ code: 'session.restarted', severity: 'warning', rank: 3 });
  }

  candidates.sort((a, b) => a.rank - b.rank);
  const chosen = candidates[0] ?? {
    code: 'session.idle',
    severity: 'info' as const,
    rank: 99,
  };
  return {
    code: chosen.code,
    severity: chosen.severity,
    params: chosen.params ?? {},
    heuristic: chosen.heuristic === true,
  };
}
