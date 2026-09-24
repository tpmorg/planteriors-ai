#!/usr/bin/env node
/**
 * Plant Library image agent.
 *
 * Mechanical half of the pipeline: inventory, technical checks, candidate sourcing,
 * contact sheet, and the apply step. The visual judgement lives in RUBRIC.md and is
 * performed by Claude via the /plant-images command, which feeds verdicts back in here.
 *
 *   node scripts/plantImageAgent audit
 *   node scripts/plantImageAgent queue [--batch 10] [--all]
 *   node scripts/plantImageAgent record verdicts <file.json>
 *   node scripts/plantImageAgent source [--ids a,b] [--limit 20] [--per-plant 4]
 *   node scripts/plantImageAgent source --ids a --query "bird of paradise plant in pot"   (one targeted search, appended)
 *   node scripts/plantImageAgent crop --id <plant> --from c14 --box x,y,width,height
 *   node scripts/plantImageAgent record decisions <file.json>
 *   node scripts/plantImageAgent sheet
 *   node scripts/plantImageAgent apply --confirm [--ids a,b]
 *   node scripts/plantImageAgent status
 */

const fs = require('fs');
const path = require('path');
const { PROJECT_ROOT } = require('./lib/env');
const { CATALOG_FILE, ASSETS_DIR, parseCatalog, setPlantAsset } = require('./lib/catalog');
const { getDimensions, makeThumbnail, makeCardCrop, parseBox, cropImage, hashFile, looksLikeJpeg } = require('./lib/image');
const { PATHS, ensureDir, readJson, writeJson } = require('./lib/state');
const unsplash = require('./lib/unsplash');
const wikimedia = require('./lib/wikimedia');

const PROVIDERS = {
  unsplash: { queries: unsplash.buildQueries, search: (query) => unsplash.searchPhotos(query), download: unsplash.downloadPhoto, pause: 400 },
  wikimedia: { queries: wikimedia.buildQueries, search: (query) => wikimedia.searchFiles(query), download: wikimedia.downloadFile, pause: 200 },
};
const candidateSource = (candidate) => candidate.source || 'unsplash';
const candidateKey = (candidate) => candidate.sourceId || candidate.unsplashId;
// Legacy manifests marked interrupted Unsplash runs with `partial: true`.
const partialOf = (entry) => (entry?.partial === true ? 'unsplash' : entry?.partial || null);
const { RUBRIC_VERSION, verdictFor, validateWinner, validateOwnerPick, positiveInteger, diversify } = require('./lib/review');

const LIMITS = {
  minShortEdge: 312, // 104pt compact card at 3x; larger hero use is reviewed separately.
  preferredShortEdge: 700,
  maxBytes: 600 * 1024,
  maxLongEdge: 1600,
};

const rel = (file) => path.relative(PROJECT_ROOT, file);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const safeUrl = (value) => { try { return new URL(value).protocol === 'https:' ? escapeHtml(value) : ''; } catch { return ''; } };

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const [flag, inlineValue] = token.slice(2).split('=');
      const next = argv[i + 1];
      if (inlineValue !== undefined) args[flag] = inlineValue;
      else if (next && !next.startsWith('--')) { args[flag] = next; i++; }
      else args[flag] = true;
    } else {
      args._.push(token);
    }
  }
  return args;
}

/* ---------------------------------------------------------------- audit -- */

function checkTechnical(file) {
  const flags = [];
  if (!fs.existsSync(file)) return { flags: ['missing-file'], bytes: 0 };

  const bytes = fs.statSync(file).size;
  const dimensions = getDimensions(file);

  if (!looksLikeJpeg(file)) flags.push('not-a-jpeg');
  if (!dimensions) {
    flags.push('unreadable');
  } else {
    const shortEdge = Math.min(dimensions.width, dimensions.height);
    if (shortEdge < LIMITS.minShortEdge) flags.push(`low-resolution(${dimensions.width}x${dimensions.height})`);
    // Aspect affects crop review, not whether the photograph is usable.
  }

  return { flags, bytes, ...(dimensions || {}) };
}

