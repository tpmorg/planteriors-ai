import { anchorFromWorld, isValidPose, vecLength } from './coordinates';
import type { SurfaceRegistry } from './surfaces';
import type {
  ContentDescriptor,
  HitType,
  PlacementPolicy,
  Pose,
  TargetSnapshot,
} from './types';

const EXISTING_HITS: ReadonlySet<HitType> = new Set(['existing-plane-extent', 'existing-plane']);

export function evaluateTarget(input: {
  generation: number;
  version: number;
  at: number;
  hitType: HitType;
  pose: Pose;
  distanceM?: number;
  surfaceNativeId?: string;
  surfaces: SurfaceRegistry;
  policy: PlacementPolicy;
  previous: TargetSnapshot | null;
  content?: ContentDescriptor;
  scale?: number;
}): TargetSnapshot | { rejected: true; reason: string } {
  if (!isValidPose(input.pose)) {
    return { rejected: true, reason: 'malformed-hit' };
  }

  const rejectionReasons: string[] = [];
  if (!EXISTING_HITS.has(input.hitType)) {
    rejectionReasons.push('not-existing-plane');
  }

  const matched = input.surfaceNativeId
    ? input.surfaces.get(input.surfaceNativeId)
    : input.surfaces.nearestEligible(input.pose.position, input.policy.surface);

  if (!matched) {
    rejectionReasons.push('no-matching-surface');
  } else {
    const snapshot = input.surfaces.snapshots().find((item) => item.id === matched.id);
    if (snapshot && !snapshot.eligibility.eligible) {
      rejectionReasons.push(...snapshot.eligibility.reasons);
    }
  }

  if (input.distanceM !== undefined) {
    if (!Number.isFinite(input.distanceM)) {
      rejectionReasons.push('malformed-distance');
    } else if (input.distanceM < input.policy.rangeMinM || input.distanceM > input.policy.rangeMaxM) {
      rejectionReasons.push('out-of-range');
    }
  }

  let fit: TargetSnapshot['fit'] = 'unknown';
  if (matched?.extent && input.content) {
    const width = input.content.dimensions.width * (input.scale ?? 1);
    const depth = input.content.dimensions.depth * (input.scale ?? 1);
    fit =
      width <= matched.extent.width && depth <= matched.extent.height
        ? 'fits'
        : 'too-large';
  }

  const eligible = rejectionReasons.length === 0 && !!matched;
  const switched =
    input.previous &&
    matched &&
    input.previous.surfaceId !== matched.id &&
    input.at - input.previous.sampleTime < input.policy.hysteresisMs;

  const surfaceId = switched ? input.previous?.surfaceId ?? null : matched?.id ?? null;
  const sameTarget =
    input.previous &&
    input.previous.surfaceId === surfaceId &&
    input.previous.eligible === eligible;

  const stableMs = sameTarget ? input.previous!.stableMs + (input.at - input.previous!.sampleTime) : 0;
  const ready = eligible && stableMs >= input.policy.readyStableMs;

  return {
    generation: input.generation,
    version: input.version,
    hitType: input.hitType,
    surfaceId,
    pose: input.pose,
    sampleTime: input.at,
    eligible,
    rejectionReasons,
    stableMs,
    ready,
    readyIsHeuristic: true,
    fit,
    planeLocalPosition: null,
  };
}

export function isFreshTarget(target: TargetSnapshot | null, now: number, policy: PlacementPolicy): boolean {
  if (!target || !target.eligible) return false;
  return now - target.sampleTime <= policy.maxTargetAgeMs;
}

export function planeLocalFromTarget(target: TargetSnapshot, surfaces: SurfaceRegistry): Pose | null {
  if (!target.surfaceId) return null;
  const surface = surfaces.getBySurfaceId(target.surfaceId);
  if (!surface) return null;
  const local = anchorFromWorld(surface.pose, target.pose.position);
  return {
    position: [local[0], 0, local[2]],
    rotation: target.pose.rotation,
  };
}

export function horizontalDistance(pose: Pose): number {
  return vecLength([pose.position[0], 0, pose.position[2]]);
}
