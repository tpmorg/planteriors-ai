# AR surface placement POC — validation note

Date: 2026-09-17.
Status: **source implementation complete — ready for native/device validation.**
Branch: `codex/ar-placement-poc` (based on `master` @ `a1e578d`). Nothing committed, pushed or deployed.

This note records the dependency decision, configuration evidence, commands run, and the
device checklist that is still outstanding. Surface detection cannot be demonstrated by a
simulator, by mocked tests, or from this note — the physical-device checks below must pass
before this POC can be called successful.

## 1. Scope implemented

An isolated, development-only screen that detects a real horizontal surface, places one
stationary pot-shaped proxy at a tapped point, and keeps it at that room location as the
phone moves, with rotation, bounded scaling, re-placement and confirmation.

Explicitly **not** implemented (out of scope for this POC): replacing the photo workflow,
AI generation, image capture/export, mapping to `PlantLocation`, persistence, cloud anchors,
room reconstruction, occlusion/shadows, botanical models, billing or backend changes.
`PlantLocationScreen.tsx` and `PlantLocation` were not modified.

## 2. Dependency decision: `@reactvision/react-viro@2.53.1` (exact)

Installed with `npm install --save-exact @reactvision/react-viro@2.53.1`, which adds
`"@reactvision/react-viro": "2.53.1"` to `package.json` dependencies and updates
`package-lock.json` (additive only — no removals, no other package version changes).

### Why this release

Installed baseline: `expo@54.0.34`, `react-native@0.81.5`, `react@19.1.0`,
`@expo/config-plugins@54.0.4`, `newArchEnabled: true`.

| Candidate | Published peer requirements | Verdict |
| --- | --- | --- |
| **2.53.1** | `expo ~54.0.10`, `react-native ~0.81.4`; dependency `react ~19.1.0` | **Chosen** — peers satisfied by 54.0.34 / 0.81.5 and the single project React 19.1.0 copy is reused (no nested `react` installed) |
| 2.44.2 | `expo ~54.0.10`, `react-native ~0.81.4` | Peers also match, but it predates the v2.53+ `ViroARPlaneSelector` ref-forwarding contract the plan requires, so it would need a documented alternative API |
| 2.54.0 / 2.55.0 / 2.56.0 | `expo >=54 <56`, `react-native >=0.81 <0.84`; dependency `react ~19.2.0` | Rejected — the `react ~19.2.0` dependency would install a second React copy alongside the project's 19.1.0 |
| 2.57.5, 2.58.1 | `expo >=55 <58`, `react-native >=0.83 <0.87` | Rejected — incompatible with Expo 54 / RN 0.81 |

Commands used for the evidence:
`npm view @reactvision/react-viro versions --json`,
`npm view @reactvision/react-viro@<v> peerDependencies dependencies engines --json`,
plus inspection of the downloaded 2.53.1 tarball.

### API verified in the installed release (not just docs)

- `components/AR/ViroARPlaneSelector.tsx` implements the v2.53+ contract: public ref methods
  `handleAnchorFound` / `handleAnchorUpdated` / `handleAnchorRemoved` / `reset`, and props
  `onPlaneSelected(plane, tapPosition?)`, `onPlaneDetected(plane) => boolean`,
  `onPlaneRemoved(anchorId)`, `alignment`, `minWidth`, `minHeight`,
  `hideOverlayOnSelection`, `disableClickSelection`, `useActualShape`, `material`.
- Children of the selector are wrapped in `<ViroNode position={tapLocalPosition}>` inside the
  selected `ViroARPlane`, i.e. **the tap transform is applied exactly once by the library**.
  The POC therefore records the world tap position for diagnostics only and passes
  `[0, 0, 0]` as the child offset (no double application).
- `components/AR/ViroARScene.tsx` forwards `onAnchorFound` / `onAnchorUpdated` /
  `onAnchorRemoved` (the removed payload can be `undefined`), `onTrackingUpdated(state, reason)`
  and `onError`. `anchorDetectionTypes` accepts `["PlanesHorizontal"]`.
- `components/AR/ViroARSceneNavigator.tsx` mirrors `props.viroAppProps` onto the
  `sceneNavigator` / `arSceneNavigator` objects that are passed to every scene, and defaults
  `provider` to `"reactvision"` — the POC sets `provider="none"` (no cloud/geospatial services).
