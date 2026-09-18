# Reusable React Native AR placement module

Status: detailed implementation plan; no module implementation authorized by creation of this document.

## 1. Outcome

Turn the working surface-placement POC into a reusable module that owns session lifecycle, surfaces, targets, object placement, cleanup, feedback, and diagnostics. A consuming app should provide content and receive meaningful callbacks without implementing native event bookkeeping itself.

The release scenario is: open AR, find a usable target, preview an object, place it, walk around it, move it, remove it, interrupt the session, recover, and repeat. Every failure must have an observable state and a useful event report. Plane polygons are optional diagnostic output, not the primary interaction.

Stay on the current branch, `codex/ar-placement-poc`. Do not create another branch or worktree. Implement inside this repository first; package publication and extraction into a separate repository are future work.

This plan supersedes the earlier POC plan for the next phase. Preserve `docs/ar-placement-poc-plan.md` and its historical validation note. Do not rewrite earlier build evidence as evidence for this module.

## 2. Evidence and constraints

Verified at planning time:

- Branch `codex/ar-placement-poc`, HEAD `df6484f` (`feat: initial AR bits`). Recheck status before implementation.
- Expo 54 / React Native 0.81 / React 19.1 with new architecture enabled; Viro pinned to `@reactvision/react-viro@2.53.1`.
- Existing source: `src/components/ar/{ARPlacementScene,placementState,viroBridge}`, reducer tests, `src/screens/ARPlacementPOCScreen.tsx`, root navigation and Settings diagnostics entry.
- User reports functional native plane detection, but slow/meandering acquisition. This is meaningful device evidence; it does not establish measured latency, drift, cleanup, or cross-platform parity.
- Prior review passed TypeScript and 23 reducer tests. Those results precede implementation of this plan and must be rerun as appropriate.
- Existing dirty work includes app.json, an HTTPS-query restoration plugin under `plugins/`, the POC validation note, and the relocation of `DEV_BUILD_SETUP.md`. Preserve all unrelated work. The plugin protects existing Android external-link behavior and must not disappear during integration.
- Installed Viro source contains hit-test methods and `createAnchoredNode`. The latter's comment says the companion `ViroARNode` is not yet implemented. A callable method alone is not proof of a usable create/render/update/release lifecycle.

Execution boundaries:

- This request is for a plan and Markdown artifact. A later implementation assignment authorizes source work.
- Keep framework versions pinned initially. A native bridge or dependency change must follow evidence from the capability gate, not speculative repair.
- Do not run native builds, prebuild, commit, push, or deploy without explicit user authorization. Do not infer new build authorization from the historical Android build.
- If an EAS build is requested, return its URL after submission; do not poll unless asked.
- No changes to Firebase, billing, AI generation, SQLite, or the existing photo/rectangle flow are needed.

## 3. Scope and completion levels

Required v1:

- Horizontal surface placement with one object by default and a bounded configurable object limit; exercise at least two objects in the lab to verify ownership.
- One camera/session owner, deterministic lifecycle and cleanup, capability reporting per platform.
- Surface registry, target selection, stable preview, confirmed placement, move/cancel, rotate/resize, remove and clear.
- Explicit callbacks and structured command results; no silently ignored failures.
- Feedback driven by state and observed reasons, with optional diagnostics.
- Bounded event recording, local export, replayable fixtures, and a device validation matrix.
- An app-independent public entry point and two thin consumers demonstrating reuse.

Excluded: cross-session persistence, cloud/shared anchors, geospatial AR, room meshing, wall placement UX, occlusion, asset generation/catalogs, photorealism, photo export, AI placement integration, package publishing, or building an alternative rendering engine.

Report four distinct milestones: source complete, replay/test validated, native build validated, physical-device validated. Only the final milestone establishes AR behavior on the tested device. Never claim platform parity from a shared TypeScript implementation.

## 4. Architecture and ownership

```text
Consumer (Planterior lab or minimal example)
            │ configuration, content, callbacks, commands
React API / optional feedback UI
            │ subscribes to immutable snapshots
Core controller
  ├─ session state machine
  ├─ surface registry
  ├─ target policy
  ├─ placement/anchor ownership
  ├─ feedback policy
  └─ diagnostic event recorder
            │ normalized events / typed effects
Viro adapter + renderer
            │ actual capabilities and native handles
ARKit / ARCore through installed Viro
```

