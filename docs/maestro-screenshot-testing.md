# Maestro screenshot testing

Planterior uses Maestro for device-level UI automation and screenshot capture. The
initial flow preserves app data and uses stable test IDs to capture the current
entry surface plus the main authenticated app screens.

## Prerequisites

1. Install the Maestro CLI: <https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli>
2. Install a Planterior build with application ID `com.bcs.planterior` on an
   Android emulator/device or iOS simulator.
3. Start the target device. For the authenticated screenshots, sign in once and
   finish onboarding before running the flow.

Maestro is an external CLI, not an npm dependency. No new native app build is
needed when only the YAML flows change. A build is needed when the React Native
test IDs or application code change.

## Capture screenshots

From the repository root:

```bash
npm run e2e:screenshots
```

Results are written under `artifacts/maestro/`, which is intentionally ignored by
Git. The flow always captures the launch state. It also detects and captures an
Android/iOS auth screen or first-run onboarding screen. If the installed app has
an authenticated session, it captures:

- Gallery
- Account
- Library
- Favorites
- Settings

The flow uses `clearState: false`, so it does not erase Firebase auth, SQLite, or
onboarding state. It does not sign in, buy products, call the AI API, or modify
saved designs.

Run all Maestro flows with:

```bash
npm run e2e:maestro
```

## Files

- `.maestro/config.yaml` owns the app ID, flow discovery, and default artifact path.
- `.maestro/flows/capture-core-screens.yaml` owns the first screenshot journey.
- Screen and tab `testID` values are the durable automation contract. The initial
  flow also uses existing accessibility labels so it works against builds installed
  before those IDs were added.

## Next slices

1. Add a deterministic test account/bootstrap path for clean emulators and EAS.
2. Add a photo fixture and cover the room-photo chooser without opening a native
   photo picker.
3. Cover generation success with a test backend response, then pinch/zoom, retry,
   and save.
4. Add subscription and Room Pack callback flows using sandbox purchases or a
   controlled RevenueCat test entitlement.
5. Run the flows from EAS Workflows and retain screenshots as test artifacts.

Keep purchase and generation flows separate from the read-only core screenshot
flow so routine visual captures remain fast and do not spend credits.
