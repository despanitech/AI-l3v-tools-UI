// The shared "latest generations" feed: the newest real previews across every
// visitor, kept for good. A thumbnail copy of each image lives in R2 under
// recent/<id>, the rolling list (newest first) in KV, so the rail on every
// page shows the same thing and never resets.

const LIST_KEY = 'recent-visualizations';
const KEY_PREFIX = 'recent/';
const KEEP = 48;
const MAX_BYTES = 4 * 1024 * 1024;

const validId = id => /^[a-f0-9]{32}$/.test(id || '');

async function readList(env) {
  try { const raw = await env.INVITATIONS.get(LIST_KEY); const list = raw ? JSON.parse(raw) : []; return Array.isArray(list) ? list : []; }
  catch { return []; }
}

/** Remember a finished preview. Idempotent per id; the newest is first. */
export async function recordRecent(env, {id, bytes, contentType, template}) {
  if (!env?.IDENTITY_BUNDLES || !env?.INVITATIONS || !validId(id) || !bytes?.length || bytes.length > MAX_BYTES) return null;
  const list = await readList(env);
  if (list.some(item => item.id === id)) return list;
  const type = contentType === 'image/jpeg' ? 'image/jpeg' : 'image/png';
  await env.IDENTITY_BUNDLES.put(KEY_PREFIX + id + (type === 'image/jpeg' ? '.jpg' : '.png'), bytes, {httpMetadata: {contentType: type}});
  const entry = {id, template: /^[a-z0-9-]{1,64}$/.test(template || '') ? template : '', type, at: new Date().toISOString()};
  const next = [entry, ...list].slice(0, KEEP);
  await env.INVITATIONS.put(LIST_KEY, JSON.stringify(next));
  return next;
}

/** The newest entries with the URL the page loads each image from. */
export async function listRecent(env, limit = 12) {
  if (!env?.INVITATIONS) return [];
  const list = await readList(env);
  return list.slice(0, limit).map(item => ({id: item.id, template: item.template || '', at: item.at, url: '/api/name-logo/recent-image?id=' + item.id}));
}

/** The stored thumbnail, or null. */
export async function recentImage(env, id) {
  if (!env?.IDENTITY_BUNDLES || !validId(id)) return null;
  const list = await readList(env);
  const entry = list.find(item => item.id === id);
  if (!entry) return null;
  return env.IDENTITY_BUNDLES.get(KEY_PREFIX + id + (entry.type === 'image/jpeg' ? '.jpg' : '.png'));
}
