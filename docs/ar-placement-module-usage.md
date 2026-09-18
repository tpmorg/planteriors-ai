# AR placement module — usage

Public imports: `src/modules/ar-placement/index.ts` plus a renderer module that may import Viro primitives. Do not import `core/`, adapter internals, or `@reactvision/react-viro` from app business code.

Hook creation does **not** open the camera. Call `start()` from a user action. Only `ARPlacementView` mounts native resources.

```tsx
import {
  ARPlacementView,
  createViroAdapter,
  useARPlacement,
  type ContentDescriptor,
} from '../modules/ar-placement';

const POT: ContentDescriptor = {
  contentId: 'pot-proxy',
  dimensions: { width: 0.27, height: 0.4, depth: 0.27 },
  pivot: [0, 0.2, 0],
  minScale: 0.5,
  maxScale: 2,
};

const adapter = useState(() => createViroAdapter())[0];
const ar = useARPlacement({
  adapter,
  contents: [POT],
  policy: { surface: 'horizontal-upward', maxObjects: 1 },
  onPlacementLost: (id, reason) => {},
  onError: (error) => {},
});

await ar.start();
<ARPlacementView controller={ar.controller} renderObject={renderObject} />
const placed = await ar.place({ contentId: 'pot-proxy' });
if (placed.ok) await ar.confirm(placed.value.objectId);
await ar.beginMove(objectId);
await ar.commitMove(objectId); // or ar.cancelMove(objectId)
await ar.setTransform(objectId, { yawRadians: 0.4, scale: 1.2 });
await ar.remove(objectId);
await ar.clear();
await ar.reset();
await ar.stop();
```

Every command returns `{ ok: true, value }` or `{ ok: false, error: { code, recoverable, message } }`.

Error codes: `unsupported`, `permission-denied`, `inactive-session`, `tracking-limited`, `no-valid-target`, `stale-target`, `limit-reached`, `object-not-found`, `operation-cancelled`, `anchor-create-failed`, `anchor-release-failed`, `session-busy`, `native-error`.

A second controller that tries to start while another session owns the camera receives `session-busy`.

## Policy

Provisional tuning, not platform guarantees:

- `hitTestHz`: 10
- `readyStableMs`: 300 (heuristic; labeled on the snapshot)
- `maxTargetAgeMs`: 250
- `rangeMinM` / `rangeMaxM`: 0.3–3 (skipped when distance is missing)
- `minExtentM`: 0.1
- `maxObjects`: 1 by default (lab uses 2)

Changing `surface` requires an explicit restart. Presentation options can update live.

## Feedback

Core emits `snapshot.feedback.code` (severity + params). The consumer supplies wording. Codes include `scan.moveSlowly`, `tracking.insufficientFeatures`, `target.ready` (heuristic), `placement.lost`, `session.restarted`.

## Diagnostics

`ar.exportDiagnostics()` returns JSON (no camera frames, identity, or location). The lab writes it with `expo-file-system` / `expo-sharing` on an explicit user action.

Replay: `src/modules/ar-placement/diagnostics/replay.ts` plus the Jest fixtures in `__tests__/controller.fixtures.test.ts`. Replay never calls native APIs.

## Consumers in this repo

- Lab: Settings → AR Placement Lab (`src/screens/ARPlacementPOCScreen.tsx`)
- Minimal second consumer: Settings → AR Placement Example (`src/examples/ar-placement/`) — asymmetric box, no Planterior auth/theme/billing/SQLite

Both routes are `__DEV__` only.