- `components/Utilities/ViroUtils.tsx` exports the documented support check
  `isARSupportedOnDevice(): Promise<{ isARSupported: boolean }>`.
- `components/ViroConstants.ts` defines the tracking state/reason values mirrored (and
  parity-tested) in `src/components/ar/placementState.ts`.

### Native module names used by the runtime guard

Verified from the shipped binaries, not assumed:

- iOS `ios/dist/lib/libViroReact.a` + headers register `VRTARSceneNavigatorModule` and `VRTARUtils`.
- Android `android/react_viro/react_viro-release.aar` → `ARSceneNavigatorModule.getName()`
  returns `VRTARSceneNavigatorModule` (checked with `javap -c`).

The guard checks for these names via `NativeModules` **before** importing any Viro JS, so an
Expo Go / older-development-client binary is identified without loading a library whose
`requireNativeComponent(...)` calls would fail at module evaluation.

## 3. Expo config plugin

Added once to `app.json` plugins (append-only, does not disturb the existing `app.config.js`
merge):

```json
["@reactvision/react-viro", { "android": { "xRMode": ["AR"] } }]
```

`xRMode: ["AR"]` keeps the scope to phone AR: no Quest/GVR or Cardboard/Daydream registration.
No `rvApiKey`, `googleCloudApiKey`, `provider`, `cloudAnchorProvider` or
`geospatialAnchorProvider` is configured, so the plugin's credential/geolocation branches do
not run.

### Verified permission impact

`npx expo config --type introspect` was run with and without the plugin and the results were
diffed:

- **iOS `infoPlist` usage-description keys: identical before and after (8 keys).** The plugin
  only sets `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription`,
  `NSMicrophoneUsageDescription` and `NSCameraUsageDescription` when they are not already
  set, so the app's existing expo-camera / expo-image-picker / expo-media-library /
  expo-speech-recognition wording is preserved (`NSCameraUsageDescription` still reads
  "Allow Planterior AI to access your camera to take photos of rooms.").
- **Android permissions: identical before and after.** The plugin pushes a duplicate
  `android.permission.CAMERA` entry that the manifest merger de-duplicates; no
  `ACCESS_FINE_LOCATION`/`ACCESS_COARSE_LOCATION` is added because no geospatial provider or
  API key is configured. (`ACCESS_*_LOCATION` was already present in the baseline config from
  other plugins.)
- **At prebuild the plugin also adds** `android:name="com.google.ar.core" android:value="optional"`
  meta-data, a `<queries>` entry for `com.google.ar.core`, and non-required `uses-feature`
  entries (camera, autofocus, GLES 3.0, accelerometer, gyroscope). On iOS it inserts
  `pod 'ViroReact'` + `pod 'ViroKit'` into the Podfile.
- Per the plan, **no microphone, photo-library or location access is requested by the POC** at
  runtime; the plugin's usage-description strings are Info.plist text, and iOS only prompts when
  the corresponding API is called, which this screen never does.

One caveat worth recording: `expo config --type introspect` **strips dangerous mods**, so its
Android output still shows `com.google.intent.category.CARDBOARD` / `DAYDREAM` even with
`xRMode: ["AR"]`, because the module-level value the manifest mod reads is only updated inside a
dangerous mod. `@expo/config-plugins` sorts `dangerous` first in a real prebuild
(`mod-compiler.js`: `dangerous: -1`), so the AR-only mode does apply when the native project is
generated. This was confirmed by reading `mod-compiler.js` and by verifying that
`expo config --type introspect` did **not** write to the local `ios/`/`android/` folders.

## 4. Native rebuild requirement (not performed)

The installed development client **must be rebuilt** to contain Viro. A JS reload or OTA update
cannot add a native module. This task did not run `prebuild`, `expo run:*` or an EAS build.

Next steps for the device operator (user-controlled):

```bash
# either an EAS development build …
npm run build:dev:ios        # or build:dev:android
# … or a local prebuild + run
npx expo prebuild --clean
npx expo run:ios             # or: npx expo run:android
npm start                    # dev client, then open the installed build
```

Two rebuild-relevant facts:

- Viro's iOS plugin sets `EXCLUDED_ARCHS[sdk=iphonesimulator*] = arm64` and raises if
  `RCT_NEW_ARCH_ENABLED != '1'` — **the POC cannot run in the iOS simulator**; a physical
  AR-capable iPhone is required. iOS is the primary acceptance platform.
