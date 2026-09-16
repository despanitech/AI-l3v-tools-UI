// A stand-in for the private generation gateway, used in dev and uat.
//
// It answers the same actions with the same shapes, takes a little time the
// way real generation does, and hands back the John Smith sample images that
// already ship with the site. Nothing here calls a provider or the backend.
//
// State lives in R2 (strongly consistent) under simulated/<requestId>/..., so
// three concurrent preview jobs never lose each other's records and a list
// right after a write sees the write.

import {applicationSubjects, applicationPreviewImage} from './src/lib/application-templates.mjs';
import exampleLibrary from './src/lib/identity-example-library.json' with {type: 'json'};

const PREFIX = 'simulated/';
const DESIGN_MODES = ['logo', 'initials', 'signature'];
// Seconds after creation at which each design lands, in order. Real
// generation takes longer; this keeps the feel without the wait.
const DESIGN_DONE_AT = [6, 9, 12];
const QUEUED_FOR = 1.5;
const PREVIEW_MIN = 5, PREVIEW_SPREAD = 6;
const MAX_PREVIEWS = 40;

const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const id32 = () => hex(crypto.getRandomValues(new Uint8Array(16)));
const id64 = () => id32() + id32();
const valid32 = value => /^[a-f0-9]{32}$/.test(value || '');

function stage(createdAt, doneAt, now) {
  const elapsed = (now - createdAt) / 1000;
  if (elapsed < QUEUED_FOR) return 'queued';
  if (elapsed < doneAt) return 'running';
  return 'succeeded';
}

/** Deterministic 5-10s per preview, so a set finishes in staggered order. */
export function previewDoneAt(id) {
  let h = 0;
  for (const char of id) h = (h * 31 + char.charCodeAt(0)) >>> 0;
  return PREVIEW_MIN + (h % PREVIEW_SPREAD);
}

export function sampleForDesign(mode, styleId) {
  const pool = exampleLibrary.filter(item => item.category === mode);
  return pool.find(item => item.styleId === styleId) || pool[0] || null;
}

export function sampleForTemplate(template, mode) {
  const subject = applicationSubjects.find(item => item.id === template);
  return subject ? applicationPreviewImage(subject, mode) : null;
}

export function simulatedCatalog() {
  const seen = new Set();
  const styles = [];
  for (const item of exampleLibrary) {
    const key = item.category + ':' + item.styleId;
    if (seen.has(key)) continue;
    seen.add(key);
    styles.push({id: item.styleId, mode: item.category, name: item.styleName});
  }
  return {enabled: true, styles, visualizations: applicationSubjects.map(item => ({id: item.id, name: item.name}))};
}

const designsKey = requestId => `${PREFIX}${requestId}/designs.json`;
const previewKey = (requestId, id) => `${PREFIX}${requestId}/previews/${id}.json`;

async function readJson(store, key) {
  const object = await store.get(key);
  if (!object) return null;
  try { return JSON.parse(await object.text()); } catch { return null; }
}

async function readPreviews(store, requestId) {
  const listed = await store.list({prefix: `${PREFIX}${requestId}/previews/`, limit: 200});
  const records = await Promise.all((listed.objects || []).map(object => readJson(store, object.key)));
  return records.filter(Boolean).sort((a, b) => a.createdAt - b.createdAt);
}

const previewView = (record, now) => ({
  id: record.id, designId: record.designId, createdAt: record.createdAt,
  status: stage(record.createdAt, previewDoneAt(record.id), now),
  output: {template: record.template},
});

/**
 * Answer one gateway action. Returns {status, json} or {status, bytes}.
 * `assets` fetches a site path and resolves to bytes or null; `now` is
 * injectable so tests can move time.
 */