Core code has no React Native, Viro, Expo, navigation, auth, theme, plant, filesystem, or network imports. React binds snapshots to the consumer. The adapter owns native objects and coordinate conversion. A host-supplied exporter handles local diagnostic files and sharing. The lab integrates AppIcon, theme, navigation and safe areas outside the core.

Use one authoritative registry and one placement controller. Do not let `ViroARPlaneSelector` maintain an invisible competing source of truth. It may remain a baseline/diagnostic mode, or be used behind an adapter whose ownership is explicit. Prefer direct registry-driven overlays and hit-tested placement if the capability gate proves that path.

Keep transient camera/target updates out of broad React context. Use a small external store with `useSyncExternalStore` or an equivalent narrowly subscribed mechanism; no new general state library is necessary. Keep the native scene identity stable. Session generation changes, rather than ordinary React updates, control intentional remounts.

Suggested structure (combine small files where useful; do not create empty abstractions):

```text
src/modules/ar-placement/
  index.ts                         public types, hook, session view
  core/
    types.ts                       events, snapshots, results, capabilities
    controller.ts                  commands, effect scheduling, subscriptions
    session.ts                     lifecycle transitions and generation guards
    surfaces.ts                    registry and replacement reconciliation
    targeting.ts                   eligibility, target selection, stability policy
    placements.ts                  object state and resource ownership
    feedback.ts                    feedback codes and priority
    coordinates.ts                 documented pure transform helpers
  adapters/viro/
    capabilities.ts                verified platform support and evidence pointers
    adapter.ts                     native bridge, handles, event normalization
    ViroSessionView.tsx            sole native session owner
    ViroContent.tsx                placement rendering and optional overlays
    nativeImports.ts               guarded Viro import boundary
  react/
    useARPlacement.ts
    ARPlacementView.tsx
  diagnostics/
    recorder.ts
    schema.ts
    replay.ts
    fixtures/
  __tests__/
src/screens/ARPlacementPOCScreen.tsx lab consumer of the new API
src/examples/ar-placement/          second minimal consumer
docs/ar-placement-capabilities.md
docs/ar-placement-module-validation.md
docs/ar-placement-module-usage.md
```

## 5. Capability gate — first implementation checkpoint

Before choosing an anchoring strategy, build this matrix for the exact installed release on iOS and Android. For each row record JS symbol, argument/result shape, native binding/source evidence if available, ownership, failure behavior, and device validation status. Documentation and declarations are evidence of intent, not runtime success.

| Capability | Required decision/evidence |
| --- | --- |
| Support and session lifecycle | Permission guard, availability, teardown and camera release |
| Plane discovery/update/removal | Payload IDs, alignment, extents, boundary, transform and removal shape |
| Plane replacement/subsumption | Is parent identity exposed? Distinguish unsupported from unknown |
| Tracking and interruption | Available states/reasons, native error path, recovery signals |
| Hit testing | Screen/ray API, coordinate units, viewport/orientation handling, existing-plane vs estimated hit, plane identity |
| Anchor creation | Real creation method, opaque hit-token lifetime, failure/cancellation behavior |
| Anchor rendering/update | How content binds to that handle and receives corrected poses |
| Anchor release | Actual detach/removal method or documented native ownership on component unmount |
| Content selection | Object hit testing/picking; fallback to an explicit object list if unsupported |
| Frame data | Monotonic timestamps, pose, projection and boundary availability; never assume every field exists |

Choose and document one strategy:

1. **Explicit app-owned anchors:** preferred if create, render, pose update, and release are all proven. Keep objects independent of debug plane overlays.
2. **Library-owned plane attachment:** acceptable limited mode when mounting/unmounting content has verified ownership semantics. Report the limitation; do not label view removal as native anchor detachment. Surface removal may require explicit re-placement.
3. **Targeted adapter extension:** if a required lifecycle capability is missing, propose the smallest version change, maintained patch, or native extension, with affected platforms and build implications. Complete independent core/replay work while the decision is pending. Do not replace the whole AR stack or directly edit node_modules as the solution.