- `ios/` and `android/` already exist locally and are git-ignored (pre-existing CNG output), so
  they are not part of the diff.

## 5. How to reach the screen

`Settings` tab → (diagnostics are shown by default in `__DEV__`) → **AR Placement POC**.

The Settings entry is rendered only when `__DEV__ && onOpenARPlacementPOC`, and the
`ARPlacementPOC` root route is registered only when `__DEV__`, so the existing diagnostics
unlock cannot expose AR in production. If the route is reached anyway, the screen re-checks
`__DEV__` and renders an explanation plus Back.

## 6. Files changed

| File | Change |
| --- | --- |
| `package.json`, `package-lock.json` | Exact `@reactvision/react-viro@2.53.1` dependency |
| `app.json` | Viro config plugin with `android.xRMode: ["AR"]` |
| `src/types/navigation.ts` | `ARPlacementPOC: undefined` root route |
| `App.tsx` | `__DEV__`-gated modal route |
| `src/navigation/screenWrappers.tsx` | Settings callback + `ARPlacementPOCScreenWrapper` |
| `src/screens/SettingsScreen.tsx` | `onOpenARPlacementPOC` prop + `__DEV__` diagnostics button |
| `src/screens/ARPlacementPOCScreen.tsx` | Guard, lifecycle, controls, diagnostics |
| `src/components/ar/viroBridge.ts` | Single native Viro import boundary |
| `src/components/ar/ARPlacementScene.tsx` | Viro scene, plane detection, pot proxy |
| `src/components/ar/placementState.ts` | Pure state machine, transforms, contracts |
| `src/components/ar/__tests__/placementState.test.ts` | 23 focused unit tests |
| `docs/ar-placement-poc-validation.md` | This note |

Pre-existing, unrelated changes were left untouched: the deleted root `DEV_BUILD_SETUP.md` and
the untracked `docs/DEV_BUILD_SETUP.md`.

## 7. Commands run and results

| Command | Baseline | After change |
| --- | --- | --- |
| `npx tsc --noEmit` | 0 errors | **0 errors** |
| `npx jest` | 6 suites / 21 tests pass | **7 suites / 44 tests pass** (23 new) |
| `git diff --check` | clean | **clean** (no whitespace errors) |
| `npx expo config --type introspect` | captured | diffed against baseline (no permission changes) |
| `npm install --save-exact @reactvision/react-viro@2.53.1` | lockfile `sha256 cee2d7ce…`, 17560 lines | additive only, no removed lock lines |

Checks **not** run (deliberately, pending authorization): `expo prebuild`, `expo run:ios`,
`expo run:android`, any EAS build, and any on-device AR session.

## 8. What the unit tests do and do not prove

`src/components/ar/__tests__/placementState.test.ts` covers the pure rules the reviewer cares
about, including the three the plan calls out:

- **Anchor removal invalidates confirmation** — a confirmed placement whose anchor disappears
  becomes `placement-invalid` with the confirmation and snapshot cleared; removal of an
  unrelated anchor is a no-op.
- **Reset clears the selection** — `session/start` (fresh session) and `placement/clear`
  ("Place again") both drop the anchor, tap position, rotation, scale and confirmation, and
  return to `surface-available`/`scanning` as appropriate.
- **Scaling preserves base contact** — `getBaseContactOffsetY(scale) = 0.20 m × scale` and
  `isBaseOnSurface` holds across `[0.5, 2.0]`; base Y = offset − (scaled height / 2) = 0.
- Plus: placement is rejected unless tracking is `TRACKING_NORMAL`; confirm requires
  placed + usable tracking + anchor; tracking loss downgrades `confirmed → placed` and clears
  the confirmation; scale steps clamp to `[0.5, 2.0]`; yaw steps 15° and wraps in `[0, 360)`;
  the mirrored tracking constants match `@reactvision/react-viro@2.53.1`.

**These tests are not evidence of native tracking.** They exercise no camera, no ARKit/ARCore
and no Viro code. Plane detection can only be demonstrated on a physical device.

## 9. Scene / transform contract (review aid)

- Units: metres. The proxy is nominally 0.25 m wide and 0.40 m tall.
- Frames: the selector's tap node is plane-local with `Y = 0` on the surface. The scene then
  adds `ViroNode` yaw at that origin and a `ViroNode` at `[0, getBaseContactOffsetY(scale), 0]`
  with uniform `scale`. Because the offset and the centred assembly are scaled from the same
  origin, the base stays on the plane for every supported scale; yaw rotates about the vertical
  through the tap point.
