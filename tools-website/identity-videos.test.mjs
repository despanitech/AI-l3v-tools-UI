import test from 'node:test';
import assert from 'node:assert/strict';
import {pickVideoSubjects, gateVideo, attachVideo, videosIncluded, VIDEO_SETTINGS, MOTION_FRIENDLY} from './identity-videos.mjs';

test('studio includes two clips, creator none, at five seconds 480p without audio', () => {
  assert.equal(videosIncluded('studio'), 2);
  assert.equal(videosIncluded('creator'), 0);
  assert.equal(videosIncluded('free'), 0);
  assert.deepEqual(VIDEO_SETTINGS, {duration: 5, resolution: '480p', audio: false});
});

test('motion-friendly scenes are chosen first, then whatever finished', () => {
  const items = [{id: 'business-card'}, {id: 'upper-arm-tattoo'}, {id: 'city-bus'}, {id: 'candle-jar'}, {id: 'hot-air-balloon'}, {id: 'boat-sail'}];
  assert.deepEqual(pickVideoSubjects(items).map(item => item.id), ['hot-air-balloon', 'boat-sail', 'city-bus']);
  assert.deepEqual(pickVideoSubjects([{id: 'business-card'}, {id: 'letterhead'}]).map(item => item.id), ['business-card', 'letterhead'], 'fewer than three still works');
  assert.deepEqual(pickVideoSubjects(null), []);
  assert.ok(MOTION_FRIENDLY.every(id => /^[a-z-]+$/.test(id)));
});

test('the gate follows the purchase: studio gets three, delivered gets none, a repeat is free', () => {
  const viz = 'a'.repeat(32);
  assert.equal(gateVideo(null, viz).reason, 'no-video-package');
  assert.equal(gateVideo({packageId: 'creator'}, viz).reason, 'no-video-package');
  const studio = {packageId: 'studio', videos: []};
  assert.equal(gateVideo(studio, viz).allowed, true);
  const full = {packageId: 'studio', videos: [{source: 'b'.repeat(32), jobId: '1'}, {source: 'c'.repeat(32), jobId: '2'}, {source: 'd'.repeat(32), jobId: '3'}]};
  assert.equal(gateVideo(full, viz).reason, 'videos-complete');
  const repeat = gateVideo(full, 'c'.repeat(32));
  assert.equal(repeat.allowed, true);
  assert.equal(repeat.reason, 'existing');
  assert.equal(repeat.job.jobId, '2');
  assert.equal(gateVideo({packageId: 'studio', videos: [], fulfilledAt: 'now'}, viz).reason, 'no-video-package', 'delivered entitles nothing');
});

test('clips are remembered on the purchase record once per preview', async () => {
  const map = new Map([['purchase:test:' + 'a'.repeat(32), JSON.stringify({packageId: 'studio', paidAt: 'now'})]]);
  const store = {get: async k => map.get(k) ?? null, put: async (k, v) => { map.set(k, v); }};
  const first = await attachVideo(store, 'a'.repeat(32), 'test', {jobId: 'j1', source: 's1'});
  assert.equal(first.videos.length, 1);
  await attachVideo(store, 'a'.repeat(32), 'test', {jobId: 'j1', source: 's1'});
  const second = await attachVideo(store, 'a'.repeat(32), 'test', {jobId: 'j2', source: 's2'});
  assert.deepEqual(second.videos.map(v => v.jobId), ['j1', 'j2'], 'same source and job is not attached twice');
  assert.equal(second.packageId, 'studio', 'the rest of the record is kept');
  assert.equal(await attachVideo(store, 'b'.repeat(32), 'test', {jobId: 'x', source: 'y'}), null, 'no purchase, nothing to attach to');
});

test('a retried clip replaces the failed entry for the same preview', async () => {
  const data = new Map([['purchase:test:' + 'a'.repeat(32), JSON.stringify({packageId: 'studio', videos: [{jobId: 'old', source: 'v1'}]})]]);
  const store = {get: async k => data.get(k) ?? null, put: async (k, v) => {data.set(k, v)}};
  const same = await attachVideo(store, 'a'.repeat(32), 'test', {jobId: 'old', source: 'v1'});
  assert.equal(same.videos.length, 1);
  const replaced = await attachVideo(store, 'a'.repeat(32), 'test', {jobId: 'new', source: 'v1'});
  assert.equal(replaced.videos.length, 1);
  assert.equal(replaced.videos[0].jobId, 'new');
  assert.equal(replaced.videos[0].replaced, 'old');
  assert.equal(gateVideo(replaced, 'v1').job.jobId, 'new');
});

test('a clip write that another clip overwrote is merged and written again', async () => {
  // A store where the first put is lost to a concurrent write of the same record.
  const data = new Map([['purchase:test:' + 'a'.repeat(32), JSON.stringify({packageId: 'studio', videos: [{jobId: 'j-other', source: 'other'}]})]]);
  let puts = 0;
  const store = {get: async k => data.get(k) ?? null, put: async (k, v) => { puts++; if (puts === 1) return; data.set(k, v); }};
  const result = await attachVideo(store, 'a'.repeat(32), 'test', {jobId: 'j-mine', source: 'mine'});
  assert.equal(puts, 2, 'written again after the read-back showed the entry missing');
  assert.deepEqual(result.videos.map(v => v.source).sort(), ['mine', 'other']);
  assert.deepEqual(JSON.parse(data.get('purchase:test:' + 'a'.repeat(32))).videos.map(v => v.source).sort(), ['mine', 'other'], 'the stored record has both');
});

test('three clips attached back to back all survive', async () => {
  const data = new Map([['purchase:test:' + 'b'.repeat(32), JSON.stringify({packageId: 'studio'})]]);
  const store = {get: async k => data.get(k) ?? null, put: async (k, v) => { data.set(k, v); }};
  for (const [jobId, source] of [['j1', 's1'], ['j2', 's2'], ['j3', 's3']]) await attachVideo(store, 'b'.repeat(32), 'test', {jobId, source});
  assert.deepEqual(JSON.parse(data.get('purchase:test:' + 'b'.repeat(32))).videos.map(v => v.jobId), ['j1', 'j2', 'j3']);
});
