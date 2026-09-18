import { isFiniteVec3, isValidPose, vecLength, vecSub } from './coordinates';
import type {
  PlacementPolicy,
  Pose,
  SurfaceAlignment,
  SurfaceSnapshot,
  Vec3,
} from './types';

export interface InternalSurface {
  id: string;
  nativeId: string;
  alignment: SurfaceAlignment;
  pose: Pose;
  extent: { width: number; height: number } | null;
  boundary: Vec3[] | null;
  firstObservedAt: number;
  lastUpdatedAt: number;
  replacedById: string | null;
  nativePresent: boolean;
  nativeTrackingState: string | null;
}

export interface SurfaceChange {
  kind: 'added' | 'updated' | 'removed' | 'replaced' | 'ignored' | 'rejected';
  surface?: SurfaceSnapshot;
  fromId?: string;
  toId?: string;
  reason?: string;
}

const TOMBSTONE_LIMIT = 64;

export class SurfaceRegistry {
  private readonly byNativeId = new Map<string, InternalSurface>();
  private readonly tombstones = new Map<string, { replacedById: string | null; at: number }>();
  private readonly replacementParent = new Map<string, string>();

  constructor(
    private readonly ids: { surfaceId: (nativeId: string) => string },
    private readonly policy: PlacementPolicy
  ) {}

  clear(): void {
    this.byNativeId.clear();
    this.tombstones.clear();
    this.replacementParent.clear();
  }

  get(nativeId: string): InternalSurface | undefined {
    return this.byNativeId.get(nativeId);
  }

  getBySurfaceId(id: string): InternalSurface | undefined {
    for (const surface of this.byNativeId.values()) {
      if (surface.id === id) return surface;
    }
    return undefined;
  }

  nativeCount(): number {
    return this.byNativeId.size;
  }

  acceptedCount(): number {
    return this.snapshots().filter((surface) => surface.eligibility.eligible).length;
  }

  snapshots(): SurfaceSnapshot[] {
    return [...this.byNativeId.values()].map((surface) => this.toSnapshot(surface));
  }

  upsert(input: {
    nativeId: string;
    alignment: SurfaceAlignment;
    pose: Pose;
    at: number;
    extent?: { width: number; height: number };
    boundary?: Vec3[];
    nativeTrackingState?: string;
  }): SurfaceChange {
    if (!input.nativeId || !isValidPose(input.pose)) {
      return { kind: 'rejected', reason: 'malformed-surface' };
    }
    if (this.tombstones.has(input.nativeId)) {
      return { kind: 'ignored', reason: 'tombstoned' };
    }
    const replacedRoot = this.resolveReplacement(input.nativeId);
    if (replacedRoot && replacedRoot !== input.nativeId) {
      return { kind: 'ignored', reason: 'replaced-child' };
    }

    const existing = this.byNativeId.get(input.nativeId);
    const extent = this.normalizeExtent(input.extent);
    const boundary = this.normalizeBoundary(input.boundary);
    if (existing) {
      existing.alignment = input.alignment;
      existing.pose = input.pose;
      existing.extent = extent;
      existing.boundary = boundary;
      existing.lastUpdatedAt = input.at;
      existing.nativePresent = true;
      existing.nativeTrackingState = input.nativeTrackingState ?? existing.nativeTrackingState;
      return { kind: 'updated', surface: this.toSnapshot(existing) };
    }

    const created: InternalSurface = {
      id: this.ids.surfaceId(input.nativeId),
      nativeId: input.nativeId,
      alignment: input.alignment,
      pose: input.pose,
      extent,
      boundary,
      firstObservedAt: input.at,
      lastUpdatedAt: input.at,
      replacedById: null,
      nativePresent: true,
      nativeTrackingState: input.nativeTrackingState ?? null,
    };
    this.byNativeId.set(input.nativeId, created);
    return { kind: 'added', surface: this.toSnapshot(created) };
  }

  remove(nativeId: string, at: number): SurfaceChange {
    const existing = this.byNativeId.get(nativeId);
    if (!existing) {
      this.rememberTombstone(nativeId, null, at);
      return { kind: 'ignored', reason: 'unknown-surface' };
    }
    this.byNativeId.delete(nativeId);
    this.rememberTombstone(nativeId, existing.replacedById, at);
    return { kind: 'removed', surface: this.toSnapshot({ ...existing, nativePresent: false }) };
  }

