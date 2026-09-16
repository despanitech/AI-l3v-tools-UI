import test from 'node:test';
import assert from 'node:assert/strict';
import {simulate, simulatedCatalog, sampleForDesign, sampleForTemplate, previewDoneAt} from './simulated-gateway.mjs';
import {appMode, simulated, paymentSimulated} from './app-mode.mjs';

const REQUEST = 'a'.repeat(32);
const access = {requestId: REQUEST, receipt: 'b'.repeat(64)};

// Strongly consistent in-memory stand-in for the R2 bucket.
function bucket() {
  const map = new Map();
  return {
    async put(key, value) { map.set(key, String(value)); },
    async get(key) { return map.has(key) ? {text: async () => map.get(key)} : null; },
    async list({prefix}) { return {objects: [...map.keys()].filter(key => key.startsWith(prefix)).map(key => ({key}))}; },
  };
}
const assets = async path => path ? new TextEncoder().encode('png:' + path) : null;

test('anything but an explicit dev or uat is production', () => {
  assert.equal(appMode({}), 'production');
  assert.equal(appMode({APP_MODE: 'prod'}), 'production');
  assert.equal(appMode({APP_MODE: 'DEV'}), 'dev');
  assert.equal(appMode({APP_MODE: ' uat '}), 'uat');
  assert.equal(appMode({APP_MODE: 'test'}), 'test');
  assert.equal(simulated('dev'), true);
  assert.equal(simulated('test'), true);
  assert.equal(simulated('uat'), false, 'uat generates for real');
  assert.equal(simulated('production'), false);
  assert.equal(paymentSimulated('dev'), true, 'dev has no Stripe');
  assert.equal(paymentSimulated('test'), false, 'test pays through Stripe test mode');
  assert.equal(paymentSimulated('uat'), false, 'uat pays through Stripe test mode');
});

test('the catalog offers every design mode from the sample library', () => {
  const catalog = simulatedCatalog();
  assert.equal(catalog.enabled, true);
  for (const mode of ['logo', 'initials', 'signature']) assert.ok(catalog.styles.some(style => style.mode === mode), mode);
  assert.ok(catalog.visualizations.some(item => item.id === 'upper-arm-tattoo'));
});

test('designs take time and land one after another', async () => {
  const store = bucket();
  const t0 = 1_000_000;
  const created = await simulate(store, assets, {action: 'generate', now: t0,
    payload: {access, first: 'John', last: 'Smith', styles: [{mode: 'logo', id: 'soft-angular'}, {mode: 'initials', id: 'woven-serif'}, {mode: 'signature', id: 'compact-autograph'}]}});
  assert.equal(created.status, 200);
  assert.match(created.json.id, /^[a-f0-9]{64}$/);

  const again = await simulate(store, assets, {action: 'generate', now: t0 + 500, payload: {access, first: 'John', last: 'Smith', styleId: 'x'}});
  assert.equal(again.json.id, created.json.id, 'a second generate for the same request is the same work');

  const at = async seconds => (await simulate(store, assets, {action: 'status', now: t0 + seconds * 1000, payload: {access, id: created.json.id}})).json.designs.map(d => d.status);
  assert.deepEqual(await at(0), ['queued', 'queued', 'queued']);
  assert.deepEqual(await at(3), ['running', 'running', 'running']);
  assert.deepEqual(await at(7), ['succeeded', 'running', 'running']);
  assert.deepEqual(await at(10), ['succeeded', 'succeeded', 'running']);
  assert.deepEqual(await at(13), ['succeeded', 'succeeded', 'succeeded']);

  const status = await simulate(store, assets, {action: 'status', now: t0 + 13000, payload: {access, id: created.json.id}});
  const logo = status.json.designs.find(d => d.mode === 'logo');
  assert.equal(logo.styleId, 'soft-angular');
  const early = await simulate(store, assets, {action: 'image', now: t0 + 1000, payload: {access, id: logo.id}});
  assert.equal(early.status, 404, 'no image before the design has landed');
  const image = await simulate(store, assets, {action: 'image', now: t0 + 13000, payload: {access, id: logo.id}});
  assert.equal(image.status, 200);
  assert.match(new TextDecoder().decode(image.bytes), /^png:\/review\/john-smith-34\/logo-01-soft-angular\.png$/);
  const vector = await simulate(store, assets, {action: 'image', now: t0 + 13000, payload: {access, id: logo.id, format: 'svg'}});
  assert.equal(vector.status, 404, 'samples have no vector');
});

