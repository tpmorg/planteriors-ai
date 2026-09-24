const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { downloadPhoto, reportDownload, searchPhotos, imageUrl } = require('../lib/unsplash');

test('resized URL retains attribution parameters and replaces existing width', () => {
  const url = new URL(imageUrl('https://images.unsplash.com/example?ixid=credit&w=300'));
  assert.equal(url.searchParams.get('ixid'), 'credit');
  assert.deepEqual(url.searchParams.getAll('w'), ['1200']);
});

test('a failed image response never overwrites an existing candidate', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plant-image-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const destination = path.join(dir, 'candidate.jpg');
  fs.writeFileSync(destination, 'previous candidate');
  t.mock.method(global, 'fetch', async () => new Response('<html>Error</html>', { status: 200 }));
  await assert.rejects(downloadPhoto({ downloadUrl: 'https://example.test/image' }, destination), /JPEG/);
  assert.equal(fs.readFileSync(destination, 'utf8'), 'previous candidate');
});

test('download tracking reports HTTP failures rather than claiming success', async (t) => {
  const oldKey = process.env.UNSPLASH_ACCESS_KEY;
  process.env.UNSPLASH_ACCESS_KEY = 'offline-test';
  t.after(() => { if (oldKey === undefined) delete process.env.UNSPLASH_ACCESS_KEY; else process.env.UNSPLASH_ACCESS_KEY = oldKey; });
  t.mock.method(global, 'fetch', async () => new Response('', { status: 403 }));
  assert.equal(await reportDownload({ downloadLocation: 'https://api.unsplash.com/test' }), false);
  await assert.rejects(searchPhotos('offline-permission-test'), (error) => !error.rateLimited && /403/.test(error.message));
});
