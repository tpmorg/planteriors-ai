# AR surface placement POC — implementation handoff

Date: 2026-09-17. Status: plan only; implementation and device validation pending.

## Objective and scope

Prove that a user can detect a real horizontal surface, tap a location, and place one stationary 3D plant proxy in a live camera view. The object must remain at the chosen room location as the phone moves. The purpose is to establish whether AR can replace manual rectangle selection in a later product iteration.

Deliver an isolated development-only screen inside this app. Use a simple pot-shaped object assembled from Viro primitives; no downloaded plant model is needed. Include repositioning by resetting and tapping again, rotation, bounded size adjustment, and confirmation of the current placement within the session.

Primary acceptance platform: a physical AR-capable iPhone. Keep shared code suitable for Android, but report Android as unverified until tested on a supported physical Android device. Neither a simulator nor mocked tests can demonstrate surface detection.

Not part of this POC: replacing the existing photo workflow, AI generation, image capture/export, converting coordinates to `PlantLocation`, persistence across sessions, cloud anchors, room reconstruction, realistic occlusion/shadows, botanical models, billing or backend changes. These are separate follow-ups after the tracking proof passes.

## Verified checkout and boundaries

- Planning checkout: `/Users/timmorgan/Development/mobile/react/planteriorai`, branch `master`, HEAD `a1e578d`. Recheck before editing.
- Versions in package.json: Expo `~54.0.34`, React Native `0.81.5`, React `19.1.0`, `expo-dev-client ~6.0.21`. `app.json` enables the new architecture. No Viro dependency is installed.
- Navigation now lives in `src/types/navigation.ts` and `src/navigation/screenWrappers.tsx`; the older project quick reference is not authoritative for current routing.
- `App.tsx` registers root stack screens. `SettingsScreenWrapper` already supplies callbacks to `SettingsScreen`. Settings has diagnostics controls and a `__DEV__` convention.
- `PlantLocationScreen.tsx` implements rectangle selection. `PlantLocation` in `src/types/index.ts` is normalized image-space geometry, not AR coordinates. Leave both unchanged.
- `app.config.js` extends app.json and injects environment values. Add the plugin once without disrupting that merge or existing native plugins.
- npm/package-lock.json is the dependency workflow. No tracked ios/ or android/ files were found during planning; recheck native folder state before any prebuild.
- Existing unrelated changes: deleted root `DEV_BUILD_SETUP.md` and untracked `docs/DEV_BUILD_SETUP.md`. Preserve these and any newer user changes; do not stage or revert them.

Use a focused branch such as `codex/ar-placement-poc` when implementation begins. Do not commit, push, deploy, run native builds, or run prebuild unless the user explicitly authorizes those actions. Package installation and source implementation belong to this handoff; native build execution remains a separate user-controlled step. When an EAS build is explicitly requested, return its URL after submission without polling unless asked.

## Ownership and sequence

One implementation agent owns the whole POC. No parallel agents are required. Work in the ordered steps below, and hand the complete diff and evidence back for review. The reviewing agent checks native integration, placement correctness, lifecycle behavior, scope, and evidence. The user or an authorized device operator supplies the physical-device run.

Do not merge before review. Keep dependency/config edits, the AR feature, navigation wiring, and validation notes easy to identify in the diff. Avoid general refactors or fixing unrelated compiler failures.

## Step 1 — establish a compatible native integration

1. Read current repository instructions, status, package versions, navigation, and `docs/DEV_BUILD_SETUP.md`. Record baseline `npx tsc --noEmit` output using installed tooling; do not fetch an unrelated compiler if dependencies are absent.
2. Select an exact published `@reactvision/react-viro` release supporting Expo 54, RN 0.81, and the enabled new architecture. Verify package peer dependencies, release notes, installed TypeScript declarations, and plugin source. Record the chosen version and evidence in the validation note. Do not blindly install latest or upgrade Expo/React Native to make it fit.
3. Current online docs describe the v2.53+ selector API. Use a compatible release with that API, or document the exact supported alternative before writing the scene. Never mix examples from different releases.
4. Install the pinned dependency and update package-lock.json. Add its Expo config plugin once. Use phone AR only; no Quest, cloud anchors, geospatial services, API credentials, or hosted services are needed for this scope. Check plugin defaults rather than assuming every documented optional feature is required.
5. Preserve existing camera permission wording/configuration unless a narrow AR wording addition is needed. Do not request microphone, photo-library, or location access for the POC. Inspect any permissions the plugin adds and explain them in the handoff.
6. Document that the existing installed development client must be rebuilt to contain Viro. A JS reload or OTA update cannot add the native module. Stop short of running that build unless authorized.

Gate: dependency/plugin versions and actual APIs are established; no framework upgrade, force install, or broad native patch is required. If incompatible, report the exact constraint and a proposed next step instead of inventing runtime shims.

## Step 2 — add an isolated entry and lifecycle-safe host

Suggested ownership map; adjust names only to fit existing conventions:

