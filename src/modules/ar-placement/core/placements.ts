import { clamp, composePose, modelCenterAboveContact, poseFromPositionYaw } from './coordinates';
import type {
  ContentDescriptor,
  LocalTransform,
  ObjectSnapshot,
  PlacementLifecycle,
  Pose,
} from './types';

export interface MoveBackup {
  handleId: string | null;
  surfaceId: string | null;
  nativeSurfaceId: string | null;
  anchorPose: Pose;
  localTransform: LocalTransform;
}

export interface InternalObject {
  id: string;
  contentId: string;
  lifecycle: PlacementLifecycle;
  surfaceId: string | null;
  nativeSurfaceId: string | null;
  handleId: string | null;
  previousHandleId: string | null;
  anchorPose: Pose;
  pose: Pose;
  localTransform: LocalTransform;
  dimensions: { width: number; height: number; depth: number };
  pivot: ContentDescriptor['pivot'];
  confirmed: boolean;
  lostReason: string | null;
  content: ContentDescriptor;
  moveBackup: MoveBackup | null;
}

export function createPlacedObject(input: {
  id: string;
  content: ContentDescriptor;
  surfaceId: string;
  nativeSurfaceId: string;
  anchorPose: Pose;
  localTranslation: readonly [number, number, number];
}): InternalObject {
  const localTransform: LocalTransform = {
    translation: input.localTranslation,
    yawRadians: 0,
    scale: 1,
  };
  return {
    id: input.id,
    contentId: input.content.contentId,
    lifecycle: 'placing',
    surfaceId: input.surfaceId,
    nativeSurfaceId: input.nativeSurfaceId,
    handleId: null,
    previousHandleId: null,
    anchorPose: input.anchorPose,
    pose: withObjectPose(input.anchorPose, localTransform, input.content),
    localTransform,
    dimensions: input.content.dimensions,
    pivot: input.content.pivot,
    confirmed: false,
    lostReason: null,
    content: input.content,
    moveBackup: null,
  };
}

export function withObjectPose(
  anchorPose: Pose,
  local: LocalTransform,
  content: ContentDescriptor
): Pose {
  const lift = modelCenterAboveContact(content.dimensions, local.scale);
  const localPose = poseFromPositionYaw(
    [local.translation[0], lift, local.translation[2]],
    local.yawRadians
  );
  return composePose(anchorPose, localPose);
}

export function applyTransform(
  object: InternalObject,
  patch: { yawRadians?: number; scale?: number }
): InternalObject {
  const min = object.content.minScale;
  const max = object.content.maxScale;
  const scale =
    patch.scale === undefined ? object.localTransform.scale : clamp(patch.scale, min, max);
  const yawRadians = patch.yawRadians ?? object.localTransform.yawRadians;
  const localTransform: LocalTransform = {
    ...object.localTransform,
    yawRadians,
    scale,
  };
  return {
    ...object,
    localTransform,
    pose: withObjectPose(object.anchorPose, localTransform, object.content),
    confirmed: false,
    lifecycle: object.lifecycle === 'confirmed' ? 'placed' : object.lifecycle,
  };
}

export function retarget(object: InternalObject, surfaceId: string, nativeSurfaceId: string, anchorPose: Pose): InternalObject {
  return {
    ...object,
    surfaceId,
    nativeSurfaceId,
    anchorPose,
    pose: withObjectPose(anchorPose, object.localTransform, object.content),
    confirmed: false,
  };
}

export function toObjectSnapshot(object: InternalObject): ObjectSnapshot {
  return {
    id: object.id,
    contentId: object.contentId,
    lifecycle: object.lifecycle,
    surfaceId: object.surfaceId,
    pose: object.pose,
    localTransform: object.localTransform,
    dimensions: object.dimensions,
    pivot: object.pivot,
    confirmed: object.confirmed,
    lostReason: object.lostReason,
  };
}

export function markLost(object: InternalObject, reason: string): InternalObject {
  return {
    ...object,
    lifecycle: 'lost',
    confirmed: false,
    lostReason: reason,
    moveBackup: null,
  };
}
