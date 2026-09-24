const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ALLOWED_LICENSE, toCandidate, downloadFile } = require('../lib/wikimedia');

const page = (overrides = {}, meta = {}) => ({
  pageid: 42,
  title: 'File:Gasteria bicolor 1.jpg',
  imageinfo: [{
    mime: 'image/jpeg', width: 1200, height: 1500,
    url: 'https://upload.wikimedia.org/original.jpg',
    thumburl: 'https://upload.wikimedia.org/thumb/1280.jpg',
    descriptionurl: 'https://commons.wikimedia.org/wiki/File:Gasteria_bicolor_1.jpg',
    extmetadata: {
      LicenseShortName: { value: 'CC BY-SA 3.0' },
      Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:Someone">Some&nbsp;One</a>' },
      ...meta,
    },
    ...overrides,
  }],
});

test('license filter accepts free attribution licenses and rejects the rest', () => {
  for (const ok of ['CC0', 'Public domain', 'CC BY 2.0', 'CC BY-SA 4.0', 'Attribution']) assert.match(ok, ALLOWED_LICENSE);
  for (const bad of ['GFDL', 'CC BY-NC 2.0', 'Copyrighted free use', '']) assert.doesNotMatch(bad, ALLOWED_LICENSE);
});

test('candidates carry attribution and skip non-JPEG or unlicensed files', () => {
  const candidate = toCandidate(page(), '"Gasteria bicolor" filetype:bitmap');
  assert.equal(candidate.source, 'wikimedia');
  assert.equal(candidate.sourceId, 'wm-42');
  assert.equal(candidate.photographer, 'Some One');
  assert.equal(candidate.license, 'CC BY-SA 3.0');
  assert.equal(candidate.attributionRequired, true);
  assert.equal(candidate.downloadUrl, 'https://upload.wikimedia.org/thumb/1280.jpg');
  assert.equal(toCandidate(page({ mime: 'image/png' })), null);
  assert.equal(toCandidate(page({}, { LicenseShortName: { value: 'GFDL' } })), null);
});

test('a non-JPEG download never overwrites an existing candidate', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plant-image-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const destination = path.join(dir, 'candidate.jpg');
  fs.writeFileSync(destination, 'previous candidate');
  t.mock.method(global, 'fetch', async () => new Response('<html>Error</html>', { status: 200 }));
  await assert.rejects(downloadFile({ downloadUrl: 'https://example.test/image' }, destination), /JPEG/);
  assert.equal(fs.readFileSync(destination, 'utf8'), 'previous candidate');
});