| File | Change |
| --- | --- |
| `package.json`, `package-lock.json` | Exact Viro dependency |
| `app.json` | Viro plugin; minimal verified options |
| `src/types/navigation.ts` | `ARPlacementPOC: undefined` root route |
| `App.tsx` | Development-only modal route |
| `src/navigation/screenWrappers.tsx` | Settings callback navigating to root POC route |
| `src/screens/SettingsScreen.tsx` | Optional `onOpenARPlacementPOC` callback and development-only diagnostics button |
| `src/screens/ARPlacementPOCScreen.tsx` | Permission/runtime guard, controls, status, lifecycle |
| `src/components/ar/ARPlacementScene.tsx` | Viro scene and placement implementation |
| `src/components/ar/placementState.ts` | Small typed state/validation helpers, only if useful |
| `docs/ar-placement-poc-validation.md` | Version rationale, commands, failures, device evidence and remaining gaps |

Guard both the entry button and route with `__DEV__`; the existing diagnostics unlock must not expose AR in production. Use the established Settings callback pattern and typed root navigation.

Keep Viro imports behind the guarded native feature boundary. Opening ordinary app screens must not initialize AR. Expo Go, web, and unsupported devices should receive a clear explanation and Back action if the screen is reached; verify the installed library's documented support-check mechanism. A JS error boundary cannot catch native crashes and is not a substitute for capability checks. If an older development binary is missing Viro, identify that condition safely using verified library/native registration details, or document the rebuild prerequisite and limitation explicitly.

The AR view owns the camera while active; do not mount `CameraView` alongside it. Unmount the navigator when leaving the screen or when the app backgrounds. For this POC, foregrounding starts a fresh session and asks the user to place again. Clear placement and stale callbacks together when restarting; do not present an old transform as a restored anchor.

## Step 3 — make actual surface detection observable

Use `ViroARSceneNavigator` and one stable scene component; do not recreate scene definitions or remount the navigator on every state update. Use the installed library's supported mechanism to communicate between the scene and React Native controls.

