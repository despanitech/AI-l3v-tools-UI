// Durable storage for generated bundles.
//
// Generated images live in the gateway's queue and age out with it, so a
// bundle assembled from them inherits that expiry - a purchase disappears
// after the retention window. Bundles are therefore built once and kept in
// R2, which has no relationship to the queue's lifetime.

import {zip, safeEntryName} from './src/lib/zip.mjs';

const KEY_PREFIX = 'bundles/';
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_IMAGES = 40;

const valid = value => /^[a-f0-9]{32,64}$/.test(value || '');

/** Scoped by account so one invitation can never read another's bundles. */
export function bundleKey(accountId, requestId) {
  return `${KEY_PREFIX}${accountId}/${requestId}.zip`;
}

/**
 * Fetch the request's finished visualizations from the gateway and store one
 * zip. Returns null when the request has nothing to bundle.
 */
export async function buildBundle(env, {accountId, requestId, receipt, name, gateway}) {
  if (!valid(accountId) || !valid(requestId)) return null;

  const listed = await gateway('visualization-list', {access: {requestId, receipt}});
  const ready = (listed?.visualizations || [])
    .filter(item => item.status === 'succeeded' && item.output?.template)
    .slice(0, MAX_IMAGES);
  if (!ready.length) return null;

  const files = [];
  for (const [index, item] of ready.entries()) {
    const bytes = await gateway('visualization-image', {access: {requestId, receipt}, id: item.id}, true);
    if (!bytes || bytes.length > MAX_IMAGE_BYTES) continue;
    files.push({name: safeEntryName(item.output.template, index), bytes});
  }
  if (!files.length) return null;

  const blob = zip(files);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const key = bundleKey(accountId, requestId);
  await env.IDENTITY_BUNDLES.put(key, bytes, {
    httpMetadata: {contentType: 'application/zip'},
    // Read back on listing, so the library needs no second store.
    customMetadata: {
      requestId,
      name: String(name || '').slice(0, 80),
      count: String(files.length),
      createdAt: new Date().toISOString(),
    },
  });
  return {key, count: files.length, bytes: bytes.length};
}

/** Every bundle for one account, newest first. */
export async function listBundles(env, accountId) {
  if (!valid(accountId)) return [];
  // R2 omits customMetadata from a listing unless it is asked for, so without
  // include the name and image count come back empty on every row.
  const listed = await env.IDENTITY_BUNDLES.list({
    prefix: `${KEY_PREFIX}${accountId}/`, limit: 200, include: ['customMetadata'],
  });
  return (listed.objects || [])
    .map(object => ({
      requestId: object.customMetadata?.requestId || object.key.split('/').pop().replace(/\.zip$/, ''),
      name: object.customMetadata?.name || '',
      count: Number(object.customMetadata?.count) || 0,
      createdAt: object.customMetadata?.createdAt || object.uploaded,
      size: object.size,
    }))
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
}

/** The stored object, or null. Never reachable across accounts. */
export async function getBundle(env, accountId, requestId) {
  if (!valid(accountId) || !valid(requestId)) return null;
  return env.IDENTITY_BUNDLES.get(bundleKey(accountId, requestId));
}