function commandAudit() {
  const { plants } = parseCatalog();
  ensureDir(PATHS.current);

  const byHash = new Map();
  const entries = plants.map((plant) => {
    const file = path.join(ASSETS_DIR, plant.assetFile || '');
    const technical = plant.assetFile ? checkTechnical(file) : { flags: ['no-image-configured'], bytes: 0 };
    let thumb = null;
    let cardCrop = null;
    let hash = null;

    if (!technical.flags.includes('missing-file') && !technical.flags.includes('no-image-configured')) {
      hash = hashFile(file);
      byHash.set(hash, [...(byHash.get(hash) || []), plant.id]);
      try {
        thumb = makeThumbnail(file, path.join(PATHS.current, `${plant.id}.jpg`));
        cardCrop = makeCardCrop(file, path.join(PATHS.current, `${plant.id}.card.jpg`));
      } catch {
        technical.flags.push('thumbnail-failed');
      }
    }

    return {
      id: plant.id,
      name: plant.name,
      scientificName: plant.scientificName,
      category: plant.category,
      description: plant.description,
      assetFile: plant.assetFile,
      width: technical.width || null,
      height: technical.height || null,
      aspect: technical.width ? Number((technical.width / technical.height).toFixed(3)) : null,
      kb: Math.round(technical.bytes / 1024),
      hash,
      technicalFlags: technical.flags,
      technicalPass: technical.flags.length === 0,
      optimizationNotes: [
        ...(technical.bytes > LIMITS.maxBytes ? ['Re-encode before bundling; not a visual rejection'] : []),
        ...(technical.width && Math.min(technical.width, technical.height) < LIMITS.preferredShortEdge ? ['Below preferred 700px; inspect hero sharpness before replacing'] : []),
      ],
      thumb: thumb ? rel(thumb) : null,
      cardCrop: cardCrop ? rel(cardCrop) : null,
    };
  });

  const duplicates = [...byHash.values()].filter((ids) => ids.length > 1);
  for (const group of duplicates) {
    for (const entry of entries.filter((item) => group.includes(item.id))) {
      entry.technicalFlags.push(`duplicate-of(${group.filter((id) => id !== entry.id).join(',')})`);
      entry.technicalPass = false;
    }
  }

  const used = new Set(plants.map((plant) => plant.assetFile));
  const orphans = fs.readdirSync(ASSETS_DIR)
    .filter((file) => /\.(jpe?g|png|webp)$/i.test(file) && !used.has(file));

  const audit = {
    generatedAt: new Date().toISOString(),
    limits: LIMITS,
    summary: {
      plants: entries.length,
      technicalPass: entries.filter((entry) => entry.technicalPass).length,
      technicalFail: entries.filter((entry) => !entry.technicalPass).length,
      duplicateGroups: duplicates.length,
      orphanFiles: orphans.length,
    },
    duplicates,
    orphans,
    plants: entries,
  };

  writeJson(PATHS.audit, audit);

  console.log('=== Plant image audit ===');
  console.log(`Plants in catalog: ${audit.summary.plants}`);
  console.log(`Technical pass:    ${audit.summary.technicalPass}`);
  console.log(`Technical fail:    ${audit.summary.technicalFail}`);
  if (duplicates.length) console.log(`Duplicate groups:  ${duplicates.map((group) => group.join('=')).join(' | ')}`);
  if (orphans.length) console.log(`Orphan files:      ${orphans.join(', ')}`);
  console.log(`\nThumbnails: ${rel(PATHS.current)}/`);
  console.log(`Report:     ${rel(PATHS.audit)}`);

  const failing = entries.filter((entry) => !entry.technicalPass);
  if (failing.length) {
    console.log('\nTechnical failures:');
    for (const entry of failing) console.log(`  ${entry.id.padEnd(30)} ${entry.technicalFlags.join(', ')}`);
  }
  console.log('\nNext: /plant-images review  (grades every image by eye against RUBRIC.md)');
}

/* ---------------------------------------------------------------- queue -- */

function commandQueue(args) {
  const audit = readJson(PATHS.audit);
  if (!audit) throw new Error('No audit yet. Run: node scripts/plantImageAgent audit');
  const verdicts = readJson(PATHS.verdicts, {});
  const batchSize = positiveInteger(args.batch, 10);

  const pending = audit.plants.filter((plant) => args.all || verdicts[plant.id]?.rubricVersion !== RUBRIC_VERSION || verdicts[plant.id]?.reviewedHash !== plant.hash);
  const batches = [];
  for (let i = 0; i < pending.length; i += batchSize) {
    batches.push(pending.slice(i, i + batchSize).map((plant) => ({
      id: plant.id,
      name: plant.name,
      scientificName: plant.scientificName,
      reviewedHash: plant.hash,
      thumb: plant.thumb,
      cardCrop: plant.cardCrop,
      fullSize: plant.assetFile ? `assets/plants/${plant.assetFile}` : null,
      technicalFlags: plant.technicalFlags,
    })));
  }

  console.log(JSON.stringify({
    totalPending: pending.length,
    batchSize,
    batchCount: batches.length,
    batches,
  }, null, 2));
}

/* --------------------------------------------------------------- record -- */

function commandRecord(args) {
  const [kind, file] = args._;
  if (!['verdicts', 'decisions'].includes(kind)) throw new Error('Usage: record <verdicts|decisions> <file.json>');
  if (!file || !fs.existsSync(file)) throw new Error(`File not found: ${file}`);

  const incoming = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const target = kind === 'verdicts' ? PATHS.verdicts : PATHS.decisions;
  const existing = readJson(target, {});
  const known = new Map((readJson(PATHS.audit, { plants: [] })).plants.map((plant) => [plant.id, plant]));
  const manifest = readJson(path.join(PATHS.workspace, 'candidates.json'), {});
  const verdicts = readJson(PATHS.verdicts, {});

  let written = 0;
  for (const [id, payload] of Object.entries(incoming)) {
    if (!known.has(id)) throw new Error(`Unknown plant id: ${id}`);
    const plant = known.get(id);
    const currentHash = plant.assetFile && fs.existsSync(path.join(ASSETS_DIR, plant.assetFile)) ? hashFile(path.join(ASSETS_DIR, plant.assetFile)) : null;
    if (payload.reviewedHash !== plant.hash || currentHash !== plant.hash) throw new Error(`${id}: stale/missing reviewedHash; audit and review again`);
    if (kind === 'verdicts') {
      const expected = verdictFor(payload);
      if (payload.verdict !== expected) throw new Error(`${id}: scores imply ${expected}, not ${payload.verdict}`);
    } else {
      if (typeof payload.reason !== 'string' || !payload.reason.trim()) throw new Error(`${id}: decision reason required`);
      if (payload.winner !== null && payload.winner !== 'keep') {
        const candidate = manifest[id]?.candidates.find((item) => `c${item.slot}` === payload.winner);
        if (!candidate || !payload.candidateHash || payload.candidateHash !== hashFile(path.join(PROJECT_ROOT, candidate.file))) throw new Error(`${id}: missing/stale candidateHash or winner`);
        const current = verdicts[id];
        if (current?.rubricVersion !== RUBRIC_VERSION || current.reviewedHash !== currentHash) throw new Error(`${id}: review current image first`);
        if (payload.override === 'owner') validateOwnerPick(payload.review);
        else validateWinner(current, payload.review);
      }
    }
    const { appliedAt, ...reviewed } = payload;
    existing[id] = { ...reviewed, rubricVersion: RUBRIC_VERSION, recordedAt: new Date().toISOString() };
    written++;
  }

  writeJson(target, existing);
  console.log(`Recorded ${written} ${kind} (${Object.keys(existing).length} total) -> ${rel(target)}`);

  if (kind === 'verdicts') {
    const tally = Object.values(existing).reduce((acc, entry) => {
      acc[entry.verdict] = (acc[entry.verdict] || 0) + 1;
      return acc;
    }, {});
    console.log('Tally:', JSON.stringify(tally));
  }
}

