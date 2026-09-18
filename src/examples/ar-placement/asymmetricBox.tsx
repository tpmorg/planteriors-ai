import React from 'react';
import { ViroBox, ViroMaterials } from '../../modules/ar-placement/adapters/viro/nativeImports';
import type { RenderObject } from '../../modules/ar-placement';

ViroMaterials.createMaterials({
  arExampleBox: { lightingModel: 'Blinn', diffuseColor: '#d9a441' },
  arExampleMark: { lightingModel: 'Constant', diffuseColor: '#1d4ed8' },
});

export const renderAsymmetricBox: RenderObject = () => (
  <>
    <ViroBox width={0.2} height={0.4} length={0.1} materials={['arExampleBox']} />
    <ViroBox width={0.04} height={0.04} length={0.08} position={[0.08, 0.18, 0.05]} materials={['arExampleMark']} />
  </>
);
