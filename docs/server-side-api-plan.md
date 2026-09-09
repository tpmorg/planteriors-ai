# Planterior server-side AI API plan

Date: 2026-09-09
Status: proposed implementation plan; no application or infrastructure changes made.

API implementation repository: `/Users/timmorgan/Development/web/planterior-ai-web`.
Mobile integration repository: `/Users/timmorgan/Development/mobile/react/planteriorai`.

## Objective

Move all Gemini operations behind an authenticated, metered service while making the mobile generation flow faster and resilient to disconnects. Reuse the web app's Firebase identity, Admin SDK, Firestore, and Storage integrations. Keep image bytes out of ordinary JSON API responses and stop distributing the Gemini secret with the mobile app.

Server-side execution is primarily a control and reliability improvement. It does not inherently make the model faster, and adds a network hop. Remove known waiting immediately and measure each stage before claiming a speedup.

## Verified starting point

- The web app uses Next.js 16.1.6, Node >=22, and Firebase Admin 13.5.x.
- `src/lib/auth/session.ts` verifies the `planterior_session` cookie. `src/app/api/auth/session/route.ts` exchanges a Firebase ID token for that cookie and updates the user profile. Current protected design routes are cookie-based; they do not yet implement the mobile bearer-token contract proposed here.
- `src/lib/firebase/admin.ts` already exposes Auth, Firestore, and Storage. `src/lib/planterior/dashboard.ts` reads existing design documents and signs private image URLs.
- Mobile sync writes directly to Firebase, under `users/{uid}/designs` and `users/{uid}/collections`. Manual sync/restore exists despite the mobile README saying otherwise.
- Mobile `geminiService.ts` tries the Interactions API and then `generateContent` on failure. Prompt construction and provider credentials are on-device.
- `GenerationScreen.tsx` deliberately sleeps for 1,000 + 800 + 700 ms before calling generation. Its percentage is driven by a timer, not provider progress.
- Usage is local SQLite state, counted on “Use Result.” Discarding a generated image does not consume the free allowance. Usage-check exceptions allow generation.
- `plantIdentificationService.ts` also calls Gemini directly, including identification and generated-image plant analysis. Moving only image generation would leave the secret exposed.
- Image compression sets width to 1024 rather than limiting the longest edge; portrait images can exceed the intended dimensions and small images can be enlarged.

These observations come from the current local checkouts. Deployed revisions, hosting limits, Firebase edition/region/rules, model availability, and RevenueCat production configuration remain to be verified during implementation.

## Recommended architecture

Use Next.js Node route handlers deployed as Vercel Functions for the public API. Continue using Firebase for Planterior's existing identity, Firestore database, and Storage layer; that does not require the API runtime to run on Google Cloud.

For the initial fake-provider and Gemini canary phases, process generation synchronously within the Vercel Function. Do not start generation as an unawaited promise or rely on Next.js `after()` for durable work. Add Vercel Queues only when implementing disconnect-safe durable generation, while preserving duplicate-safe processing and the existing job contract.

Flow:

1. Mobile obtains a Firebase ID token, prepares the image, and requests an upload slot.
2. Mobile uploads the binary JPEG directly to a private, server-selected Storage object.
3. Mobile submits validated options and the upload ID with an idempotency key.
4. API verifies the upload, entitlement and allowance; atomically reserves usage and creates a job record.
5. The Vercel Function calls the selected provider once, persists the output and thumbnail, settles usage, and returns the completed job.
6. Mobile downloads the result to a local file. Idempotent job records allow recovery if the response is lost.
7. When disconnect-safe durable generation is implemented, enqueue the accepted job with Vercel Queues and restore polling/resume behavior without changing the public resource model.
8. “Use Result” saves the completed result into the existing design collection without charging again.

Measure cold and warm Vercel Function latency against Firebase and the provider. Before enabling the Gemini canary, confirm that the deployed Vercel plan's function duration is sufficient for observed generation time.

## Authentication and authorization

Add `src/lib/auth/api-user.ts` to resolve a Firebase UID:

- Mobile: `Authorization: Bearer <Firebase ID token>`, verified with Firebase Admin. On expiration the app refreshes once and retries with the same idempotency key.
- Web: reuse the existing verified session cookie. Enforce same-origin/CSRF protection on cookie-authenticated mutations.
- Invalid supplied bearer credentials must fail, not silently fall back to a cookie. Return JSON `401/403`, never a login-page redirect.
- Never accept a request-body UID as ownership authority. Every upload, job, result, and saved design must belong to the authenticated UID.
- Use `Cache-Control: private, no-store` for personalized API responses. Never log bearer tokens, signed URLs, photos, or full prompts.
- There is no Cloud Run or service-account invocation path. Public Vercel Functions authenticate every request with the existing Firebase bearer/session contract. Future Vercel Queue consumers must use Vercel's supported secure invocation mechanism and remain ownership-safe.
- Admin writes bypass Firebase rules: enforce ownership in server code and prevent clients from changing job state, quotas, reservations, or entitlement records through Firebase SDKs.