/* --------------------------------------------------------------- source -- */

async function commandSource(args) {
  const audit = readJson(PATHS.audit);
  if (!audit) throw new Error('No audit yet. Run: node scripts/plantImageAgent audit');
  const verdicts = readJson(PATHS.verdicts, {});
  const perPlant = positiveInteger(args['per-plant'], 8, 24);
  const providerName = args.provider || 'unsplash';
  const provider = PROVIDERS[providerName];
  if (!provider) throw new Error(`--provider must be one of: ${Object.keys(PROVIDERS).join(', ')}`);

  let targets;
  if (args.ids) {
    const wanted = new Set(String(args.ids).split(',').map((id) => id.trim()));
    for (const id of wanted) if (!audit.plants.some((plant) => plant.id === id)) throw new Error(`Unknown plant id: ${id}`);
    targets = audit.plants.filter((plant) => wanted.has(plant.id));
  } else {
    targets = audit.plants.filter((plant) => {
      const review = verdicts[plant.id];
      const verdict = review?.rubricVersion === RUBRIC_VERSION && review.reviewedHash === plant.hash ? review.verdict : undefined;
      return verdict === 'replace' || verdict === 'borderline' || (!verdict && !plant.technicalPass);
    });
  }

  const manifestPath = path.join(PATHS.workspace, 'candidates.json');
  const manifest = readJson(manifestPath, {});
  // A targeted --query adds to whatever a plant already has; otherwise each provider fills its
  // own share of a plant's candidates and the other provider's are kept.
  if (args.query && !args.ids) throw new Error('--query needs --ids so it only searches the plants you mean');
  if (!args.query) targets = targets.filter((plant) => {
    const existing = manifest[plant.id];
    if (args.refresh || partialOf(existing) === providerName) return true;
    return providerName === 'unsplash'
      ? !existing?.candidates?.some((candidate) => candidateSource(candidate) === 'unsplash')
      : !existing?.candidates?.some((candidate) => candidateSource(candidate) === 'wikimedia');
  });
  if (args.limit) targets = targets.slice(0, positiveInteger(args.limit, 20));

  if (!targets.length) {
    console.log('Nothing to source. Everything targeted already has candidates (use --refresh to redo).');
    return;
  }

  console.log(`Sourcing ${providerName} candidates for ${targets.length} plant(s), up to ${perPlant} each.\n`);

  for (const [index, plant] of targets.entries()) {
    process.stdout.write(`[${index + 1}/${targets.length}] ${plant.id} `);
    const kept = (manifest[plant.id]?.candidates || []).filter((candidate) => args.query || candidateSource(candidate) !== providerName);
    const keptKeys = new Set(kept.map(candidateKey));
    let nextSlot = Math.max(0, ...kept.map((candidate) => candidate.slot)) + 1;
    const collected = [];
    const groups = [];
    const finish = () => [...kept, ...collected].sort((a, b) => a.slot - b.slot);

    try {
      for (const query of args.query ? [String(args.query)] : provider.queries(plant)) {
        const results = args.query && providerName === 'unsplash' ? await unsplash.searchPhotos(query, 30) : await provider.search(query);
        groups.push(results.filter((photo) => Math.min(photo.width, photo.height) >= LIMITS.minShortEdge && !keptKeys.has(candidateKey(photo))));
        await unsplash.sleep(provider.pause);
      }
      for (const photo of diversify(groups, perPlant)) {
          const key = candidateKey(photo);
          const dir = ensureDir(path.join(PATHS.candidates, plant.id));
          const file = path.join(dir, `${key}.jpg`);
          try {
            await provider.download(photo, file);
          } catch (error) {
            if (providerName === 'unsplash') throw error;
            process.stdout.write(`(skipped ${key}: ${error.message}) `);
            continue;
          }
          const slot = nextSlot++;
          const thumb = makeThumbnail(file, path.join(dir, `${key}.thumb.jpg`));
          const cardCrop = makeCardCrop(file, path.join(dir, `${key}.card.jpg`));
          const dimensions = getDimensions(file) || {};

          collected.push({
            ...photo,
            slot,
            hash: hashFile(file),
            file: rel(file),
            thumb: rel(thumb),
            cardCrop: rel(cardCrop),
            kb: Math.round(fs.statSync(file).size / 1024),
            width: dimensions.width || photo.width,
            height: dimensions.height || photo.height,
          });
        }
    } catch (error) {
      if (collected.length) {
        manifest[plant.id] = { sourcedAt: new Date().toISOString(), partial: providerName, candidates: finish() };
        writeJson(manifestPath, manifest);
      }
      if (error.rateLimited) {
        console.log('\n\n' + error.message);
        console.log(`Progress saved. ${Object.keys(manifest).length} plant(s) have candidates so far.`);
        writeJson(manifestPath, manifest);
        return;
      }
      console.log(`failed: ${error.message}`);
      continue;
    }

    const otherPartial = partialOf(manifest[plant.id]) !== providerName ? partialOf(manifest[plant.id]) : null;
    manifest[plant.id] = { sourcedAt: new Date().toISOString(), candidates: finish(), ...(otherPartial ? { partial: otherPartial } : {}) };
    writeJson(manifestPath, manifest);
    console.log(`-> ${collected.length} ${providerName} candidate(s)`);
  }

  const remaining = providerName === 'unsplash' ? unsplash.getRemainingRequests() : null;
  console.log(`\nCandidates: ${rel(PATHS.candidates)}/`);
  if (remaining !== null) console.log(`Unsplash requests remaining this hour: ${remaining}`);
  console.log('Next: /plant-images choose  (ranks candidates against RUBRIC.md)');
}

