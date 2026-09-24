const test = require('node:test');
const assert = require('node:assert/strict');
const { verdictFor, validateWinner, positiveInteger, diversify } = require('../lib/review');
const review = (score = 4) => ({ hardFails: [], note: 'Visible habit and legible crop', scores: {
  subjectIsolation: score, speciesConfidence: score, framing: score, thumbnailLegibility: score, catalogFit: score,
} });

test('scores determine verdict and incomplete reviews fail closed', () => {
  assert.equal(verdictFor(review()), 'keep');
  assert.equal(verdictFor({ ...review(), hardFails: ['wrong-species'] }), 'replace');
  assert.throws(() => verdictFor({ scores: {} }));
  assert.throws(() => verdictFor(review(6)));
});
test('winning requires a meaningful improvement and sufficient identity confidence', () => {
  assert.throws(() => validateWinner(review(), review()));
  assert.doesNotThrow(() => validateWinner(review(3), review(4)));
  const uncertain = review(5); uncertain.scores.speciesConfidence = 3;
  assert.throws(() => validateWinner(review(3), uncertain));
});
test('shortlist is diverse, unique, and metadata does not hard-reject candidates', () => {
  const photo = (id, description = '') => ({ unsplashId: id, description });
  const result = diversify([[photo('macro', 'leaf close-up'), photo('pot', 'potted plant')], [photo('pot'), photo('other')]], 3);
  assert.deepEqual(result.map((item) => item.unsplashId), ['pot', 'other', 'macro']);
});
test('bad batch sizes cannot cause infinite loops', () => {
  for (const value of [0, -1, 'no', 1.5, Infinity, true]) assert.throws(() => positiveInteger(value, 8));
  assert.equal(positiveInteger('8', 4), 8);
});
test('a correct plant replaces a wrong-species image without the 4.0 average', () => {
  const wrongPlant = { ...review(2), hardFails: ['wrong-species'] };
  const correctButPlain = review(3); correctButPlain.scores.speciesConfidence = 4;
  assert.doesNotThrow(() => validateWinner(wrongPlant, correctButPlain));
  // Other hard fails keep the full bar.
  assert.throws(() => validateWinner({ ...review(2), hardFails: ['room-scene'] }, correctButPlain));
  // Identity must still be confident, and no score may be weak.
  const unsure = review(4); unsure.scores.speciesConfidence = 3;
  assert.throws(() => validateWinner(wrongPlant, unsure));
  const weak = review(4); weak.scores.framing = 2;
  assert.throws(() => validateWinner(wrongPlant, weak));
  assert.throws(() => validateWinner(wrongPlant, { ...review(5), hardFails: ['collection'] }));
});
test('shortlist dedupes candidates from any provider', () => {
  const result = diversify([[{ sourceId: 'wm-1' }, { sourceId: 'wm-2' }], [{ sourceId: 'wm-1' }]], 3);
  assert.deepEqual(result.map((item) => item.sourceId), ['wm-1', 'wm-2']);
});