  replace(childNativeId: string, parentNativeId: string, at: number): SurfaceChange {
    if (!childNativeId || !parentNativeId || childNativeId === parentNativeId) {
      return { kind: 'rejected', reason: 'malformed-replace' };
    }
    if (this.wouldCycle(childNativeId, parentNativeId)) {
      return { kind: 'rejected', reason: 'replacement-cycle' };
    }

    this.replacementParent.set(childNativeId, parentNativeId);
    const child = this.byNativeId.get(childNativeId);
    const parent = this.byNativeId.get(parentNativeId);

    if (child) {
      child.replacedById = parent?.id ?? this.ids.surfaceId(parentNativeId);
      this.byNativeId.delete(childNativeId);
      this.rememberTombstone(childNativeId, child.replacedById, at);
    } else {
      this.rememberTombstone(childNativeId, parent?.id ?? this.ids.surfaceId(parentNativeId), at);
    }

    return {
      kind: 'replaced',
      fromId: child?.id ?? this.ids.surfaceId(childNativeId),
      toId: parent?.id ?? this.ids.surfaceId(parentNativeId),
      surface: parent ? this.toSnapshot(parent) : undefined,
    };
  }

  nearestEligible(worldPosition: Vec3, alignment: SurfaceAlignment): InternalSurface | undefined {
    let best: InternalSurface | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const surface of this.byNativeId.values()) {
      const snapshot = this.toSnapshot(surface);
      if (!snapshot.eligibility.eligible) continue;
      if (surface.alignment !== alignment) continue;
      const distance = vecLength(vecSub(worldPosition, surface.pose.position));
      if (distance < bestDistance) {
        best = surface;
        bestDistance = distance;
      }
    }
    return best;
  }

  private wouldCycle(childNativeId: string, parentNativeId: string): boolean {
    let cursor: string | undefined = parentNativeId;
    const seen = new Set<string>([childNativeId]);
    while (cursor) {
      if (seen.has(cursor)) return true;
      seen.add(cursor);
      cursor = this.replacementParent.get(cursor);
    }
    return false;
  }

  private resolveReplacement(nativeId: string): string {
    let cursor = nativeId;
    const seen = new Set<string>();
    while (this.replacementParent.has(cursor)) {
      if (seen.has(cursor)) break;
      seen.add(cursor);
      cursor = this.replacementParent.get(cursor) ?? cursor;
    }
    return cursor;
  }

  private rememberTombstone(nativeId: string, replacedById: string | null, at: number): void {
    this.tombstones.set(nativeId, { replacedById, at });
    while (this.tombstones.size > TOMBSTONE_LIMIT) {
      const oldest = this.tombstones.keys().next().value;
      if (!oldest) break;
      this.tombstones.delete(oldest);
    }
  }

  private normalizeExtent(
    extent?: { width: number; height: number }
  ): { width: number; height: number } | null {
    if (!extent) return null;
    if (!Number.isFinite(extent.width) || !Number.isFinite(extent.height)) return null;
    return extent;
  }

  private normalizeBoundary(boundary?: Vec3[]): Vec3[] | null {
    if (!boundary) return null;
    if (!boundary.every((vertex) => isFiniteVec3(vertex))) return null;
    return boundary;
  }

  private toSnapshot(surface: InternalSurface): SurfaceSnapshot {
    const reasons: string[] = [];
    if (surface.alignment !== this.policy.surface) reasons.push('wrong-alignment');
    if (!surface.nativePresent) reasons.push('native-removed');
    if (
      surface.extent &&
      (surface.extent.width < this.policy.minExtentM || surface.extent.height < this.policy.minExtentM)
    ) {
      reasons.push('insufficient-footprint');
    }
    return {
      id: surface.id,
      alignment: surface.alignment,
      pose: surface.pose,
      extent: surface.extent,
      boundary: surface.boundary,
      firstObservedAt: surface.firstObservedAt,
      lastUpdatedAt: surface.lastUpdatedAt,
      replacedById: surface.replacedById,
      eligibility: { eligible: reasons.length === 0, reasons },
      nativePresent: surface.nativePresent,
    };
  }
}
