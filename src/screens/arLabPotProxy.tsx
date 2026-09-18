import React from 'react';
import { ViroBox, ViroMaterials, ViroSphere } from '../modules/ar-placement/adapters/viro/nativeImports';
import type { RenderObject } from '../modules/ar-placement';

ViroMaterials.createMaterials({
  arPlacementPotBody: { lightingModel: 'Blinn', diffuseColor: '#b4653b' },
  arPlacementPotRim: { lightingModel: 'Blinn', diffuseColor: '#8c4a2a' },
  arPlacementSoil: { lightingModel: 'Lambert', diffuseColor: '#3a2a1e' },
  arPlacementFoliage: { lightingModel: 'Blinn', diffuseColor: '#3e8e5a' },
  arPlacementOrientationMark: { lightingModel: 'Constant', diffuseColor: '#f2c14e' },
});

export const renderPot: RenderObject = () => (
  <>
    <ViroBox width={0.25} height={0.24} length={0.25} position={[0, -0.08, 0]} materials={['arPlacementPotBody']} />
    <ViroBox width={0.27} height={0.03} length={0.27} position={[0, 0.025, 0]} materials={['arPlacementPotRim']} />
    <ViroBox width={0.21} height={0.02} length={0.21} position={[0, 0.03, 0]} materials={['arPlacementSoil']} />
    <ViroSphere radius={0.1} widthSegmentCount={16} heightSegmentCount={16} position={[0, 0.1, 0]} materials={['arPlacementFoliage']} />
    <ViroBox width={0.1} height={0.05} length={0.03} position={[0, -0.02, 0.125]} materials={['arPlacementOrientationMark']} />
  </>
);