test('a wrong request never sees another request\'s designs', async () => {
  const store = bucket();
  const created = await simulate(store, assets, {action: 'generate', payload: {access, styleId: 'x'}});
  const other = {requestId: 'c'.repeat(32), receipt: 'd'.repeat(64)};
  const status = await simulate(store, assets, {action: 'status', payload: {access: other, id: created.json.id}});
  assert.equal(status.status, 404);
});

test('previews are deduplicated, listed, and served once they land', async () => {
  const store = bucket();
  const t0 = 5_000_000;
  const design = 'e'.repeat(32);
  const first = await simulate(store, assets, {action: 'visualization-generate', now: t0, payload: {access, designId: design, template: 'upper-arm-tattoo'}});
  assert.equal(first.status, 200);
  assert.equal(first.json.status, 'queued');
  assert.equal(first.json.output.template, 'upper-arm-tattoo');
  const same = await simulate(store, assets, {action: 'visualization-generate', now: t0 + 100, payload: {access, designId: design, template: 'upper-arm-tattoo'}});
  assert.equal(same.json.id, first.json.id, 'same design and template is the same job');
  const second = await simulate(store, assets, {action: 'visualization-generate', now: t0, payload: {access, designId: design, template: 'candle-jar'}});
  assert.notEqual(second.json.id, first.json.id);

  const listed = await simulate(store, assets, {action: 'visualization-list', now: t0 + 20000, payload: {access}});
  assert.equal(listed.json.visualizations.length, 2);
  assert.ok(listed.json.visualizations.every(item => item.status === 'succeeded'));

  const doneAt = previewDoneAt(first.json.id);
  assert.ok(doneAt >= 5 && doneAt <= 10, 'a preview takes five to ten seconds');
  const before = await simulate(store, assets, {action: 'visualization-status', now: t0 + (doneAt - 1) * 1000, payload: {access, id: first.json.id}});
  assert.equal(before.json.status, 'running');
  const after = await simulate(store, assets, {action: 'visualization-status', now: t0 + doneAt * 1000, payload: {access, id: first.json.id}});
  assert.equal(after.json.status, 'succeeded');

  const tooEarly = await simulate(store, assets, {action: 'visualization-image', now: t0 + 1000, payload: {access, id: first.json.id}});
  assert.equal(tooEarly.status, 404);
  const image = await simulate(store, assets, {action: 'visualization-image', now: t0 + 20000, payload: {access, id: first.json.id}});
  assert.equal(image.status, 200);
  assert.match(new TextDecoder().decode(image.bytes), /^png:\/assets\/identity-subjects\/branded\/personal-john-smith-\d\.png$/);

  const unknown = await simulate(store, assets, {action: 'visualization-generate', payload: {access, designId: design, template: 'not-a-template'}});
  assert.equal(unknown.status, 400);
});

test('every template and design mode has a sample to serve', () => {
  assert.ok(sampleForTemplate('upper-arm-tattoo'));
  assert.ok(sampleForTemplate('city-bus'));
  assert.equal(sampleForTemplate('nope'), null);
  for (const mode of ['logo', 'initials', 'signature']) assert.ok(sampleForDesign(mode, 'unknown-style'), `${mode} falls back to a sample`);
  assert.equal(sampleForDesign('logo', 'soft-angular').styleId, 'soft-angular');
});
