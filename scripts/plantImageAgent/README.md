# Plant image review pipeline

This is an operator-assisted review tool, not an automatic botanical classifier. It
inventories local assets, sources candidates, builds comparisons, and records image-bound
reviews. It requires Node 18+ and macOS `sips`. No AI provider is called by the script.

## Revised workflow

1. `node scripts/plantImageAgent audit`
2. `node scripts/plantImageAgent queue --batch 8`
3. Inspect each queued full image and its 104px cover crop against RUBRIC.md v2.
4. Record verdicts using the schema below.
5. `node scripts/plantImageAgent source --ids monstera-deliciosa --per-plant 8 --refresh`
6. `node scripts/plantImageAgent sheet` and open `.plant-image-agent/contact-sheet.html`.
7. Inspect every proposed winner at full resolution, then record decisions.
8. `node scripts/plantImageAgent apply` validates without changing assets.
9. Apply only after review: `node scripts/plantImageAgent apply --confirm`.

All four query strategies are searched; the shortlist round-robins across their results
instead of accepting the first query's top three. Metadata gives a light prioritization
to potted specimens and de-prioritizes macros/hands; it is never a visual verdict.
Eight candidates per plant is the default. Start with 2–3 plants before a library-wide
run. Search responses are cached; refreshing candidates reuses valid cached searches.
Use targeted re-sourcing when no candidate meets the floor, not endless broad searches.

## Review records

`record verdicts file.json` accepts a map keyed by catalog plant ID:

```json
{
  "monstera-deliciosa": {
    "reviewedHash": "COPY THE HASH FROM QUEUE",
    "verdict": "keep",
    "hardFails": [],
    "scores": { "subjectIsolation": 4, "speciesConfidence": 4, "framing": 4, "thumbnailLegibility": 4, "catalogFit": 4 },
    "note": "Describe visible identity evidence, framing and the 104px crop."
  }
}
```

`record decisions file.json` uses the same current-image hash. A winner also requires
`candidateHash` (the manifest candidate's `hash`) and a complete `review` with hardFails,
scores and note. `winner` is `c1`, `c2`, etc., `keep`, or null. Always include `reason`.
Do not copy example scores: grade images you have actually inspected.

Old verdicts have no v2/hash stamp and are queued for re-review. Old decisions cannot
apply. Re-sourcing can move candidate slot numbers: hashes prevent an old `c2` decision
from silently selecting different bytes. Audit again after changing bundled assets.
Records are written by atomic rename. Run one operator process at a time; there is no
multi-process locking. Apply validates the batch first, normalizes a staging copy,
backs up overwritten files by content hash, then checkpoints each accepted replacement.
Apply is not a filesystem-wide transaction; review git changes after any interrupted run.

## Wikimedia Commons

`source --provider wikimedia` adds Commons candidates alongside a plant's Unsplash ones
(new slots; existing candidates are kept). Commons files are catalogued by botanical name,
so it covers species Unsplash lacks. No key is needed. Only JPEGs under CC0, public
domain, CC BY or CC BY-SA are accepted. Most require attribution: `apply` records the
author, license and file page in `IMAGE_CREDITS.json`, and the app must show credits.

## Source constraints

Unsplash search does not establish species identity. Specialty cultivars may have no
acceptable result. The correct outcome is unresolved, followed by a manually curated
source with documented permission—not a confident guess or generated plant photograph.

Unsplash's API documentation requires hotlinking in applications, attribution and download
tracking. A local bundled-asset workflow should not be assumed to satisfy those terms
merely because tracking succeeded. Confirm the intended distribution workflow before
shipping API-sourced assets: https://unsplash.com/documentation#hotlinking

## Tests

`node --test scripts/plantImageAgent/test/*.test.js`

Tests are offline and do not replace catalog assets or consume API requests.