The baseline can remain Viro; the app-facing contract must not depend on unverified Viro features. Full resource-cleanup acceptance remains blocked until the chosen strategy's actual ownership/release behavior is established. Unsupported merge mapping is permitted if surfaced and the fallback is safe; unsupported cleanup cannot be papered over by deleting JS records.

## 6. Public API contract

The following is a proposed consumer API, not an assertion that Viro already offers these methods. Final exported names may be refined at the contract checkpoint, but behavior must remain explicit.

```tsx
const ar = useARPlacement({
  adapter: viroAdapter,
  policy: { surface: 'horizontal-upward', maxObjects: 1 },
  onTrackingChanged,
  onSurfaceAdded,
  onSurfaceUpdated,
  onSurfaceRemoved,
  onSurfaceReplaced,
  onTargetChanged,
  onPlacementChanged,
  onPlacementLost,
  onError,
});

// The consumer supplies a renderer/asset registration with dimensions and pivot.
// Model is illustrative app content; the core never imports it or its asset.
<ARPlacementView controller={ar.controller} renderObject={renderObject} />

await ar.start();
await ar.place({ contentId: 'pot-proxy' });
await ar.beginMove(objectId);
await ar.commitMove(objectId);
await ar.cancelMove(objectId);
await ar.setTransform(objectId, { yawRadians: 0.4, scale: 1.2 });
await ar.confirm(objectId);
await ar.remove(objectId);
await ar.clear();
await ar.reset();
await ar.stop();
```

Hook creation must not acquire the camera during render. Mount/start/stop ownership is documented; only the session view uses camera resources. A second view/controller trying to run concurrently receives `session-busy` instead of opening another camera.

Every command returns a discriminated result, e.g. `{ ok: true, value }` or `{ ok: false, error: { code, recoverable, message } }`. Define codes for unsupported, permission-denied, inactive-session, tracking-limited, no-valid-target, stale-target, limit-reached, object-not-found, operation-cancelled, anchor-create-failed, anchor-release-failed, session-busy and native-error. Catch adapter rejections centrally. Do not report success until required effects complete.

Callbacks describe committed domain changes, not command intentions. Emit them after state is updated, outside reducers, once per accepted transition. Repeated native updates with unchanged semantic state must not duplicate additions/removals. Callback exceptions must not break cleanup. Provide unsubscribe/dispose behavior and avoid stale callback closures.

Native pointer/handle types never cross the public API. Expose stable app object IDs and session-scoped surface IDs. Snapshots contain capabilities, session/tracking state, eligible surfaces, current target, objects, selection, feedback and diagnostic counters. React consumers must not mutate snapshots.

## 7. Core data and event contracts

Use serializable discriminated unions and schema versions. At minimum define:

- **Session:** generation ID, lifecycle state, platform/version metadata, tracking state/reason, failure and start time.
- **Surface:** session-scoped ID, source native ID held in adapter, alignment, native tracking state if supplied, world pose, extent/boundary when available, first observation and last update time, replacement ID if native evidence supplies it, eligibility with reasons.
- **Target:** session/generation, target version, hit type, surface ID when available, pose, sample time, eligibility and rejection reasons. Keep the native hit token private in the adapter.
- **Object:** stable app ID, content ID, placement lifecycle, owning anchor handle reference held privately, surface provenance, local transform, dimensions/pivot, confirmation and recovery state.
- **Event envelope:** schema version, session ID, monotonic time since session start, sequence number, source (`native`, `command`, `effect`, `lifecycle`), operation ID when relevant, and normalized payload.

Coordinate contract: metres; radians in public/core rotation APIs; right-handed session world space with +Y up. Use quaternion poses with documented component order, and yaw about +Y for simple horizontal controls. Adapter converts Viro degree/Euler and native coordinate conventions explicitly. Document viewport points/pixels/normalized units and screen origin separately. A world frame can be corrected by tracking and is not geographic or persistent.

Maintain explicit transforms: world-from-anchor, anchor-from-object, object-from-model-pivot. Convert once at the boundary. `[0,0,0]` relative to a tap wrapper must never be labeled as the actual plane-local tap location. Derive pivot and scaled floor contact from content bounds. Use asymmetric test geometry to reveal axis/order mistakes.

