// Studio's three videos, decided at the edge from server-side facts.
//
// Which previews become clips, whether a request may ask for another, and
// the record of which jobs were created live here. The jobs themselves are
// ordinary video jobs on the backend; the purchase record in KV remembers
// their ids so the bundle and the library can find them without a list
// endpoint.

import {PAID_PACKAGES} from './stripe-checkout.mjs';
import {MOTION_FRIENDLY, pickVideoSubjects} from './src/lib/video-picks.mjs';
export {MOTION_FRIENDLY, pickVideoSubjects};

export const VIDEO_SETTINGS = {duration: 5, resolution: '480p', audio: false};

/** How many clips a package includes. */
export function videosIncluded(packageId) {
  return PAID_PACKAGES[packageId]?.videos || 0;
}

/**
 * Whether a request may create another clip from `visualizationId`.
 * Asking again for a preview that already has a clip is answered with that
 * clip and never counts.
 */
export function gateVideo(purchase, visualizationId) {
  const included = purchase && !purchase.fulfilledAt ? videosIncluded(purchase.packageId) : 0;
  const existing = Array.isArray(purchase?.videos) ? purchase.videos : [];
  const same = existing.find(item => item.source === visualizationId);
  if (same) return {allowed: true, reason: 'existing', job: same, used: existing.length, allowance: included};
  if (!included) return {allowed: false, reason: 'no-video-package', used: existing.length, allowance: included};
  if (existing.length >= included) return {allowed: false, reason: 'videos-complete', used: existing.length, allowance: included};
  return {allowed: true, reason: 'within-allowance', used: existing.length, allowance: included};
}

const key = (requestId, mode) => `purchase:${mode}:${requestId}`;

/** Remember a created clip on the purchase record. Idempotent per source preview. */
export async function attachVideo(store, requestId, mode, {jobId, source}) {
  const raw = await store.get(key(requestId, mode));
  if (!raw) return null;
  let record;
  try { record = JSON.parse(raw); } catch { return null; }
  const videos = Array.isArray(record.videos) ? record.videos : [];
  if (!videos.some(item => item.source === source)) videos.push({jobId, source, createdAt: new Date().toISOString()});
  const updated = {...record, videos};
  await store.put(key(requestId, mode), JSON.stringify(updated));
  return updated;
}