- The proxy is built from `ViroBox` / `ViroSphere` primitives with `ViroMaterials`, plus a
  yellow orientation mark on the +Z face so rotation is visible.
- All three scene anchor events are forwarded to the selector ref; `onAnchorRemoved` guards an
  `undefined` payload. Accepted planes are kept in an id-keyed `Map` for diagnostics (no
  per-update counter). `onAnchorUpdated` updates the map by reference and does **not** set React
  state, and `onTrackingUpdated` only dispatches when the state/reason pair actually changes, so
  per-frame callbacks cannot drive constant rerenders.
- No persistent position is derived from the camera: `onCameraTransformUpdate` is not used.
  If the selected anchor disappears the placement is invalidated and the user must place again
  — there is no camera-relative fallback and no fabricated plane.
- The scan timer lives in an isolated memoised component so its 1 Hz tick cannot re-render the
  navigator or the scene.

## 10. Device validation checklist — **PENDING**

Run after an authorized rebuilt development client is installed. Record device model, OS,
platform, native build ID, exact Viro version, tested git revision, lighting/surface, and a
short observation log or recording.

| Check | Acceptance | Status |
| --- | --- | --- |
| Basic detection | Real plane events + selectable overlay in ≥3 fresh sessions on a textured, well-lit horizontal surface; record times/failures | Pending |
| Placement | Tap two distinct positions in separate attempts; proxy appears at each point with base on surface | Pending |
| World stability | Move ~1 m sideways and view from multiple angles for 30 s; proxy stays near the same physical point and does not follow the camera | Pending |
| Drift observation | With a floor marker, no obvious sliding, approximately within 5 cm at the base (visual estimate, not calibrated) | Pending |
| Adjustments | Rotation visible, size bounded, base stays on surface, exactly one object remains | Pending |
| Confirmation | Confirm disabled before valid placement / during tracking loss; object preserved after confirmation | Pending |
| Weak tracking | Cover the camera or use poor lighting; UI acknowledges tracking loss and prevents false confirmation | Pending |
| No surface | Guidance + Retry appear after 15 s; no fabricated placement | Pending |
| Permission | Deny camera access; explanation and Back work without a crash or request loop | Pending |
| Lifecycle | Close/reopen 3× and background/foreground once; camera releases and a fresh session has no stale object | Pending |
| Regression | Existing photo capture and rectangle selection still open and work after exiting AR | Pending |
| Platform coverage | iOS and Android recorded separately; untested platforms stay explicitly unverified | Pending (Android unverified by design) |

Failure triage order (per plan): correct binary/native module → camera permission/session
initialization → tracking state → raw plane events → selector forwarding → tap callback →
coordinate transforms → object visibility.

## 11. Known limitations and notes for the reviewer

- iOS is the primary acceptance platform; **Android is unverified** until tested on a supported
  physical device.
- The selector filter uses `alignment="Horizontal"` (tolerant of either horizontal alignment
  string a platform reports) and `handlePlaneDetected` additionally rejects
  `HorizontalDownward` planes, so only floors/tables are offered. A horizontal plane is still
  not proof that a surface is semantically a floor or table.
- "Usable tracking" means `TRACKING_NORMAL` only; `TRACKING_LIMITED` blocks placement and
  confirmation. If a runtime never reports tracking, nothing can be placed — by design, rather
  than fabricating a transform.
- The scene resolves its host props from `sceneNavigator.viroAppProps` (source-verified for
  2.53.1) with a fallback to `props.viroAppProps`, since the navigator mirrors `viroAppProps`
  onto the navigator objects it passes to scenes.
- Placement state (session id, anchor id, local/world transform, dimensions/scale, confirmation
  time) is held **in memory only**; nothing is written to SQLite, Firebase or `PlantLocation`.
  Foregrounding or "Reset session" remounts a clean session keyed by a new session id.
- `provider="none"` disables cloud anchors and geospatial services; no credentials are used.
- The plugin only ships prebuilt binaries (iOS `libViroReact.a`, Android `react_viro-release.aar`),
  so a real prebuild/compilation is the first place a native integration problem will appear.
  It has not been exercised yet.
