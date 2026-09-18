import test from 'node:test';
import assert from 'node:assert/strict';
import {recordRecent, listRecent, recentImage} from './recent-feed.mjs';

function fakeEnv() {
  const kv = new Map(), r2 = new Map();
  return {
    INVITATIONS: {get: async k => kv.get(k) ?? null, put: async (k, v) => { kv.set(k, v); }},
    IDENTITY_BUNDLES: {put: async (k, v, o) => { r2.set(k, {body: v, httpMetadata: o?.httpMetadata}); }, get: async k => r2.get(k) ?? null},
    _kv: kv, _r2: r2,
  };
}

test('a finished preview is remembered once, newest first, with its thumbnail stored', async () => {
  const env = fakeEnv();
  const png = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
  await recordRecent(env, {id: 'a'.repeat(32), bytes: png, contentType: 'image/png', template: 'baseball-cap'});
  await recordRecent(env, {id: 'a'.repeat(32), bytes: png, contentType: 'image/png', template: 'baseball-cap'});
  await recordRecent(env, {id: 'b'.repeat(32), bytes: new Uint8Array([255, 216, 255]), contentType: 'image/jpeg', template: 'delivery-van'});
  const listed = await listRecent(env, 12);
  assert.deepEqual(listed.map(i => i.template), ['delivery-van', 'baseball-cap']);
  assert.equal(listed[0].url, '/api/name-logo/recent-image?id=' + 'b'.repeat(32));
  assert.ok(env._r2.has('recent/' + 'a'.repeat(32) + '.png'));
  assert.ok(env._r2.has('recent/' + 'b'.repeat(32) + '.jpg'));
  assert.equal((await recentImage(env, 'b'.repeat(32))).httpMetadata.contentType, 'image/jpeg');
  assert.equal(await recentImage(env, 'c'.repeat(32)), null);
});

test('the list is capped and bad input is ignored', async () => {
  const env = fakeEnv();
  for (let i = 0; i < 60; i++) await recordRecent(env, {id: String(i).padStart(32, '0'), bytes: new Uint8Array([1]), contentType: 'image/png', template: 't'});
  assert.equal((await listRecent(env, 100)).length, 48);
  assert.equal(await recordRecent(env, {id: 'nope', bytes: new Uint8Array([1]), contentType: 'image/png', template: 't'}), null);
  assert.equal(await recordRecent(env, {id: 'e'.repeat(32), bytes: new Uint8Array(0), contentType: 'image/png', template: 't'}), null);
  assert.deepEqual(await listRecent({}), []);
});
