const SCORE_KEYS = ['subjectIsolation', 'speciesConfidence', 'framing', 'thumbnailLegibility', 'catalogFit'];
const RUBRIC_VERSION = 2;

function validateReview(review) {
  if (!review || !Array.isArray(review.hardFails) || review.hardFails.some((value) => typeof value !== 'string')) throw new Error('hardFails must be an array of codes');
  for (const key of SCORE_KEYS) {
    const score = review.scores?.[key];
    if (!Number.isInteger(score) || score < 1 || score > 5) throw new Error(`${key} must be an integer from 1 to 5`);
  }
  if (typeof review.note !== 'string' || !review.note.trim()) throw new Error('A visual evidence note is required');
  return SCORE_KEYS.reduce((sum, key) => sum + review.scores[key], 0) / SCORE_KEYS.length;
}

function verdictFor(review) {
  const average = validateReview(review);
  if (review.hardFails.length || average < 3.5 || review.scores.speciesConfidence <= 2) return 'replace';
  if (average >= 4 && SCORE_KEYS.every((key) => review.scores[key] >= 3)) return 'keep';
  return 'borderline';
}

function validateWinner(current, candidate) {
  const baseline = validateReview(current);
  const score = validateReview(candidate);
  // Identity outranks polish: a correct plant with no hard fails and no weak score replaces
  // an image of the wrong plant even below the 4.0 average.
  if (current.hardFails.includes('wrong-species')) {
    if (candidate.hardFails.length || candidate.scores.speciesConfidence < 4 || SCORE_KEYS.some((key) => candidate.scores[key] < 3)) {
      throw new Error('Replacing a wrong-species image requires no hard fails, species confidence >= 4 and every score >= 3');
    }
    return;
  }
  if (verdictFor(candidate) !== 'keep' || candidate.scores.speciesConfidence < 4) throw new Error('Winner must pass the rubric with species confidence >= 4');
  if (!current.hardFails.length && score < baseline + 0.4) throw new Error('Winner must improve the average by at least 0.4; otherwise keep or abstain');
}

function positiveInteger(value, fallback, max = 100) {
  if (typeof value === 'boolean') throw new Error('A numeric value is required');
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) throw new Error(`Expected an integer between 1 and ${max}`);
  return parsed;
}

// Text only prioritizes candidates; it never verifies species or rejects a photo.
function candidatePriority(photo) {
  const text = photo.description || '';
  return (/\b(potted|pot|whole plant|isolated)\b/i.test(text) ? 2 : 0)
    - (/\b(close.?up|macro|hands?|holding|nursery|shelf)\b/i.test(text) ? 3 : 0);
}

const candidateKey = (photo) => photo.sourceId || photo.unsplashId;

function diversify(groups, limit) {
  const queues = groups.map((group) => [...group].sort((a, b) => candidatePriority(b) - candidatePriority(a)));
  const selected = [];
  const seen = new Set();
  while (selected.length < limit && queues.some((queue) => queue.length)) {
    for (const queue of queues) {
      let photo;
      while (queue.length && !photo) {
        const next = queue.shift();
        if (!seen.has(candidateKey(next))) photo = next;
      }
      if (photo) { seen.add(candidateKey(photo)); selected.push(photo); }
      if (selected.length === limit) break;
    }
  }
  return selected;
}

// The owner may accept a correct plant below the quality bar. Identity and hard fails still apply.
function validateOwnerPick(candidate) {
  validateReview(candidate);
  if (candidate.hardFails.length || candidate.scores.speciesConfidence < 4) {
    throw new Error('An owner pick still needs the right plant (species confidence >= 4) and no hard fails');
  }
}

module.exports = { RUBRIC_VERSION, validateReview, verdictFor, validateWinner, validateOwnerPick, positiveInteger, diversify };
