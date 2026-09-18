import React from 'react';

import { modelCenterAboveContact, radiansToDegrees } from '../../core/coordinates';
import type { ARPlacementController } from '../../core/controller';
import type { ARSnapshot, ObjectSnapshot } from '../../core/types';
import { ViroARPlane, ViroMaterials, ViroNode, ViroQuad } from './nativeImports';

ViroMaterials.createMaterials({
  arPlacementPlaneOverlay: {
    lightingModel: 'Constant',
    diffuseColor: '#4C8DFF55',
  },
});

export interface RenderObjectContext {
  object: ObjectSnapshot;
  preview: boolean;
}

export type RenderObject = (context: RenderObjectContext) => React.ReactNode;

export function ViroPlacementContent({
  snapshot,
  controller,
  renderObject,
  showOverlays,
}: {
  snapshot: ARSnapshot;
  controller: ARPlacementController;
  renderObject: RenderObject;
  showOverlays: boolean;
}) {
  const objectsBySurface = new Map<string, ObjectSnapshot[]>();
  for (const object of snapshot.objects) {
    if (!object.surfaceId || object.lifecycle === 'lost' || object.lifecycle === 'removing') continue;
    const list = objectsBySurface.get(object.surfaceId) ?? [];
    list.push(object);
    objectsBySurface.set(object.surfaceId, list);
  }

  return (
    <>
      {snapshot.surfaces.map((surface) => {
        const nativeId = controller.nativeSurfaceIdFor(surface.id);
        if (!nativeId) return null;
        const objects = objectsBySurface.get(surface.id) ?? [];
        const preview =
          snapshot.target?.surfaceId === surface.id &&
          snapshot.target.eligible &&
          snapshot.target.planeLocalPosition;
        return (
          <ViroARPlane key={surface.id} anchorId={nativeId}>
            {showOverlays && surface.nativePresent ? (
              <ViroQuad
                width={surface.extent?.width ?? 0.5}
                height={surface.extent?.height ?? 0.5}
                rotation={[-90, 0, 0]}
                materials={['arPlacementPlaneOverlay']}
              />
            ) : null}
            {objects.map((object) => (
              <PlacedNode key={object.id} object={object} renderObject={renderObject} />
            ))}
            {preview && snapshot.target?.planeLocalPosition ? (
              <ViroNode
                position={[
                  snapshot.target.planeLocalPosition[0],
                  modelCenterAboveContact({ height: 0.4 }, 1),
                  snapshot.target.planeLocalPosition[2],
                ]}
                opacity={0.45}
              >
                {renderObject({
                  object: {
                    id: 'preview',
                    contentId: 'preview',
                    lifecycle: 'placed',
                    surfaceId: surface.id,
                    pose: snapshot.target.pose,
                    localTransform: {
                      translation: snapshot.target.planeLocalPosition,
                      yawRadians: 0,
                      scale: 1,
                    },
                    dimensions: { width: 0.2, height: 0.4, depth: 0.1 },
                    pivot: [0, 0.2, 0],
                    confirmed: false,
                    lostReason: null,
                  },
                  preview: true,
                })}
              </ViroNode>
            ) : null}
          </ViroARPlane>
        );
      })}
    </>
  );
}

function PlacedNode({
  object,
  renderObject,
}: {
  object: ObjectSnapshot;
  renderObject: RenderObject;
}) {
  const lift = modelCenterAboveContact(object.dimensions, object.localTransform.scale);
  const yawDeg = radiansToDegrees(object.localTransform.yawRadians);
  const scale = object.localTransform.scale;
  return (
    <ViroNode rotation={[0, yawDeg, 0]}>
      <ViroNode
        position={[object.localTransform.translation[0], lift, object.localTransform.translation[2]]}
        scale={[scale, scale, scale]}
      >
        {renderObject({ object, preview: false })}
      </ViroNode>
    </ViroNode>
  );
}