export async function simulate(store, assets, {action, payload = {}, now = Date.now()}) {
  const requestId = payload.access?.requestId;

  if (action === 'catalog') return {status: 200, json: simulatedCatalog()};

  if (action === 'generate') {
    if (!valid32(requestId)) return {status: 404, json: {error: 'Request not found'}};
    const existing = await readJson(store, designsKey(requestId));
    if (existing) return {status: 200, json: {id: existing.id}};
    const chosen = Array.isArray(payload.styles) ? payload.styles : DESIGN_MODES.map(mode => ({mode, id: payload.styleId}));
    const designs = DESIGN_MODES.map(mode => ({
      id: id32(), mode, styleId: chosen.find(style => style.mode === mode)?.id || '',
    }));
    const record = {id: id64(), createdAt: now, first: payload.first || '', last: payload.last || '', designs};
    await store.put(designsKey(requestId), JSON.stringify(record), {httpMetadata: {contentType: 'application/json'}});
    return {status: 200, json: {id: record.id}};
  }

  if (action === 'status') {
    const record = valid32(requestId) ? await readJson(store, designsKey(requestId)) : null;
    if (!record || record.id !== payload.id) return {status: 404, json: {error: 'Design not found'}};
    return {status: 200, json: {id: record.id, designs: record.designs.map((design, index) => ({
      id: design.id, mode: design.mode, styleId: design.styleId,
      status: stage(record.createdAt, DESIGN_DONE_AT[index] || DESIGN_DONE_AT.at(-1), now),
      output: {},
    }))}};
  }

  if (action === 'image') {
    if (payload.format === 'svg') return {status: 404, json: {error: 'No vector for a sample'}};
    const record = valid32(requestId) ? await readJson(store, designsKey(requestId)) : null;
    const index = record ? record.designs.findIndex(design => design.id === payload.id) : -1;
    if (index < 0 || stage(record.createdAt, DESIGN_DONE_AT[index] || DESIGN_DONE_AT.at(-1), now) !== 'succeeded') return {status: 404, json: {error: 'Design not found'}};
    const sample = sampleForDesign(record.designs[index].mode, record.designs[index].styleId);
    const bytes = sample ? await assets(sample.src) : null;
    return bytes ? {status: 200, bytes} : {status: 404, json: {error: 'Sample missing'}};
  }

  if (action === 'visualization-generate') {
    if (!valid32(requestId)) return {status: 404, json: {error: 'Request not found'}};
    if (!sampleForTemplate(payload.template)) return {status: 400, json: {error: 'Unknown template'}};
    const previews = await readPreviews(store, requestId);
    // Same design and template is the same work, as the real gateway treats it.
    const same = previews.find(item => item.designId === payload.designId && item.template === payload.template);
    if (same) return {status: 200, json: previewView(same, now)};
    if (previews.length >= MAX_PREVIEWS) return {status: 429, json: {error: 'Preview limit reached'}};
    const record = {id: id32(), createdAt: now, designId: payload.designId, template: payload.template};
    await store.put(previewKey(requestId, record.id), JSON.stringify(record), {httpMetadata: {contentType: 'application/json'}});
    return {status: 200, json: previewView(record, now)};
  }

  if (action === 'visualization-status') {
    const record = valid32(requestId) && valid32(payload.id) ? await readJson(store, previewKey(requestId, payload.id)) : null;
    if (!record) return {status: 404, json: {error: 'Visualization not found'}};
    return {status: 200, json: previewView(record, now)};
  }

  if (action === 'visualization-list') {
    if (!valid32(requestId)) return {status: 404, json: {error: 'Request not found'}};
    const previews = await readPreviews(store, requestId);
    return {status: 200, json: {visualizations: previews.map(record => previewView(record, now))}};
  }

  if (action === 'visualization-image') {
    const record = valid32(requestId) && valid32(payload.id) ? await readJson(store, previewKey(requestId, payload.id)) : null;
    if (!record || stage(record.createdAt, previewDoneAt(record.id), now) !== 'succeeded') return {status: 404, json: {error: 'Visualization not found'}};
    // The design this preview was made from decides which demo it shows.
    const designs = await readJson(store, designsKey(requestId));
    const mode = designs?.designs?.find(design => design.id === record.designId)?.mode;
    const bytes = await assets(sampleForTemplate(record.template, mode));
    return bytes ? {status: 200, bytes} : {status: 404, json: {error: 'Sample missing'}};
  }

  return {status: 404, json: {error: 'Not found'}};
}

/** Site assets as bytes, read from the Worker's own static files. */
export function siteAssets(env, origin) {
  return async path => {
    if (!path || !env?.ASSETS) return null;
    const response = await env.ASSETS.fetch(new Request(new URL(path, origin)));
    return response.ok ? new Uint8Array(await response.arrayBuffer()) : null;
  };
}

/** Same contract as the real gateway caller: parsed JSON or bytes, null when not ok. */
export function simulatedCaller(env, origin) {
  const assets = siteAssets(env, origin);
  return async (action, payload, binary = false) => {
    const result = await simulate(env.IDENTITY_BUNDLES, assets, {action, payload});
    if (result.status !== 200) return null;
    return binary ? result.bytes || null : result.json;
  };
}

/** The simulator's answer as a Response, so the Worker's pipeline is unchanged. */
export async function simulatedResponse(env, origin, action, payload) {
  const result = await simulate(env.IDENTITY_BUNDLES, siteAssets(env, origin), {action, payload});
  if (result.bytes) {
    const png = [137, 80, 78, 71].every((b, i) => result.bytes[i] === b);
    return new Response(result.bytes, {status: 200, headers: {'Content-Type': png ? 'image/png' : 'image/jpeg'}});
  }
  return Response.json(result.json, {status: result.status});
}
