const test = require('node:test');
const assert = require('node:assert/strict');
const { parseBox } = require('../lib/image');

test('crop boxes must be whole pixels inside the image', () => {
  assert.deepEqual(parseBox('10, 20, 300, 400', { width: 1280, height: 960 }), { x: 10, y: 20, width: 300, height: 400 });
  assert.throws(() => parseBox('0,0,1281,10', { width: 1280, height: 960 }), /outside/);
  assert.throws(() => parseBox('0,900,100,61', { width: 1280, height: 960 }), /outside/);
  for (const bad of ['1,2,3', '-1,0,10,10', '0,0,0,10', '0,0,1.5,10', 'a,b,c,d']) assert.throws(() => parseBox(bad, { width: 100, height: 100 }));
});
