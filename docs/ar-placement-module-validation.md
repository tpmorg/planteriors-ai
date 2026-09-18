# AR placement module — validation

Branch: `codex/ar-placement-poc`. Pre-existing dirty work (`app.json`, `plugins/`, `docs/DEV_BUILD_SETUP.md`) was left in place. No commit, push, prebuild, or native build was run for this phase.

## Milestones

| Milestone | Status |
| --- | --- |
| Source complete | Yes — module, lab, second consumer, docs |
| Replay / test validated | Yes — Jest fixtures below |
| Native build validated | **Pending** — not authorized |
| Physical-device validated | **Pending** — not authorized |

This module is **not** device-validated on iOS or Android.

## Anchoring strategy

**Library-owned plane attachment.** Full resource-cleanup acceptance stays blocked until plane-attachment unmount is observed on a device. JS handle maps returning to empty after `clear`/`stop` are not proof of native leak-freedom.

`surfaceReplacement` is **unsupported** on Viro 2.53.1 (no parent id). Merge fixtures exercise core registry logic with the fake adapter only.

## Commands run

```
npx tsc --noEmit
npx jest src/modules/ar-placement src/components/ar --no-coverage
```

Results: `tsc` clean. 4 suites, 41 tests passed (18 new module tests + 23 existing POC reducer tests).

`git diff --check` should be run by the reviewer on the working tree.

Not run: native build, EAS, Expo Go AR, iOS/Android device matrix, lint (no project lint script beyond tsc/jest).

## Replay fixtures (synthetic)

Covered in `src/modules/ar-placement/__tests__/controller.fixtures.test.ts`:

1. Scan → place → confirm → remove; adapter handles empty after remove
2. Repeated plane updates and update-before-add; one record per id; add callback once
3. Plane merge, parent-before-child and child-before-parent
4. Surface removed: plane-dependent object is lost; independent object is not
5. Tracking lost after confirm; confirm blocked; reconfirm after recovery
6. Stop during environment check; reset during pending create releases the late handle
7. Late events from an old generation do not mutate the new snapshot
8. Double Place shares one in-flight op; move cancel restores; create/release failure; repeated delete is idempotent
9. No planes; malformed hit/extent; stale hit rejected
10. Recorder capacity / truncation; incompatible schema import rejected

Coordinates tests use non-origin, rotated poses and Viro `Rx·Ry·Rz` world-to-local parity.

Core files have no React Native / Viro / Expo / navigation / Firebase imports.

## Device checklist (pending)

Run on an authorized build that includes Viro. Record platform, OS, device, room, build id. Do not copy POC-era notes as evidence for this module.

- [ ] Ten fresh sessions, well-lit textured room: first plane / first ready target (median, p90, failures)
- [ ] Smooth/reflective surface and dim light: no fabricated ready target
- [ ] Place beside a marker, walk ~1 m, 30 s, five trials: visual drift estimate
- [ ] Twenty place/move/delete cycles: object and adapter-owned counts return to baseline
- [ ] Observe native plane removal/replacement if the OS emits it; otherwise leave merge unverified
- [ ] Background / leave / reset during placement: no second camera, no late place
- [ ] Two objects: mutating one leaves the other intact
- [ ] Native error: confirmation disabled, restart offered
- [ ] Ten-minute session: recorder/registry bounded; no native leak claim
- [ ] After leaving AR: room camera, rectangle flow, navigation, Android external links still work
- [ ] Minimal example places the asymmetric box via the public API

## Remaining gaps

- Hit-test results do not include plane id; matching is nearest eligible surface
- Viewport origin/units for `performARHitTestWithPoint` unverified
- Object picking is an explicit list, not scene hit-testing
- Preview uses plane-local offset; ghost vs committed pose needs device comparison
- Old `src/components/ar/*` POC remains as a comparison baseline and is not the production controller
- Package extraction / publishing is out of scope