Validate finite transforms, dimensions and scales. Reject malformed events with a recorded reason. Configuration changes affecting session mode require an explicit restart; callbacks and presentation options can update without resetting tracking.

## 8. Session lifecycle and concurrency

Lifecycle: `idle → checking → starting → running → stopping → stopped`, with explicit `interrupted` and `failed` states. Tracking (`unavailable`, `limited`, `normal`, `unknown`) is a separate axis, not a synonym for lifecycle. Commands are permitted by both.

Rules:

1. Every start/reset gets a new generation. Late permission, hit-test, anchor-create, status and ready callbacks from older generations cannot change current state.
2. Check mounted state, screen focus, app activity and generation after each await before acquiring/mounting native resources.
3. For v1, background/navigation exit stops and releases the session. Foreground explicitly starts a new session if the consumer remains focused; report that placements were cleared. No pretend restoration.
4. A native fatal/session error invalidates confirmation and target availability immediately, records the cause, and enters recoverable failure or terminal failure as appropriate. A text-only error message is insufficient.
5. Serialize placement mutations. Debounce/deduplicate a double Place press by operation ID; do not allocate two anchors.
6. If anchor creation completes after cancellation/reset, release the newly created resource via the originating adapter/session owner before discarding it. Generation guards alone do not prevent native leaks.
7. `stop`, `remove`, `clear`, and disposal are idempotent. Keep pending releases until acknowledged; retry only according to a bounded policy, then expose the failure. Never erase the last handle before cleanup is accounted for.
8. Reset releases owned resources, detaches subscriptions, clears maps/timers/targets, and starts a new generation. Do not simply clear the screen while leaving an old session running.

Address the prior review findings during this phase: native errors leaving confirmation enabled, async initialization mounting after background, and scan timers surviving session reset.

## 9. Surface registry and cleanup semantics

One map per session, keyed by stable normalized surface ID. Upsert updates; do not append a new renderable on every update. Handle update-before-add defensively as an upsert when a complete valid plane payload is supplied. Record partial/invalid events instead of inventing fields.

Separate native existence, application eligibility and overlay visibility:

- Native remove or stopped-tracking evidence transitions a surface out of eligibility. Remove its overlay and target immediately.
- Native merge/replacement evidence links the old surface to its parent and prevents duplicate targeting. Handle parent-before-child and child-before-parent event orders, deduplicate events and reject replacement cycles.
- Absence of updates is not removal. An unchanged plane may be valid for a long time.
- Do not deduplicate nearby planes by guessing that similar position/normal means identical surface.
- When merge mapping is unavailable, report `surfaceReplacement: unsupported`. Honor actual removals and fall back to explicit target loss/re-placement when ownership requires it. Never synthesize a replacement ID.
- Hiding overlays or excluding a surface from targeting must not detach objects or erase native tracking.
- Once a surface is removed, retain only bounded tombstone/replacement metadata needed to reject late events or reconcile live references. Prune it after references expire; clear everything on session end. Do not TTL-delete live unchanged surfaces.

An object with its own valid native anchor can survive removal of its originating plane if the adapter confirms that independence. An object attached to that plane cannot. Emit `onPlacementLost` only when placement validity is actually lost; plane removal alone is not universally object loss. Where reattachment is supported, preserve world pose and account for the old resource. Otherwise ask for re-placement rather than silently teleporting.

Native engines control their own detected planes. This module owns the JS registry, rendered overlays, and resources it allocates; it does not promise to force deletion of native system planes.

## 10. Target selection and placement

Primary interaction: central reticle with a ghost preview and explicit Place button. Hit-test the camera viewport center using a verified adapter API. Prefer hits on existing eligible plane geometry; estimated/feature-point hits must not masquerade as confirmed surface placement. Native hit-test handles have their own lifetime; discard them promptly and obtain a fresh hit when committing.

Start with a bounded sample rate (suggested 10 Hz) and at most one outstanding hit test. Apply backpressure rather than queuing stale frames. Revalidate generation, age, surface identity and tracking when results return. Measure on hardware before changing frequency. Do not throttle away surface removal, tracking loss or fatal errors.

Target policy should explain every rejection: wrong alignment, no valid hit, tracking limited, out of configured range, insufficient known footprint, stale sample, unsupported data. A plane type does not establish floor/table semantics.

