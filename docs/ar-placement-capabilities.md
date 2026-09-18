# AR placement module — capability matrix

Installed target: `@reactvision/react-viro@2.53.1` on Expo 54 / RN 0.81. Inspected from JS source and type declarations only. **No native build or device run was performed for this module.** Device validation is `device-pending` on every row.

Chosen strategy: **library-owned plane attachment** (`ViroARPlane` keyed by detected `anchorId`). Objects are children of the originating plane node. Unmounting a view is **not** native anchor detachment.

`createAnchoredNode` exists on `ViroARScene` but its comment states `ViroARNode` is not implemented. That path is **not** used.

| Capability | JS symbol | Argument / result shape | Native / source evidence | Ownership | Failure behavior | Device |
| --- | --- | --- | --- | --- | --- | --- |
| Support | `isARSupportedOnDevice`, `NativeModules.VRTARSceneNavigatorModule` (`VRTARUtils` on iOS) | `{ isARSupported: boolean }` | Package index + native module names in 2.53.1 | Host probe before Viro import | `unsupported` | pending |
| Session lifecycle | `ViroARSceneNavigator` mount / unmount | Navigator present while `starting` \| `running` | Component unmount is the teardown path in installed JS | `ViroSessionView` is the sole camera owner | `onError` → `native-error`; background → `stop` | pending |
| Plane discovery | `onAnchorFound` / `Updated` / `Removed` | `ViroAnchor`: `anchorId`, `type`, `position`, `rotation` (deg XYZ), `width`/`height`, `alignment`, `vertices?` | `components/Types/ViroEvents.ts`; `onAnchorRemoved` may be undefined | JS registry keyed by native id; public API exposes session-scoped surface ids only | Malformed payloads recorded and ignored | pending |
| Plane replacement | none | Parent / subsumed-by identity is not on `ViroAnchor` | No parent field in 2.53.1 types | `surfaceReplacement: unsupported` | No synthesized replacement ids; honor actual removals | pending |
| Tracking | `onTrackingUpdated(state, reason)` | UNAVAILABLE=1, LIMITED=2, NORMAL=3; reasons none / motion / features | `ViroConstants.ts` | Separate axis from lifecycle | Non-normal tracking invalidates confirmation | pending |
| Hit testing | `performARHitTestWithPoint(x, y)` | `ViroARHitTestResult[]`: `type`, `transform`, `_hitResultId`; **no plane id** | `ViroARScene.tsx`; hit tokens expire in 30s | Adapter; one outstanding test; tokens discarded after the sample | Estimated / feature-point hits are not confirmed placements | pending |
| Viewport units | `performARHitTestWithPoint` | Treated as view pixels, origin top-left, center = window/2 | Not independently documented in 2.53.1 | Adapter | Unverified on device | pending |
| Anchor create | `createAnchoredNode(hitResult)` | `Promise<ViroARNodeReference \| null>` | Comment: ViroARNode not implemented | **Not selected** | Callable ≠ proven create/render/update/release | pending |
| Anchor render | `ViroARPlane anchorId={nativeId}` | Children in plane-local metres | `ViroARPlane.tsx` / `VRTARPlane` | Library-owned plane attachment | Surface removal loses plane-dependent objects | pending |
| Anchor release | Unmount `ViroARPlane` children | No `releaseAnchoredNode` in 2.53.1 JS | Unmount only | Adapter JS handle set + view unmount | Failed release keeps pending ownership | pending |
| Content picking | explicit `select(objectId)` | Object list in the lab | `onClick` is declared, not device-verified | Controller selection | `object-not-found` | pending |
| Frame data | controller clock `at`; `nativeTime` optional | Plane events have no documented timestamp | `onCameraARHitTest` has camera orientation | Controller | Missing native timestamps stay `null` | pending |

## Coordinates

Public/core: metres; radians; right-handed session world, +Y up; quaternions `[x, y, z, w]`; yaw about +Y.

Viro boundary: Euler degrees, X-Y-Z with combined `R = Rx · Ry · Rz` (matches `ViroARPlaneSelector._worldToLocal` in 2.53.1). Converted by `quatFromViroEulerDegrees`.

`[0,0,0]` relative to a tap wrapper is **not** a plane-local tap location. Preview and placed content use plane-local XZ with Y = 0 on the surface, then a scaled half-height lift so a centered model sits on the plane.

A world frame can be corrected by tracking. It is not geographic or persistent.

## iOS vs Android

TypeScript is shared. **Do not claim platform parity.** Each platform remains `device-pending` until a build containing this adapter is run on that platform.