Before schema/rule implementation, identify the actual Firestore edition and inspect deployed access rules. Existing design sync must remain compatible while server-owned AI records are locked down.

## Proposed API contract

All new public endpoints live under `/api/v1`. JSON responses include a request ID. Errors use `{ error: { code, message, retryable }, requestId }`.

| Endpoint | Purpose |
| --- | --- |
| `POST /uploads` | Issue an upload ID and short-lived, constrained direct-upload instructions. |
| `POST /generations` | Accept upload ID, mode/options and `Idempotency-Key`; process synchronously and return `200 { jobId, status, pollAfterMs, job }`. |
| `GET /generations/:id` | Return owned job state, safe error, and expiring result/thumbnail URLs when complete. |
| `GET /generations?status=active&cursor=...` | Paginated job recovery across devices; also allow recent completed jobs. |
| `POST /generations/:id/cancel` | Cancel work before provider submission; cancellation during provider execution is best effort. |
| `POST /generations/:id/save` | Idempotently create/retrieve the canonical saved design and return its remote ID. |
| `POST /identifications` | Run a metered identification or generated-plant analysis synchronously and return the completed resource. |
| `GET /identifications/:id` | Return validated structured plant results; confidence is model output, not a calibrated probability. |
| `GET /usage` | Return authoritative free remaining, active reservations, entitlement and capability flags. |
| `POST /entitlements/refresh` | Refresh from RevenueCat after purchase/restore; rate limited. |
| `POST /webhooks/revenuecat` | Separately authenticated RevenueCat webhook; no user session required. |

Generation input retains `multi-plant`, `individual`, and `replace-plant`, size/placement, normalized target rectangle, options and custom instructions. Validate ranges, supported values, text size and image ownership. Resolve catalog IDs to server-owned plant/style data; do not trust client-written species descriptions as catalog truth. Preserve current prompt behavior first and version prompts independently from the mobile release.

Proposed upload defaults: JPEG, maximum 5 MiB and a bounded decoded pixel count, 10-minute upload authorization, server-selected immutable object name. Enforce upload size using a constrained upload mechanism where supported and verify actual bytes/type/dimensions before model dispatch. Pin the verified object generation to prevent replacement after validation. Apply per-user upload limits and lifecycle cleanup. These are proposed limits to validate with real device images, not existing product policy.

Return `400` for malformed input, `401/403` for auth/access, `404` for inaccessible/missing objects, `409` for conflicting idempotency payloads or state transitions, `413/415` for upload size/type, `429` for exhausted allowance/rate limits with an actionable code, and `503` when authorization dependencies cannot be verified. Do not fail open.

## Jobs, retries, and accounting

Proposed server-only records beneath `users/{uid}`:

- `ai_jobs/{jobId}`: operation, input object/version, request hash, idempotency key hash, model/prompt versions, state, timestamps, result paths, safe error, reservation ID and provider-attempt metadata.
- `ai_usage/current`: free consumed/reserved, active count and policy version.
- `ai_usage_events/{eventId}`: append-only reservation/settlement/release audit trail keyed deterministically by job and transition.
- `ai_entitlements/current`: verified RevenueCat entitlement, environment, expiration and last checked timestamp.
- Separate server-owned webhook-event records for deduplication. Add queue-delivery records only with the future Vercel Queues phase.

Job states: `queued → running → succeeded | failed | cancelled`. Add `uncertain` reconciliation semantics with the future durable queue implementation; never blindly resubmit after provider submission.