Provisional tuning defaults, not platform guarantees: target age at commit ≤250 ms (or obtain a fresh hit), approximately 300 ms of consistent samples before showing “ready,” range 0.3–3 m, and a short hysteresis window before switching between adjacent candidates. Put thresholds in typed configuration and record them in reports. Start by measuring raw behavior; do not hard-code untested thresholds as product requirements.

Any application-calculated stability indicator is a heuristic and must be labeled accordingly. Low-pass smoothing may improve preview appearance but must not alter the actual anchor pose, conceal tracking loss, or introduce a large offset between preview and committed placement.

Use content dimensions for fit checks only when sufficient boundary data is available. Otherwise report fit as unknown; an extent rectangle is not exact proof that the entire pot sits on the surface. Do not reject a valid hit solely because an optional native field is missing.

Placement rules:

- Place snapshots a freshly validated target and creates/binds content through the chosen verified anchoring strategy. A preview never allocates a new persistent native anchor each frame.
- Keep camera-relative preview and anchored content lifecycles distinct. Placed content must never follow subsequent camera poses.
- Move is transactional: preserve the original until a new placement succeeds, then release the original resource. Cancel restores the original. At most one temporary replacement anchor per move; failure must not destroy the old object.
- Rotate and resize affect object-local transform and preserve base contact. Configured size bounds are content-specific.
- Remove detaches/unmounts content and releases app-owned native resources according to the capability contract. Clear applies that to all objects.
- Confirm is a domain state, not proof of physical accuracy. Tracking loss suspends confidence and invalidates confirmation; reconfirm only after recovery policy is satisfied.
- Object selection uses verified scene picking or an explicit list fallback. No invisible touch targets over the whole AR view.

## 11. Feedback and lab UI

Core emits feedback codes, severity and parameters; the consumer provides wording/localization. Priority: fatal error/unsupported → interruption/tracking loss → placement lost → permission/recovery → scanning guidance → target readiness → placed/confirmed. Avoid contradictory prompts.

Examples: `scan.moveSlowly`, `tracking.insufficientFeatures`, `target.outOfRange`, `target.ready`, `placement.lost`, `session.restarted`. Use native reasons when available; otherwise say tracking is limited rather than inventing a lighting diagnosis.

Normal mode shows the camera, one reticle/preview, one primary action and relevant edit controls. Diagnostics are collapsed by default. Guidance remains visible when diagnostics are hidden. Tie scan timing to the session generation and record actual stage milestones; do not restart timing when a panel is opened.

Lab mode adds toggles for plane outlines, surface IDs, target hit details and anchor/object origins; an object list; native and accepted surface counts; tracking reason; pending operations; event timeline; export; clear/reset. Show resource counts as native-measured, adapter-owned, or estimated—never imply JS counts measure native allocation.

Do not add animations or polished artwork as dependencies of the lifecycle work. Reuse the existing pot proxy with corrected dimensions (its rim is wider than the nominal body); use a second asymmetric box in the minimal consumer.

## 12. Diagnostic recorder and replay

Record normalized lifecycle/domain events and command effect outcomes with session-relative monotonic time, sequence and operation IDs. Include platform/device model and OS when available, exact library/app revision/build ID supplied by the host, policy thresholds and capability mode. Do not invent missing metadata.

Track: start-to-normal-tracking, first raw plane, first eligible plane, first ready target, first placement, number of resets/rejections, tracking interruptions and pending cleanup. Distinguish actual callback arrival time from native frame time if both exist. Missing native timestamps stay marked missing.

Keep recording bounded: initial proposal 5,000 events or 5 MB, whichever comes first, with coalescing of repetitive geometry updates and a dropped-event counter. Retain initial/session checkpoints so replay remains meaningful after truncation. If truncation prevents faithful replay, declare the trace diagnostic-only. Preserve ordering of lifecycle and release events; stop recording with an explicit limit marker if capacity cannot preserve required events. Core state must never depend on recorder success.

Export JSON through a host-provided sink using already installed filesystem/sharing facilities. No automatic upload. Exclude camera frames, images, audio, credentials, user identity and location. Geometry and motion can still describe a room: make export an explicit local user action and provide clear/delete controls.

