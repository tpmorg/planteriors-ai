# Plant Library Image Rubric

Version: 2. Previous verdicts and decisions require re-review, not automatic migration.
Amended 2026-09-23 (identity-first replacement rule below). Verdict criteria are unchanged,
so v2 verdicts remain valid.

The single source of truth for what a good Library image is. The vision review and the
candidate ranking both grade against this file. Every image is judged twice: once at full
size, once at thumbnail scale, because the Library renders it at 104x104 in the compact
card and full-bleed with a dark overlay in the hero card.

## The one rule that outranks the rest

**The image must help someone recognize and choose this plant at card size.**

A single dominant specimen is preferred. A pot, wall, floor, or small amount of room
context is acceptable when the plant remains the unmistakable subject. Do not call a
photo a room-scene merely because a skirting board or wall outlet is visible. Background
distractions lower subjectIsolation; only a competing scene is a hard fail.

Inspect full framing AND the actual 104x104 center-cover crop in the contact sheet.
Open full-resolution files for every proposed winner. Search terms and photographer
captions are leads, not botanical verification. Record visible leaf/habit evidence and
uncertainty; do not confidently identify a cultivar from a generic green silhouette.

## Hard fails (reject regardless of anything else)

| Code | Fails when |
|---|---|
| `wrong-species` | Not the species named in `scientificName`, or a different cultivar with a visibly different leaf |
| `room-scene` | An interior/exterior scene; the plant is set dressing rather than the subject |
| `collection` | More than one plant reads as a subject — shop shelf, nursery row, grouped arrangement |
| `not-whole-plant` | Extreme macro of a single leaf, flower, or root with no sense of the plant's form |
| `human-present` | A person or hands obscure the specimen or remain a competing subject in the card crop |
| `text-overlay` | Watermark, logo, price tag, caption, or store signage |
| `collage` | Multiple panels, borders, or composited frames |
| `illustration` | Drawing, render, botanical plate, or herbarium specimen sheet |
| `unusable-quality` | Heavy blur, heavy noise, blown highlights, or subject in deep shadow |
| `bad-crop` | Plant clipped by the frame edge in a way that hides its shape |

## Scored qualities (1-5 each)

- **`subjectIsolation`** — how cleanly the plant separates from its background. 5 = plain
  studio backdrop or soft neutral wall. 3 = simple background with minor context. 1 = busy.
- **`speciesConfidence`** — how certain you are this is the named species, judged on leaf
  shape, venation, habit, and pot-scale. 5 = unmistakable. 1 = a guess. Judge identity at
  the rank `scientificName` gives: when it names only a genus (e.g. `Schlumbergera`), any
  species of that genus qualifies; note which species it appears to be.
- **`framing`** — recognizable growth habit in frame, healthy headroom, crop-tolerant. A pot
  fully in frame is a plus; a plant cropped mid-leaf is not.
- **`thumbnailLegibility`** — inspect the actual 104px square cover crop, not an imagined reduction of the 384px thumbnail.
  5 = silhouette and leaf character still read. 1 = green mush.
- **`catalogFit`** — does it sit alongside the other Library images as one consistent set?
  Daylight, natural color, no heavy filter, no dramatic color grade.

## Verdict

- `keep` — no hard fail and the scores average >= 4.0 with no score below 3.
- `replace` — any hard fail, or average < 3.5, or `speciesConfidence` <= 2.
- `borderline` — everything in between. Source candidates; keep the current image unless a
  candidate clearly beats it.

## Technical floor (checked by the script, not by eye)

- At least 312px on the short edge (104pt compact card at 3x). Prefer 700px or more
  for larger uses; inspect hero sharpness separately. A 675px image is not an automatic
  replacement just because it misses an arbitrary 700px target.
- Landscape or very tall images require crop inspection, not automatic rejection.
- Maximum 600KB after encoding for bundle cost. Files below 40KB are not automatically
  bad: plain backgrounds compress well. Large files may need re-encoding, not replacement.
- Valid JPEG, and not byte-identical to another plant's image.

Missing, unreadable, or undersized images cannot be applied. Encoding cost is separate
from the visual verdict. Duplicate bytes require identity review; do not assume either
plant's ID is right. A technically fine image can still fail on the eye.

## Replacement threshold

A winner must have no hard fails, average >= 4, every score >= 3, and speciesConfidence
>= 4. It must improve the current average by >= 0.4 unless the current image has a hard
fail. Scores are evidence summaries, not objective measurements; explain what improved
in the 104px crop. If the winner only looks better at full resolution, abstain.

**Identity-first exception.** When the current image has the `wrong-species` hard fail, a
correct plant beats a polished wrong one. A candidate wins if it has no hard fails,
speciesConfidence >= 4 and every score >= 3; the 4.0 average is waived. Still prefer the
best candidate that qualifies, and still abstain when none shows the right plant clearly.

Use `keep` when the current image is acceptable and no candidate improves it; use null
when the current needs work but no acceptable replacement was found. Never choose the
least bad candidate simply to finish a batch. Do not falsify scores to meet the threshold.
