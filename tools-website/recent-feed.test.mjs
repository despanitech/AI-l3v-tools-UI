import test from 'node:test';
import assert from 'node:assert/strict';
import {recordRecent, listRecent, recentImage} from './recent-feed.mjs';

function fakeEnv() {
  const kv = new Map(), r2 = new Map();
  return {
    INVITATIONS: {get: async k => kv.get(k) ?? null, put: async (k, v) => { kv.set(k, v); }},
    IDENTITY_BUNDLES: {put: async (k, v, o) => { r2.set(k, {body: v, httpMetadata: o?.httpMetadata}); }, get: async k => r2.get(k) ?? null, delete: async k => { r2.delete(k); }},
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

import {recordRecentClip, listRecentClips, recentClip} from './recent-feed.mjs';

test('the clip feed keeps the newest 20, rotates the oldest out, and dedupes', async () => {
  const env = fakeEnv();
  const mp4 = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]);
  for (let i = 0; i < 25; i++) await recordRecentClip(env, {id: String(i).padStart(32, '0'), bytes: mp4, template: 'delivery-van'});
  const listed = await listRecentClips(env, 50);
  assert.equal(listed.length, 20, 'capped at 20');
  assert.equal(listed[0].id, '00000000000000000000000000000024', 'newest first');
  assert.equal(listed[0].url, '/api/name-logo/recent-clip?id=00000000000000000000000000000024');
  assert.ok(await recentClip(env, '00000000000000000000000000000024'), 'newest clip stored');
  assert.equal(await recentClip(env, '00000000000000000000000000000000'), null, 'oldest rotated out of R2');
  const before = (await listRecentClips(env)).length;
  await recordRecentClip(env, {id: '00000000000000000000000000000024', bytes: mp4, template: 'delivery-van'});
  assert.equal((await listRecentClips(env)).length, before, 'same clip is not added twice');
  assert.equal(await recordRecentClip(env, {id: 'nope', bytes: mp4, template: 't'}), null, 'bad id ignored');
});