- Reserve one available free unit atomically with job creation. Concurrent requests cannot spend the same remaining unit. Same key and request hash return the existing job; changed payload with the same key returns `409`.
- On successful stored output, consume the reservation even if the user discards the image. Saving is a separate operation.
- On confirmed failure before a usable result, release the customer reservation exactly once. Record any provider cost separately; failed attempts may still incur expense.
- During synchronous execution, claim the queued job transactionally before provider submission so concurrent idempotent requests cannot both invoke the provider. Persist a provider-submission marker before making the external request.
- Exactly-once external generation cannot be guaranteed without provider support. The synchronous canary must not automatically resubmit after an ambiguous timeout. Add lease/fencing and bounded reconciliation when Vercel Queues introduces durable retries.
- Retry safe pre-submission transport operations with bounded backoff. Retry/fallback after provider submission only when rejection is definitive and policy permits it. A user-requested new attempt uses a new idempotency key.
- Queued cancellation releases the reservation. Running cancellation is best effort and may not stop provider billing. Resolve cancel/completion races transactionally.
- When Vercel Queues is introduced, use deterministic delivery identity plus periodic reconciliation so enqueue failure cannot strand reservations. A delivery for an already terminal job must acknowledge without invoking Gemini again.
- Reserve/settle identification usage separately. Keep the existing five-free-design offer; define identification limits explicitly before rollout rather than silently charging image-generation credits for it.

## RevenueCat and cost controls

Reuse Firebase UID as the RevenueCat app-user identity, but verify existing anonymous-user aliases, login, restore, transfer behavior, and sandbox/production separation. Never accept mobile `isActive` or SQLite counters as authority.

Maintain an entitlement cache from authenticated, deduplicated webhooks. Re-fetch authoritative RevenueCat state for ambiguous/out-of-order events and after purchase/restore. Proposed cache freshness is five minutes, bounded by entitlement expiration; if a required refresh fails, return a retryable service error rather than granting access or incorrectly showing a paywall.

Preserve advertised unlimited paid designs initially; add one active generation per user, a short-window request limiter, global queue/concurrency limits, provider budget alerts and an admission kill switch. Do not introduce a hidden monthly paid cap. Record model, operation, attempts and estimated/actual available cost metadata so pricing decisions can use cost per retained subscriber and per successful design.

Existing local free-use history is not trustworthy server evidence. Proposed migration: a one-time fresh five-design server allowance for existing free accounts, clearly recorded by policy version; confirm this launch decision before enabling it. Purchasers retain verified entitlements. Do not silently import client counters as secure quota data.

## Storage, saving, and sync compatibility

- Keep input/output bytes in private Storage, never base64 strings in Firestore. Return short-lived signed URLs from authenticated status endpoints and refresh them when expired.
- Stage jobs outside the saved-design namespace. Proposed unsaved-result retention is seven days; abandoned uploads expire after 24 hours. Cleanup must exclude active jobs and saved references. Document retention in user-facing copy before rollout.
- Save into the current `users/{uid}/designs/{designId}` contract with deterministic job-to-design mapping. Persist canonical object paths, compatible metadata and all three generation modes.
- On mobile, upsert the saved design using its returned remote ID and mark it synced. A retry, restore, or subsequent manual sync must not create another design or re-upload unchanged images.
- Update sync serialization, which currently collapses non-multi-plant modes to `individual`, to preserve `replace-plant` while tolerating older records. Verify both web rendering and old mobile compatibility.
- Only discard temporary objects after durable saved-object references are committed. Account deletion must include staged inputs/results, saved assets and sensitive job data, subject to the documented retention policy.
- Fix local gallery account scoping during integration: `getAllDesigns()` currently reads all nondeleted local designs without a UID filter.

## Performance work

### First mobile change

Remove the three preparation sleeps and timer-based percentages. Start real compression/upload immediately. Show honest phases: preparing photo, uploading, queued, generating, downloading, ready. Use byte progress only for transfers; show an indeterminate state during model execution.

### API migration

- Correct resizing to cap the longest edge at 1024 without upscaling; evaluate quality on portrait/landscape photos before changing resolution further.
- Upload binary once and reuse an owned upload for retries/variations within retention. Validate on the server without needlessly transcoding a valid image again.
- Return file URLs; download to local disk and render file URIs rather than retaining base64 images in React state/navigation.
- Select one verified model/API path through server configuration. Benchmark supported choices for latency and quality instead of paying the latency of a predictably failing first endpoint.
- During synchronous execution, use the POST response directly. Retain status reads for idempotent recovery. When Vercel Queues is added, poll initially around one second while foregrounded, back off with jitter to a maximum of five seconds, pause while backgrounded, and fetch immediately on resume.
- Keep entitlement checks off repeated status reads. Use transactions and cached verified entitlements at admission. Avoid sequential unrelated database/network work.
- Generate thumbnails outside the critical full-result delivery path where possible; paginate local/gallery queries as a separate measured follow-up.

Instrument client tap, compression/upload boundaries, API admission, function start, provider start/end, persistence, download and visible result. Correlate client spans by request/job ID, but use monotonic durations within each system rather than subtracting unsynchronized device/server clocks.

