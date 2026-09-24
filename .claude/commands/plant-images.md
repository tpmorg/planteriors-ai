---
description: Audit the Plant Library images, source better ones from Unsplash, and stage replacements for review
argument-hint: "[audit|review|source|choose|sheet|apply|status] (default: status)"
allowed-tools: Bash, Read, Write, Agent, Glob
---

# Plant Library image agent

Mission: every plant in `src/data/plantDatabase.ts` should be represented in the Library
screen by a clean photograph **of that plant itself** — the specimen, alone, correctly
identified. Not a room it sits in, not a shelf of plants, not a leaf macro. Bad images get
replaced with better ones sourced from Unsplash. Nothing ships without a human look.

Read `scripts/plantImageAgent/README.md` for the v2 record schema, hash requirements,
source constraints and offline tests. Old records must be reviewed again.

The grading standard is `scripts/plantImageAgent/RUBRIC.md`. **Read it before any review or
ranking step** and grade strictly against it — do not invent your own criteria.

Requested stage: **$ARGUMENTS** (default `status`).

## Stages

### `audit`
```bash
node scripts/plantImageAgent audit
```
Re-inventories the catalog, runs the technical checks, and rebuilds the 384px review
thumbnails. Report the summary counts, the duplicate groups, and any orphan files.

### `review` — the vision pass
1. Read `scripts/plantImageAgent/RUBRIC.md`.
2. `node scripts/plantImageAgent queue --batch 10` to get the pending batches as JSON.
3. For each batch, spawn a `general-purpose` subagent with `model: "opus"` (they run in parallel; cap at 4 in
   flight so the images don't swamp one context). Give each subagent: the full text of the
   rubric, its batch JSON, and these instructions:
   - Read every `thumb` path with the Read tool and look at it.
   - Read `cardCrop` — the actual 104px square the Library card shows — and `fullSize`. Do not infer
     species from search text. Record visible evidence and uncertainty.
   - Grade against rubric v2: modest room context is acceptable when the plant dominates.
   - Return **only** a JSON object, no prose, shaped like:
     ```json
     {
       "monstera-deliciosa": {
         "reviewedHash": "COPY FROM QUEUE",
         "verdict": "replace",
         "hardFails": ["room-scene"],
         "scores": { "subjectIsolation": 2, "speciesConfidence": 5, "framing": 3,
                     "thumbnailLegibility": 3, "catalogFit": 3 },
         "note": "Styled living-room shot; the monstera is set dressing behind a sofa."
       }
     }
     ```
4. Merge every batch result into one JSON file in the scratchpad directory, then:
   ```bash
   node scripts/plantImageAgent record verdicts <merged.json>
   ```
5. Report the tally and name the worst offenders with their reasons.

### `source`
```bash
node scripts/plantImageAgent source --limit 20
```
Searches Unsplash for plants marked `replace` or `borderline` and downloads up to 8
candidates each. **Unsplash demo keys allow 50 requests/hour and each plant costs 1-4
searches** — that is why `--limit` exists. The command caches searches, skips plants that
already have candidates, and exits cleanly when rate-limited, so just re-run it later to
continue. Tell the user how many plants remain unsourced.

### `choose` — the ranking pass
1. Read the rubric again.
2. Read `.plant-image-agent/candidates.json`.
3. In `general-purpose` subagent batches with `model: "opus"` (cap at 4 in flight),
   read current paths from audit.json and candidate paths from candidates.json. Compare
   full framing and the `cardCrop` files (real 104px cover crops). Open full-resolution files for every proposed
   winner. Record full candidate scores, hard fails and evidence, not just a reason. Rules:
   - A candidate wins only if it clearly beats the current image on the rubric. When it is
     a toss-up, keep what ships today — churn is worse than a mediocre image.
   - Reject candidates that are room scenes, plant groupings, or the wrong species, even
     when they are the prettiest option. Unsplash search is keyword-matched, not
     botanically verified, so wrong-species results are common and expected.
   - If the current image has the `wrong-species` hard fail, apply the rubric's
     identity-first exception: a correct plant with no hard fails and every score >= 3
     wins even below a 4.0 average. A correct plant beats a polished wrong one.
   - If no candidate qualifies, set `"winner": null` and say why.
   - For plants Unsplash cannot supply, add Commons candidates first:
     `node scripts/plantImageAgent source --provider wikimedia --ids a,b --per-plant 6`
4. Record:
   ```bash
   node scripts/plantImageAgent record decisions <decisions.json>
   ```
   Shape: `{ "plant-id": { "reviewedHash": "current hash from audit", "winner": "c2", "candidateHash": "hash from manifest", "reason": "...", "review": { "hardFails": [], "scores": { "subjectIsolation": 4, "speciesConfidence": 4, "framing": 4, "thumbnailLegibility": 4, "catalogFit": 4 }, "note": "Visible evidence and crop comparison" } } }`.
   Scores shown are schema examples, not defaults. For `winner: null` or `winner: "keep"`,
   omit candidateHash/review but retain reviewedHash and reason. Follow rubric v2's
   minimum quality and improvement thresholds; abstain rather than force a winner.

### `sheet`
```bash
node scripts/plantImageAgent sheet && open .plant-image-agent/contact-sheet.html
```
Builds the old-vs-new contact sheet. **This is the review gate** — always run it before
`apply` and tell the user to look at it.

### `apply`
```bash
node scripts/plantImageAgent apply            # dry run, lists what would change
node scripts/plantImageAgent apply --confirm  # writes the files
```
Only run `--confirm` after the user has seen the contact sheet and said yes. Applying
copies winners into `assets/plants/<id>.jpg`, backs the old ones up to
`.plant-image-agent/replaced/`, updates `plantDatabase.ts`, pings Unsplash's download
endpoint (required by their API terms), and records provenance in
`assets/plants/IMAGE_CREDITS.json`. Afterwards, show `git diff --stat` and remind the user
that Unsplash photographers in that ledger should be credited somewhere in the app.

### `status`
```bash
node scripts/plantImageAgent status
```
Report where the pipeline stands and what the next stage is.

## Standing rules

- Never edit `assets/plants/` or `plantDatabase.ts` by hand — the `apply` command owns both,
  so provenance and backups stay intact.
- Never mark a verdict or a winner for an image you have not actually looked at.
- Sources are Unsplash and Wikimedia Commons. AI generation is deliberately out of scope.