/* ----------------------------------------------------------------- crop -- */

/**
 * Derive a new candidate by cropping an existing one, e.g. to remove a plant label or to
 * re-centre a subject. It keeps the parent's source and license and records the crop, so
 * the credits can state the modification that CC BY-SA requires.
 */
function commandCrop(args) {
  if (!args.id || !args.from || !args.box) throw new Error('Usage: crop --id <plant> --from c14 --box x,y,width,height');
  const manifestPath = path.join(PATHS.workspace, 'candidates.json');
  const manifest = readJson(manifestPath, {});
  const candidates = manifest[args.id]?.candidates;
  const parent = candidates?.find((candidate) => `c${candidate.slot}` === args.from);
  if (!parent) throw new Error(`${args.id}: no candidate ${args.from}`);

  const parentFile = path.join(PROJECT_ROOT, parent.file);
  if (hashFile(parentFile) !== parent.hash) throw new Error(`${args.id} ${args.from}: file changed since sourcing`);
  const box = parseBox(args.box, getDimensions(parentFile));
  const key = `${candidateKey(parent)}-crop-${box.x}-${box.y}-${box.width}-${box.height}`;
  if (candidates.some((candidate) => candidate.sourceId === key)) throw new Error(`${args.id}: that crop already exists`);

  const dir = path.dirname(parentFile);
  const file = cropImage(parentFile, path.join(dir, `${key}.jpg`), box);
  const dimensions = getDimensions(file);
  if (!dimensions || dimensions.width !== box.width || dimensions.height !== box.height) {
    throw new Error(`${args.id}: crop produced ${dimensions?.width}x${dimensions?.height}, expected ${box.width}x${box.height}`);
  }
  const thumb = makeThumbnail(file, path.join(dir, `${key}.thumb.jpg`));
  const cardCrop = makeCardCrop(file, path.join(dir, `${key}.card.jpg`));
  const slot = Math.max(...candidates.map((candidate) => candidate.slot)) + 1;

  candidates.push({
    ...parent,
    sourceId: key,
    slot,
    derivedFrom: args.from,
    crop: box,
    description: `Cropped from ${args.from}. ${parent.description || ''}`.trim(),
    hash: hashFile(file),
    file: rel(file),
    thumb: rel(thumb),
    cardCrop: rel(cardCrop),
    kb: Math.round(fs.statSync(file).size / 1024),
    width: dimensions.width,
    height: dimensions.height,
  });
  writeJson(manifestPath, manifest);
  console.log(`${args.id}: c${slot} = ${args.from} cropped to ${box.width}x${box.height} at (${box.x},${box.y})`);
}

/* ---------------------------------------------------------------- sheet -- */