Replay runs the same core through a fake adapter and injected clock/ID source, using recorded normalized inputs and effect outcomes. Do not replay exported callbacks as new inputs. Native handles become fixture tokens; replay must never call a real native API. Offer deterministic step and play controls in a development harness or CLI/test runner.

Required fixtures:

1. Clean scan → place → confirm → remove.
2. Repeated updates for one plane and update-before-add.
3. Two planes merging with both parent/child event orders.
4. Selected surface removed with plane-dependent versus independent object anchor.
5. Tracking lost/recovered before and after confirmation.
6. Background during permission/support check and during pending anchor creation.
7. Reset followed by late callbacks from an old generation.
8. Double Place, move cancellation, creation failure, release failure and repeated deletion.
9. No planes for 30 seconds, stale/out-of-order hit results, and malformed geometry.
10. Recorder capacity reached and invalid/schema-incompatible import.

Synthetic fixtures prove controller behavior. Captured traces test observed event sequences. Neither reproduces native visual tracking or establishes physical accuracy.

## 13. Migration and implementation phases

One implementation owner works sequentially on this branch. No parallel agents are needed. A reviewer checks each gate; the user/device operator provides hardware evidence. Preserve a runnable app after each phase.

| Phase | Work and dependency | Deliverable / gate |
| --- | --- | --- |
| 0 | Baseline + capability audit | Matrix with anchored-content/release strategy; unresolved native gaps explicit |
| 1 | Public contracts, pure core, fake adapter | Registry/session/placement invariants pass deterministic fixtures; no native imports |
| 2 | Viro adapter and resource lifecycle, depends on 0–1 | Existing lab renders through new controller; errors/reset/background/cleanup work |
| 3 | Reticle, preview, place/edit/move/remove and feedback, depends on 2 | Full single-object flow; two-object ownership test; callbacks documented |
| 4 | Recorder, export and replay, depends on event schema in 1 | Bounded report plus reproducible replay of lifecycle failures |
| 5 | Device hardening and second consumer, depends on 2–4 | Device results, usage guide and evidence of module independence |

Phase 0 should inspect existing native binaries/source without running a build. If hardware or build authorization is unavailable, phases 1 and 4 can still progress; mark native gates pending. Do not guess native APIs to claim phase 2 complete.

Migrate the existing Settings entry and screen to consume the module; preserve development-only routing. Preserve known-working plane detection as a temporary lab baseline if useful for controlled comparison. Remove superseded implementation only once its replacement works and the lab can compare acquisition behavior. Do not retain two production controllers.

File boundaries: module owner edits `src/modules/ar-placement`, the existing AR screen, AR-specific tests and docs. Navigation/Settings edits are narrow and only needed for lab routing or examples. Dependency/config/plugin changes belong to the capability decision, with before/after evidence. Do not stage unrelated work or native generated folders.

## 14. Verification and measurable acceptance

Source/replay gates:

- TypeScript and `git diff --check`; run existing AR tests plus focused new lifecycle/registry/adapter tests. Record baseline failures separately.
- Exactly one surface record per ID; duplicate events do not duplicate callbacks; old generations cannot alter current snapshots.
- Zero adapter-owned anchors after clear/stop in successful cleanup tests; failures retain pending ownership and emit explicit errors.
- Move cancel preserves original pose/resource; move success releases the old resource once.
- Anchor transforms/pivots tested with non-origin, rotated and scaled examples, not only arithmetic identity assertions.
- Capability/permission failures, recording limits, subscription cleanup and async cancellation are covered.
- React bindings tested for repeated mount/unmount and Strict Mode behavior; render must not start native work.
- Public consumer imports only `src/modules/ar-placement/index.ts` and renderer registration surfaces; no imports of controller internals or direct Viro operations.

Physical-device gate (requires an authorized build containing the adapter):