Enable horizontal plane detection explicitly. For the documented v2.53+ API, wire all three scene anchor events into the `ViroARPlaneSelector` ref: found, updated, removed; guard nullable removal payloads. Verify these signatures against the installed release. Show detected surface overlays before selection and hide them after selection. [Selector reference](https://viro-community.readme.io/docs/viroarplaneselector)

Maintain an anchor map keyed by ID for diagnostics, rather than incrementing a counter on every update. Track real tracking-state changes and native session errors. Throttle diagnostic rendering so per-frame callbacks do not trigger constant React rerenders.

Provide a compact diagnostic panel: tracking state/reason if available, detected plane count, selected anchor ID, placement state, elapsed scan time, and last error. Include Reset session and Back. Logs must not include credentials, images, user information, or per-frame dumps.

Suggested state flow: checking support/permission → scanning → surface available → placed → confirmed. Permission denial and unsupported runtime are explicit terminal states with Back; tracking interruptions are recoverable states that disable confirmation.

Copy: “Move your phone slowly to find a floor or table,” then “Tap a highlighted surface.” After 15 seconds without a plane, offer better-lighting/movement guidance and Retry; this timer is a UX threshold, not a promise that detection should always finish in 15 seconds. Do not fabricate a plane or place at a fixed camera distance when detection fails. A horizontal plane is not proof that a surface is semantically a floor or table.

## Step 4 — place, adjust, and confirm one object

Start with one solid, visibly asymmetric primitive assembly resembling a pot, approximately 0.25 m wide and 0.40 m tall. Include a small orientation mark so rotation is visible. Use basic materials and lighting; no asset pipeline or model downloads.

On a valid surface tap, attach exactly one object at the tap point. Verify whether the selector already applies the tap transform in the selected release. Do not apply a world-space tap position a second time as a child-local offset. Document the coordinate frame, units, and parent transform used. Position the object's base on the surface; a centered primitive needs half its height as a local vertical offset.

Accept placement only with usable tracking and a valid detected plane. Never derive persistent object position from the changing camera position. Plane refinement may update anchoring, but must not silently move the plant to a new plane center. If the selected anchor disappears, mark placement invalid and require re-placement; no silent camera-relative fallback.

Use simple controls for the POC: Rotate left/right in 15-degree yaw steps, Smaller/Larger with scale clamped to 0.5–2.0 of nominal size, Place again, Confirm, and Reset session. Scaling must preserve base contact with the plane. Place again clears the old selection and shows surfaces again. Dragging/pinch gestures are optional follow-up work, not required here.

Confirm freezes adjustment controls and displays “Placement confirmed” while leaving the object visible in the live AR scene. Allow Edit placement or Place again. Hold only an in-memory placement snapshot: session ID, anchor ID, explicitly named local/world transform, dimensions/scale, and confirmation time. Do not save AR transforms into `PlantLocation`, SQLite, or Firebase. Invalidate confirmation on tracking/anchor loss and on session restart.

Gate: source implementation supports the complete isolated flow. If a device is unavailable, finish source checks and report “ready for native/device validation,” not “AR works.”

## Step 5 — verification and failure triage

Run `git diff --check` and the same TypeScript command used for the baseline. Report pre-existing failures separately. If state/transform helpers contain meaningful logic, add focused tests for anchor removal invalidating confirmation, reset clearing selection, and scale preserving base contact. Mock tests must not be offered as evidence of native tracking.

With an explicitly authorized rebuilt development client, run this physical-device checklist. Record device model, OS, platform, native build ID, exact Viro version, tested git revision, lighting/surface, and a short recording or observation log.

| Check | Acceptance |
| --- | --- |
| Basic detection | On a textured, well-lit horizontal surface, get real plane events and a selectable overlay in at least 3 fresh sessions; record times and failures |
| Placement | Tap two distinct positions in separate attempts; proxy appears at each chosen point with base on surface |
| World stability | In each attempt, move roughly 1 m sideways and view from multiple angles for 30 seconds; proxy remains near the same physical reference point and does not follow the camera |
| Drift observation | Use a floor marker; target no obvious sliding, approximately within 5 cm at base. Label this a visual estimate, not calibrated accuracy |
| Adjustments | Rotation visible, size bounded, base stays on surface, exactly one object remains |
| Confirmation | Disabled before valid placement/during tracking loss; preserves object after confirmation |
| Weak tracking | Cover camera or use poor lighting; UI acknowledges tracking loss and prevents false confirmation |
| No surface | Guidance and Retry appear; no fabricated placement |
| Permission | Deny camera access; explanation and Back work without a crash or request loop |
| Lifecycle | Close/reopen 3 times and background/foreground once; camera releases and fresh session contains no stale object |
| Regression | Existing photo capture and rectangle-selection flow still open and work after exiting AR |
| Platform coverage | Record iOS and Android results separately; untested platforms stay explicitly unverified |

Do not automatically retry native builds. Investigate failures in this order: correct binary/native module → camera permission/session initialization → tracking state → raw plane events → selector forwarding → tap callback → coordinate transforms → object visibility. If plane events are absent, model changes cannot solve detection. If events exist but overlays do not, inspect selector integration. If tapping works but the object is invisible, inspect transforms, scale, material and clipping.

After two unsuccessful fixes for the same symptom without new evidence, stop speculative edits and hand back logs, exact versions, attempted fixes, and the next diagnostic needed. Do not replace Viro, disable the new architecture, or introduce a custom Swift/Kotlin bridge inside this POC without a revised scope.

## Completion report and reviewer checklist

The implementation agent must deliver:

1. Summary of changed files and exact dependency/config choices.
2. Commands run, baseline versus new failures, and checks not run.
3. How to reach the screen and which development-client rebuild is required.
4. Device evidence linked from the validation note, or an explicit pending-device status.
5. Known limitations, unresolved errors, and any departure from this plan.

Reviewer: confirm all three anchor events are forwarded correctly, selected coordinates are transformed once, resizing preserves floor contact, camera updates cannot drag the object, anchor loss invalidates confirmation, and background/navigation cleanup releases the camera. Check production gating, permissions, dependency compatibility and lockfile scope. Verify the existing placement/generation route was not modified. Separate “code reviewed” from “native build passed” and “physical tracking validated.”

POC success requires the physical-device placement/stability checks to pass. Source completion alone is a valid handoff milestone, but not a successful feasibility demonstration.

## Follow-up after successful review/device proof

A later change can introduce a real plant model and connect AR to generation. That requires capturing a clean room frame and projecting object bounds into that exact frame with matching camera pose, orientation, crop and image dimensions. A composited AR screenshot contains the proxy; a later photograph may have a different viewpoint. Resolve that capture contract before mapping to normalized `PlantLocation`, and validate the generated image's placement independently. Do not implement this follow-up during the POC.

## References verified during planning

- [Viro Expo integration](https://viro-community.readme.io/docs/integrating-with-expo): native development client required; AR support documented for Expo 54+. Verify the chosen release, not only current docs.
- [Plane selector](https://viro-community.readme.io/docs/viroarplaneselector): v2.53+ event forwarding and tap placement contract.
- [AR scene](https://viro-community.readme.io/docs/viroarscene): tracking, anchor and camera callbacks.
- [Official Expo starter](https://github.com/ReactVision/expo-starter-kit-typescript): compare a version-matched minimal example if troubleshooting. Do not copy its entire navigation or dependency stack.

## Paste-ready implementation assignment

Implement `docs/ar-placement-poc-plan.md` in this checkout. Read current instructions and preserve unrelated changes. Build the isolated development-only horizontal-surface placement POC through source verification and write `docs/ar-placement-poc-validation.md`. Pin a compatible Viro release and verify its actual APIs. Do not replace existing placement/generation flows, run native builds/prebuild, commit, push, or deploy without separate authorization. If a rebuilt physical device is unavailable, report device validation as pending and provide exact next steps. Return the focused diff summary, validation evidence, and unresolved issues for review.