function commandSheet(args = {}) {
  const audit = readJson(PATHS.audit);
  if (!audit) throw new Error('No audit yet. Run: node scripts/plantImageAgent audit');
  const verdicts = readJson(PATHS.verdicts, {});
  const decisions = readJson(PATHS.decisions, {});
  const manifest = readJson(path.join(PATHS.workspace, 'candidates.json'), {});

  // Every plant lands in exactly one review status; the page filters on it client-side.
  const STATUS = {
    ready: 'Ready to review',
    'no-match': 'No match found',
    'needs-pick': 'Awaiting pick',
    'needs-source': 'Not sourced',
    keep: 'Keeping current',
    applied: 'Applied',
  };
  const statusOf = (plant) => {
    const decision = decisions[plant.id];
    if (decision?.appliedAt) return 'applied';
    if (decision?.winner && decision.winner !== 'keep') return 'ready';
    if (decision?.winner === 'keep' || verdicts[plant.id]?.verdict === 'keep') return 'keep';
    if (decision && decision.winner === null) return 'no-match';
    if (manifest[plant.id]?.candidates?.length) return 'needs-pick';
    return 'needs-source';
  };
  const statusOrder = Object.keys(STATUS);
  const rows = audit.plants
    .map((plant) => ({ plant, status: statusOf(plant), wrong: Boolean(verdicts[plant.id]?.hardFails?.includes('wrong-species')) }))
    .sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)
      || Number(b.wrong) - Number(a.wrong)
      || a.plant.name.localeCompare(b.plant.name));
  const counts = rows.reduce((acc, row) => ({ ...acc, [row.status]: (acc[row.status] || 0) + 1 }), {});
  const wrongCount = rows.filter((row) => row.wrong).length;
  const defaultFilter = counts.ready ? 'ready' : 'all';

  // Thumbnails are inlined as data URIs so the sheet is one portable file that renders
  // anywhere (browser, preview pane, shared with someone else). --link keeps paths instead.
  const href = (file) => {
    if (!file) return '';
    const absolute = path.join(PROJECT_ROOT, file);
    if (args.link) return path.relative(PATHS.workspace, absolute);
    if (!fs.existsSync(absolute)) return '';
    return `data:image/jpeg;base64,${fs.readFileSync(absolute).toString('base64')}`;
  };

  // Applied plants show before -> after. `apply` backs up each replaced asset by its hash,
  // which is the hash the verdict reviewed.
  const beforeThumb = (plant, reviewedHash) => {
    const backup = path.join(PATHS.workspace, 'replaced', `${plant.id}-${reviewedHash}.jpg`);
    if (!reviewedHash || !fs.existsSync(backup)) return null;
    const thumb = path.join(ensureDir(path.join(PATHS.workspace, 'before')), `${plant.id}.jpg`);
    if (!fs.existsSync(thumb)) makeThumbnail(backup, thumb);
    return rel(thumb);
  };

  const cards = rows.map(({ plant, status, wrong }) => {
    const verdict = verdicts[plant.id] || {};
    const decision = decisions[plant.id];
    const candidates = manifest[plant.id]?.candidates || [];
    const isPick = (candidate) => decision?.winner === `c${candidate.slot}`;
    const pick = candidates.find(isPick);
    const scores = verdict.scores
      ? Object.entries(verdict.scores).map(([key, value]) => `<span class="score"><b>${escapeHtml(value)}</b> ${escapeHtml(key)}</span>`).join('')
      : '';

    // The pick sits right after the current image; alternates follow in slot order.
    const ordered = [...candidates].sort((a, b) => Number(isPick(b)) - Number(isPick(a)));
    const candidateCells = ordered.map((candidate) => {
      const chosen = isPick(candidate);
      return `<figure class="${chosen ? 'chosen' : 'alt'}">
        <img src="${href(candidate.thumb)}" alt="candidate ${candidate.slot}, full framing" loading="lazy" decoding="async">
        <img class="compact" src="${href(candidate.cardCrop || candidate.thumb)}" alt="candidate ${candidate.slot}, 104 pixel square crop" loading="lazy" decoding="async">
        <figcaption>c${candidate.slot} &middot; ${candidate.width}&times;${candidate.height} &middot; ${candidate.kb}KB
          <br>${candidateSource(candidate) === 'wikimedia' ? `Commons &middot; ${escapeHtml(candidate.license)} &middot; ` : ''}<a href="${safeUrl(candidate.pageUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(candidate.photographer)}</a>
          <br>${escapeHtml(candidate.description)}
          <br>Query: ${escapeHtml(candidate.query)}
          ${chosen ? '<br><b>SELECTED</b>' : ''}</figcaption>
      </figure>`;
    }).join('') || '<p class="none">no candidates sourced</p>';
    const hiddenAlternates = pick ? candidates.length - 1 : 0;

    const pickScores = pick && decision.review?.scores ? Object.values(decision.review.scores) : null;
    const pickLine = pick ? `<p class="pick">${decision.override === 'owner' ? '<b>Owner pick</b> &middot; ' : ''}Pick <b>c${pick.slot}</b> &middot; ${candidateSource(pick) === 'wikimedia'
      ? `Wikimedia Commons &middot; ${escapeHtml(pick.license)}` : 'Unsplash'} &middot; ${escapeHtml(pick.photographer)}${pickScores
      ? ` &middot; avg ${(pickScores.reduce((sum, value) => sum + value, 0) / pickScores.length).toFixed(1)}, lowest ${Math.min(...pickScores)}` : ''}${/unknown author/i.test(pick.photographer || '')
      ? ' <span class="warn">Author unknown: attribution cannot be confirmed</span>' : ''}</p>` : '';

    return `<section class="${pick ? 'has-pick' : ''}" data-status="${status}" data-wrong="${wrong ? 1 : 0}" data-search="${escapeHtml(`${plant.name} ${plant.scientificName} ${plant.id}`.toLowerCase())}">
      <header>
        <h2>${escapeHtml(plant.name)} <em>${escapeHtml(plant.scientificName)}</em></h2>
        <div class="badges">
          ${wrong ? (status === 'applied' ? '<span class="wrongtag fixed">Was wrong plant</span>' : '<span class="wrongtag">Wrong plant</span>') : ''}
          <span class="status status-${status}">${STATUS[status]}</span>
          <span class="verdict ${escapeHtml(verdict.verdict || 'unreviewed')}">${escapeHtml(verdict.verdict || 'unreviewed')}</span>
        </div>
      </header>
      ${plant.technicalFlags.length ? `<p class="flags">technical: ${escapeHtml(plant.technicalFlags.join(', '))}</p>` : ''}
      ${plant.optimizationNotes?.length ? `<p class="note">${escapeHtml(plant.optimizationNotes.join('; '))}</p>` : ''}
      ${verdict.hardFails?.length ? `<p class="flags">hard fails: ${escapeHtml(verdict.hardFails.join(', '))}</p>` : ''}
      ${verdict.note ? `<p class="note">${escapeHtml(verdict.note)}</p>` : ''}
      ${status !== 'applied' && (verdict.rubricVersion !== RUBRIC_VERSION || verdict.reviewedHash !== plant.hash) ? '<p class="flags">Needs review under rubric v2; old scores are reference only.</p>' : ''}
      <div class="scores">${scores}</div>
      ${pickLine}
      ${status === 'applied' ? (() => {
        const before = beforeThumb(plant, verdict.reviewedHash);
        return `<div class="strip">
        ${before ? `<figure class="before"><img src="${href(before)}" alt="before" loading="lazy" decoding="async"><figcaption>before</figcaption></figure>
        <div class="arrow">&rarr;</div>` : ''}
        <figure class="chosen"><img src="${href(plant.thumb)}" alt="now" loading="lazy" decoding="async">
          <img class="compact" src="${href(plant.cardCrop || plant.thumb)}" alt="now, 104 pixel square crop" loading="lazy" decoding="async">
          <figcaption>now in the app &middot; ${plant.width}&times;${plant.height} &middot; ${plant.kb}KB</figcaption></figure>
      </div>`;
      })() : `<div class="strip">
        <figure class="current">
          <img src="${href(plant.thumb)}" alt="current" loading="lazy" decoding="async">
          <img class="compact" src="${href(plant.cardCrop || plant.thumb)}" alt="current, 104 pixel square crop" loading="lazy" decoding="async">
          <figcaption>current &middot; ${plant.width}&times;${plant.height} &middot; ${plant.kb}KB</figcaption>
        </figure>
        <div class="arrow">&rarr;</div>
        ${candidateCells}
        ${hiddenAlternates ? `<span class="alt-note">+${hiddenAlternates} other candidate${hiddenAlternates === 1 ? '' : 's'} hidden</span>` : ''}
      </div>`}
      ${decision?.review?.note ? `<p class="note">pick review: ${escapeHtml(decision.review.note)}</p>` : ''}
      ${decision?.reason ? `<p class="note">decision: ${escapeHtml(decision.reason)}</p>` : ''}
    </section>`;
  }).join('\n');

  const chips = [...statusOrder, 'all'].map((key) => {
    const count = key === 'all' ? rows.length : counts[key] || 0;
    return `<button type="button" class="chip" data-filter="${key}"${count ? '' : ' disabled'}>${key === 'all' ? 'All' : STATUS[key]} <span class="count">${count}</span></button>`;
  }).join('');

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Plant Library image review</title>
<style>
:root { color-scheme: light dark; --bg:#fff; --fg:#14170f; --muted:#6b7280; --line:#e5e7eb; --card:#fafaf8; }
@media (prefers-color-scheme: dark) { :root { --bg:#121410; --fg:#eef0ea; --muted:#9ca3af; --line:#2b2f27; --card:#191c16; } }
[hidden] { display:none !important; }
body { margin:0; padding:0 24px 24px; background:var(--bg); color:var(--fg); font:14px/1.5 -apple-system, system-ui, sans-serif; }
h1 { font-size:22px; margin:24px 0 4px; }
.lede { color:var(--muted); margin:0 0 16px; }
.toolbar { position:sticky; top:0; z-index:5; background:var(--bg); border-bottom:1px solid var(--line); margin:0 -24px 20px; padding:12px 24px; display:flex; flex-direction:column; gap:10px; }
.chips { display:flex; flex-wrap:wrap; gap:6px; }
.chip { font:inherit; font-size:12px; font-weight:600; border:1px solid var(--line); background:var(--card); color:var(--fg); border-radius:99px; padding:5px 11px; cursor:pointer; }
.chip[aria-pressed="true"] { background:var(--fg); color:var(--bg); border-color:var(--fg); }
.chip:disabled { opacity:.4; cursor:default; }
.count { font-weight:400; opacity:.7; margin-left:2px; }
.options { display:flex; flex-wrap:wrap; align-items:center; gap:14px; font-size:12px; color:var(--muted); }
.options label { display:flex; align-items:center; gap:5px; cursor:pointer; }
.options input[type=search] { font:inherit; font-size:13px; padding:5px 10px; border:1px solid var(--line); border-radius:8px; background:var(--card); color:var(--fg); min-width:180px; }
.shown { margin-left:auto; }
section { border:1px solid var(--line); border-radius:14px; padding:16px; margin-bottom:18px; background:var(--card); }
header { display:flex; align-items:center; gap:12px; justify-content:space-between; }
h2 { font-size:16px; margin:0; } h2 em { color:var(--muted); font-weight:400; font-size:13px; }
.badges { display:flex; flex-wrap:wrap; gap:6px; justify-content:flex-end; }
.verdict, .status, .wrongtag { font-size:11px; font-weight:800; text-transform:uppercase; padding:4px 9px; border-radius:99px; white-space:nowrap; }
.verdict.replace { background:#fee2e2; color:#991b1b; } .verdict.borderline { background:#fef3c7; color:#92400e; }
.verdict.keep { background:#dcfce7; color:#166534; } .verdict.unreviewed { background:var(--line); color:var(--muted); }
.status { background:var(--line); color:var(--fg); } .status-ready { background:#dbeafe; color:#1e40af; } .status-applied { background:#dcfce7; color:#166534; }
.wrongtag { background:#fde68a; color:#78350f; } .wrongtag.fixed { background:#dcfce7; color:#166534; }
.flags { color:#b45309; font-size:12px; margin:8px 0 0; } .note { color:var(--muted); font-size:12px; margin:8px 0 0; }
.pick { font-size:12px; margin:10px 0 0; } .warn { color:#dc2626; font-weight:700; }
.scores { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
.score { font-size:11px; color:var(--muted); background:var(--bg); border:1px solid var(--line); border-radius:99px; padding:3px 8px; }
.strip { display:flex; align-items:flex-start; gap:12px; margin-top:12px; overflow-x:auto; }
figure { margin:0; width:150px; flex:0 0 auto; }
figure img { width:150px; height:190px; object-fit:contain; border-radius:10px; border:1px solid var(--line); display:block; }
figure img.compact { width:104px; height:104px; object-fit:cover; margin-top:8px; }
figure.current img { border:2px solid var(--muted); } figure.chosen img { border:3px solid #16a34a; }
figcaption { font-size:10px; color:var(--muted); margin-top:5px; } figcaption a { color:inherit; }
.arrow { align-self:center; color:var(--muted); font-size:20px; } .none { color:var(--muted); font-size:12px; align-self:center; }
.alt-note { display:none; align-self:center; font-size:12px; color:var(--muted); }
body.picks-only section.has-pick figure.alt { display:none; }
body.picks-only section.has-pick .alt-note { display:block; }
</style></head>
<body class="picks-only">
<h1>Plant Library image review</h1>
<p class="lede">${rows.length} plant(s) &middot; generated ${new Date().toLocaleString()} &middot; current image on the left, candidates to the right</p>
<nav class="toolbar" aria-label="Filters">
  <div class="chips" role="group" aria-label="Status">${chips}</div>
  <div class="options">
    <label><input type="checkbox" id="wrongOnly"> Wrong plant only <span class="count">${wrongCount}</span></label>
    <label><input type="checkbox" id="showAll"> Show all candidates</label>
    <input type="search" id="search" placeholder="Search plants" aria-label="Search plants">
    <span id="shown" class="shown"></span>
  </div>
</nav>
${cards || '<p class="lede">Nothing reviewed yet.</p>'}
<p id="empty" class="lede" hidden>No plants match these filters.</p>
<script>
(function () {
  var sections = Array.prototype.slice.call(document.querySelectorAll('section[data-status]'));
  var chips = Array.prototype.slice.call(document.querySelectorAll('.chip'));
  var wrongOnly = document.getElementById('wrongOnly');
  var showAll = document.getElementById('showAll');
  var search = document.getElementById('search');
  var shown = document.getElementById('shown');
  var empty = document.getElementById('empty');
  var state = { filter: ${JSON.stringify(defaultFilter)}, wrong: false, all: false, q: '' };
  try {
    var saved = new URLSearchParams(location.hash.slice(1));
    if (saved.get('status')) state.filter = saved.get('status');
    state.wrong = saved.get('wrong') === '1';
    state.all = saved.get('all') === '1';
    state.q = saved.get('q') || '';
  } catch (error) {}
  function render() {
    var visible = 0;
    var q = state.q.trim().toLowerCase();
    sections.forEach(function (section) {
      var show = (state.filter === 'all' || section.dataset.status === state.filter)
        && (!state.wrong || section.dataset.wrong === '1')
        && (!q || section.dataset.search.indexOf(q) !== -1);
      section.hidden = !show;
      if (show) visible++;
    });
    chips.forEach(function (chip) { chip.setAttribute('aria-pressed', String(chip.dataset.filter === state.filter)); });
    wrongOnly.checked = state.wrong;
    showAll.checked = state.all;
    if (search.value !== state.q) search.value = state.q;
    document.body.classList.toggle('picks-only', !state.all);
    shown.textContent = 'Showing ' + visible + ' of ' + sections.length;
    empty.hidden = visible > 0;
    try {
      var params = new URLSearchParams({ status: state.filter });
      if (state.wrong) params.set('wrong', '1');
      if (state.all) params.set('all', '1');
      if (state.q) params.set('q', state.q);
      history.replaceState(null, '', '#' + params.toString());
    } catch (error) {}
  }
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () { state.filter = chip.dataset.filter; render(); window.scrollTo(0, 0); });
  });
  wrongOnly.addEventListener('change', function () { state.wrong = wrongOnly.checked; render(); });
  showAll.addEventListener('change', function () { state.all = showAll.checked; render(); });
  search.addEventListener('input', function () { state.q = search.value; render(); });
  render();
})();
</script>
</body></html>`;

  ensureDir(PATHS.workspace);
  fs.writeFileSync(PATHS.sheet, html);
  const mb = (fs.statSync(PATHS.sheet).size / (1024 * 1024)).toFixed(1);
  console.log(`Contact sheet: ${rel(PATHS.sheet)} (${mb}MB, ${args.link ? 'linked' : 'self-contained'})`);
  console.log(`Open with: open ${rel(PATHS.sheet)}`);
}

/* ---------------------------------------------------------------- apply -- */

// Detailed foliage can stay over budget at 1600px, so step the long edge down. Each attempt
// starts from the original candidate, so JPEG loss never compounds across attempts.
const BUNDLE_EDGES = [LIMITS.maxLongEdge, 1400, 1200, 1000];

function normalizeForBundle(source, staged) {
  for (const edge of BUNDLE_EDGES) {
    fs.copyFileSync(source, staged);
    const dimensions = getDimensions(staged);
    if (dimensions && Math.max(dimensions.width, dimensions.height) > edge) makeThumbnail(staged, staged, edge);
    if (fs.statSync(staged).size <= LIMITS.maxBytes) return;
    require('child_process').execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '70', staged, '--out', staged], { stdio: 'ignore' });
    if (fs.statSync(staged).size <= LIMITS.maxBytes) return;
  }
}

async function commandApply(args) {
  const decisions = readJson(PATHS.decisions, {});
  const manifest = readJson(path.join(PATHS.workspace, 'candidates.json'), {});
  const only = args.ids ? new Set(String(args.ids).split(',').map((id) => id.trim())) : null;
  const pending = Object.entries(decisions).filter(([id, decision]) => decision.winner && decision.winner !== 'keep' && !decision.appliedAt && (!only || only.has(id)));
  const catalog = parseCatalog();
  const verdicts = readJson(PATHS.verdicts, {});

  // Validate the whole batch before writing any bundled image.
  for (const [id, decision] of pending) {
    const plant = catalog.plants.find((item) => item.id === id);
    if (!plant) throw new Error(`Unknown plant id: ${id}`);
    const currentHash = plant?.assetFile && fs.existsSync(path.join(ASSETS_DIR, plant.assetFile)) ? hashFile(path.join(ASSETS_DIR, plant.assetFile)) : null;
    const candidate = manifest[id]?.candidates.find((item) => `c${item.slot}` === decision.winner);
    if (decision.rubricVersion !== RUBRIC_VERSION || decision.reviewedHash !== currentHash || !candidate || !decision.candidateHash || decision.candidateHash !== hashFile(path.join(PROJECT_ROOT, candidate.file))) throw new Error(`${id}: stale or legacy decision; review and record again before apply`);
    if (verdicts[id]?.rubricVersion !== RUBRIC_VERSION || verdicts[id]?.reviewedHash !== currentHash) throw new Error(`${id}: current review is stale`);
    if (decision.override === 'owner') validateOwnerPick(decision.review);
    else validateWinner(verdicts[id], decision.review);
  }

  if (!pending.length) {
    console.log('No pending replacements. Record decisions first (/plant-images choose).');
    return;
  }

  console.log(`${pending.length} replacement(s) pending:`);
  for (const [id, decision] of pending) console.log(`  ${id.padEnd(30)} <- ${decision.winner}  ${decision.reason || ''}`);

  if (!args.confirm) {
    console.log('\nDry run. Re-run with --confirm to write these into assets/plants/ and plantDatabase.ts.');
    return;
  }

  const backupDir = ensureDir(path.join(PATHS.workspace, 'replaced'));
  const ledger = readJson(PATHS.ledger, {});
  let catalogContent = fs.readFileSync(CATALOG_FILE, 'utf-8');
  let applied = 0;

  for (const [id, decision] of pending) {
    const candidate = (manifest[id]?.candidates || []).find((entry) => `c${entry.slot}` === decision.winner);
    if (!candidate) {
      console.log(`  ${id}: candidate ${decision.winner} not found, skipped`);
      continue;
    }

    const source = path.join(PROJECT_ROOT, candidate.file);
    const destination = path.join(ASSETS_DIR, `${id}.jpg`);

    const staged = path.join(ensureDir(path.join(PATHS.workspace, 'staged')), `${id}.jpg`);
    normalizeForBundle(source, staged);

    const check = checkTechnical(staged);
    const stagedKb = Math.round(fs.statSync(staged).size / 1024);
    if (check.flags.length || fs.statSync(staged).size > LIMITS.maxBytes) {
      const reasons = [...check.flags, ...(stagedKb > LIMITS.maxBytes / 1024 ? [`${stagedKb}KB over the ${LIMITS.maxBytes / 1024}KB budget`] : [])];
      console.log(`  ${id}: rejected after normalize (${reasons.join(', ')}); bundled image untouched`);
      continue;
    }

    // Unsplash's API terms require a download ping; Commons licenses require attribution instead.
    if (candidateSource(candidate) === 'unsplash') {
      const downloadReported = await unsplash.reportDownload(candidate);
      if (!downloadReported) throw new Error(`${id}: download tracking failed; image not applied`);
    }
    if (fs.existsSync(destination)) fs.copyFileSync(destination, path.join(backupDir, `${id}-${hashFile(destination)}.jpg`));
    fs.copyFileSync(staged, destination);

    catalogContent = setPlantAsset(catalogContent, id, `${id}.jpg`);

    ledger[`${id}.jpg`] = candidateSource(candidate) === 'wikimedia'
      ? {
        plantId: id,
        source: 'wikimedia-commons',
        title: candidate.title,
        author: candidate.photographer,
        license: candidate.license,
        licenseUrl: candidate.licenseUrl,
        attributionRequired: candidate.attributionRequired,
        pageUrl: candidate.pageUrl,
        query: candidate.query,
        ...(candidate.crop ? { modified: `Cropped to ${candidate.crop.width}x${candidate.crop.height} from the original` } : {}),
        appliedAt: new Date().toISOString(),
      }
      : {
        plantId: id,
        source: 'unsplash',
        unsplashId: candidate.unsplashId,
        photographer: candidate.photographer,
        photographerUrl: candidate.photographerUrl,
        pageUrl: candidate.pageUrl,
        query: candidate.query,
        ...(candidate.crop ? { modified: `Cropped to ${candidate.crop.width}x${candidate.crop.height} from the original` } : {}),
        appliedAt: new Date().toISOString(),
      };
    decisions[id] = { ...decision, appliedAt: new Date().toISOString() };
    fs.writeFileSync(CATALOG_FILE, catalogContent);
    writeJson(PATHS.ledger, ledger);
    writeJson(PATHS.decisions, decisions);
    applied++;
    console.log(`  ${id}: applied`);
  }

  fs.writeFileSync(CATALOG_FILE, catalogContent);
  writeJson(PATHS.ledger, ledger);
  writeJson(PATHS.decisions, decisions);

  console.log(`\nApplied ${applied} replacement(s).`);
  console.log(`Previous images backed up to ${rel(backupDir)}/`);
  console.log(`Credits ledger: ${rel(PATHS.ledger)}`);
  console.log('Review with: git diff --stat');
}

/* --------------------------------------------------------------- status -- */

function commandStatus() {
  const audit = readJson(PATHS.audit);
  if (!audit) { console.log('No audit yet. Run: node scripts/plantImageAgent audit'); return; }
  const verdicts = readJson(PATHS.verdicts, {});
  const decisions = readJson(PATHS.decisions, {});
  const manifest = readJson(path.join(PATHS.workspace, 'candidates.json'), {});

  const tally = Object.values(verdicts).reduce((acc, entry) => {
    acc[entry.verdict] = (acc[entry.verdict] || 0) + 1;
    return acc;
  }, {});

  console.log(`Audited:        ${audit.plants.length} plants (${audit.summary.technicalFail} technical failures)`);
  const fresh = audit.plants.filter((plant) => verdicts[plant.id]?.rubricVersion === RUBRIC_VERSION && verdicts[plant.id]?.reviewedHash === plant.hash).length;
  console.log(`Reviewed v2:    ${fresh}/${audit.plants.length} (${Object.keys(verdicts).length - fresh} legacy/stale records retained)`);
  console.log(`All verdicts:   ${JSON.stringify(tally)}`);
  console.log(`Sourced:        ${Object.keys(manifest).length} plants have candidates`);
  console.log(`Decided:        ${Object.keys(decisions).length}`);
  console.log(`Applied:        ${Object.values(decisions).filter((entry) => entry.appliedAt).length}`);
}

/* ----------------------------------------------------------------- main -- */

const COMMANDS = {
  audit: commandAudit,
  queue: commandQueue,
  record: commandRecord,
  source: commandSource,
  crop: commandCrop,
  sheet: commandSheet,
  apply: commandApply,
  status: commandStatus,
};

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const handler = COMMANDS[command];
  if (!handler) {
    const usage = fs.readFileSync(__filename, 'utf-8')
      .split('*/')[0].split('/**')[1]
      .split('\n').map((line) => line.replace(/^\s*\* ?/, '')).join('\n').trim();
    console.log(usage);
    if (command) console.error(`\nUnknown command: ${command}`);
    process.exit(command ? 1 : 0);
  }
  await handler(parseArgs(rest));
}

main().catch((error) => {
  console.error(`\nError: ${error.message}`);
  process.exit(1);
});
