/**
 * Single import boundary for the native `@reactvision/react-viro` dependency.
 *
 * `@reactvision/react-viro@2.53.1` registers its native view components with
 * `requireNativeComponent(...)` at module evaluation time, which fails (or warns loudly)
 * in Expo Go or in a development client built without the Viro native module. For that
 * reason nothing in the normal app bundle imports this module statically: the AR POC
 * screen loads it with a dynamic `import()` only after it has verified the Viro native
 * modules are present and AR is supported on the device.
 *
 * Keep this file to re-exports only so there is exactly one place to audit.
 */

export {
  ViroARPlaneSelector,
  ViroARScene,
  ViroARSceneNavigator,
  ViroAmbientLight,
  ViroBox,
  ViroDirectionalLight,
  ViroMaterials,
  ViroNode,
  ViroSphere,
  isARSupportedOnDevice,
} from '@reactvision/react-viro';

export type {
  ViroAnchor,
  ViroARSupportResponse,
  ViroTrackingReason,
  ViroTrackingState,
} from '@reactvision/react-viro';