Proposed acceptance targets (not measured guarantees): no artificial sleeps; warm job admission p95 <=750 ms excluding upload/token refresh; no worse median end-to-end latency than a direct-call baseline with its artificial delay removed. Report cold-start and mobile-network p50/p95 separately. Establish queue-dispatch and foreground-observation targets when Vercel Queues is implemented.

## Implementation sequence

1. **Baseline and immediate delay removal.** Capture representative timing traces and fix the fake preparation/progress behavior. Independently resolve the existing Firebase auth type error and failing Gallery test before relying on CI as a gate.
2. **Web API foundation.** Add bearer/cookie auth resolver, schemas, upload authorization, private response policy, error contract and request tracing. Verify Firebase edition/rules, hosting region and credentials.
3. **Synchronous generation.** Add job repository, quota transactions, prompt port, output persistence, status/cancel endpoints and recovery. Run in Vercel Functions against a fake provider first, then a small authorized Gemini canary.
4. **Entitlements.** Add server RevenueCat verification, webhook handling, purchase refresh and account-alias tests. Establish identification/free-allowance migration policies before broad enablement.
5. **Mobile integration and saving.** Replace direct generation with upload/job service, persist job IDs, handle resume, download files, use authoritative usage, and implement remote-ID-aware save/sync.
6. **Identification migration.** Move every call in `plantIdentificationService.ts`, including generated-image analysis, to the authenticated Vercel Function path. Use operation-specific output validation and quotas.
7. **Release and harden.** Canary behind a server capability flag, compare latency/cost/quality, remove mobile Gemini SDK/config, and rotate the previously distributed Gemini key after the compatibility window. Update both READMEs and operational instructions.

Suggested web files: `src/lib/auth/api-user.ts`, `src/lib/ai/{schemas,prompts,provider,jobs,usage,storage,entitlements}.ts`, and `src/app/api/v1/.../route.ts`. Keep provider, prompts, and accounting independent from route handlers so a future Vercel Queue consumer can reuse them.

Suggested mobile files: new `src/services/aiApiService.ts`; update `GenerationScreen.tsx`, `plantIdentificationService.ts`, `usageTrackingService.ts`, `SubscriptionContext.tsx`, `imageUtils.ts`, database/sync save handling, and environment validation. Preserve unrelated UI and business behavior.

## Required validation and rollout controls

- Auth: valid/expired/revoked tokens, cookie CSRF, cross-user job/upload/result requests, direct Firebase attempts to alter usage.
- Accounting: concurrent last-free-unit requests; duplicate submissions/webhooks; discard after success; save retry; fail before/after provider submission; function timeout; stale reservation repair; cancel/completion race. Add duplicate-delivery and enqueue-failure cases with Vercel Queues.
- Billing: purchase then immediate generate, renewal, expiration, cancellation while entitlement remains active, restore, account transfer, sandbox isolation and RevenueCat outage.
- Persistence: app killed mid-job, reconnect after completion, URL expiry, upload overwrite attempt, invalid/oversized image, saved result retained during cleanup, two-device save/sync and replace-plant metadata.
- Performance: warm/cold Vercel Function, portrait/landscape and low-memory device, slow network, rapid navigation, gallery with a large library. Compare the same input/model combinations and record retries separately.
- Release: require passing focused tests/typecheck and requested deployment checks; production credentials and rules must be verified in the actual environment. No live AI spend or deployment is performed by this planning task.

Rollback must disable new admission while allowing accepted jobs to finish and saved results to remain readable. Do not restore client-side secrets as a fallback. Older installed apps cannot be secured solely by releasing a new build: define a supported-version/update window, rotate the old key, and communicate that old direct-generation builds must update.

## Decisions to settle before rollout

The architecture above is the recommended default. Confirm Vercel function limits, live Firebase regions and deploy access, model latency and quality, the fresh free-allowance migration, identification policy, retention text, and the old-client cutoff date. These do not block implementing the authenticated API skeleton and fake-provider tests.

## References

- [Google: Gemini API key handling](https://ai.google.dev/gemini-api/docs/api-key) — production secrets belong server-side.
- [Vercel function limits](https://vercel.com/docs/functions/limitations) — documented 4.5 MB request/response payload limit reinforces direct binary uploads and URL responses; verify the actual deployment limits during implementation.
- [Vercel Queues](https://vercel.com/docs/queues) — add only when disconnect-safe durable execution is implemented.
- [RevenueCat webhooks](https://www.revenuecat.com/docs/integrations/webhooks) — authenticate webhook delivery and reconcile subscription state.

Provider documentation checked while preparing this plan; production availability and configuration were not exercised.