| Scenario | Required evidence |
| --- | --- |
| Acquisition | Ten fresh sessions in a well-lit textured room on each tested platform; report median, p90 and failures for first plane/ready target; initial target ≥9/10 ready within 10 seconds, to be confirmed or revised with explicit evidence |
| Difficult conditions | Smooth/reflective surface and dim light trials; honest feedback and no fabricated ready target |
| Placement stability | Place beside a physical marker, move ~1 m and view from multiple angles for 30 seconds, five trials; report visible drift, target roughly ≤5 cm at base as a visual estimate, not calibrated accuracy |
| Deletion/ownership | Twenty place/move/delete cycles; object and owned-resource counts return to baseline, no stale overlays/objects or monotonic resource growth attributable to the module |
| Surface lifecycle | Observe or capture removal/replacement when available; otherwise leave native merge handling unverified and distinguish it from replay coverage |
| Interruptions | Background/foreground, leave/reopen and reset during placement; no duplicate camera ownership, ghost object or late placement |
| Multiple objects | Two distinct objects; deleting/moving one leaves the other's transform and resource intact |
| Session failure | Error prevents confirmation and exposes an actionable restart; simulated and real errors labeled separately |
| Performance | Ten-minute lab session; bounded recorder/registry ownership, report JS/render responsiveness and any available native memory samples; no unsupported claim of native leak-freedom |
| Regression | Existing room camera, rectangle placement, navigation and Android external links still work after leaving AR |
| Reuse | Minimal second consumer places a different content primitive using the public API with no Planterior contexts or business services |

Numbers above are proposed acceptance targets, not measured results or promises that every room meets them. Keep the initial baseline and report improvement/regression under matching device/room/build conditions. Establish which platform the user's current successful run used; do not assume. Validate iOS and Android separately. If only one platform is tested, label the module validated on that platform only.

For slow scanning, compare: native tracking readiness, raw plane arrival, eligibility, hit availability, preview stabilization and UI presentation. Do not tune a smoothing filter to compensate for absent native events. Profile before changing update rates or upgrading the stack.

## 15. Deliverables and review handoff

Implementation handoff must include:

1. Focused file/diff summary and branch/revision, preserving pre-existing dirty work.
2. Capability matrix and actual anchoring/release strategy, with separate iOS/Android evidence.
3. Public API/coordinate/callback documentation and minimal example.
4. Event schema, fixtures, replay command/instructions and one exported test report.
5. Commands run, baseline/new failures and checks not run.
6. Device/build/room conditions and measured results, or explicit pending-device status.
7. Remaining gaps, ownership limitations and any scope changes requiring a decision.

Reviewer checks correctness of coordinate transforms, async generations and resource ownership first; registry semantics and callback determinism second; feedback/performance and usability third. A clean screenshot or many passing reducer tests do not substitute for native lifecycle evidence.

Do not declare completion while required native cleanup is unsupported, while error states allow false confirmation, or while the second consumer needs app-specific internals. Report genuine blockers with exact evidence and a concrete alternative. After repeated unsuccessful changes without new diagnostic evidence, stop speculative edits and return the trace and next needed experiment.

## 16. Primary references

- [ARCore anchors](https://developers.google.com/ar/develop/anchors): anchor ownership, pose correction and releasing unused resources. Use native semantics to audit the adapter, not to assume equivalent Viro methods exist.
- [ARCore Plane](https://developers.google.com/ar/reference/java/com/google/ar/core/Plane): native plane subsumption/replacement behavior.
- [ARKit session delegate](https://developer.apple.com/documentation/arkit/arsessiondelegate): anchor add/update/remove callbacks.
- [Viro AR scene](https://viro-community.readme.io/docs/viroarscene): public scene/tracking/hit-test concepts; resolve differences against installed 2.53.1 source and runtime.
- [Viro plane selector](https://viro-community.readme.io/docs/viroarplaneselector): existing POC event forwarding and selection behavior.

## 17. Paste-ready implementation assignment

Implement `docs/ar-placement-module-plan.md` on the existing `codex/ar-placement-poc` branch. Start by preserving current changes and documenting exact Viro capabilities, especially create/render/update/release and plane replacement. Build the pure core and fake adapter, then migrate the existing AR lab into a consumer of the reusable module. Provide callbacks, explicit resource cleanup, reticle/preview placement, move/remove/recovery, state-driven feedback, bounded event recording/export and deterministic replay. Include a second minimal consumer and validation documentation. Do not upgrade the framework, create another branch, run native builds/prebuild, commit, push or deploy without explicit authorization. Complete independent source/test work when hardware is unavailable, but mark native/device gates pending. Return the focused diff, capability evidence, test/replay results and remaining device checklist for review.
