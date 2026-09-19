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
export function gateVideo(purchase, visualizationId, designMode = '') {
  const included = purchase && !purchase.fulfilledAt ? videosIncluded(purchase.packageId) : 0;
  const existing = Array.isArray(purchase?.videos) ? purchase.videos : [];
  // The allowance is one clip per design, not one per source image. A design's
  // slot is counted by its designMode (older entries fall back to source), so
  // re-picking a design's clip to a different product replaces its slot instead
  // of consuming a second one and starving the other design.
  const designKey = item => item.designMode || item.source;
  const used = new Set(existing.map(designKey)).size;
  const same = existing.find(item => item.source === visualizationId);
  if (same) return {allowed: true, reason: 'existing', job: same, used, allowance: included};
  const sameDesign = designMode && existing.find(item => item.designMode === designMode);
  if (sameDesign) return {allowed: true, reason: 'replace-design', job: sameDesign, used, allowance: included};
  if (!included) return {allowed: false, reason: 'no-video-package', used, allowance: included};
  if (used >= included) return {allowed: false, reason: 'videos-complete', used, allowance: included};
  return {allowed: true, reason: 'within-allowance', used, allowance: included};
}

const key = (requestId, mode) => `purchase:${mode}:${requestId}`;

/** Remember a created clip on the purchase record: one entry per source preview,
 * so a retried clip replaces the failed one instead of using up the allowance. */
export async function attachVideo(store, requestId, mode, {jobId, source, designMode = ''}, attempts = 3) {
  let updated = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const raw = await store.get(key(requestId, mode));
    if (!raw) return null;
    let record;
    try { record = JSON.parse(raw); } catch { return null; }
    const videos = Array.isArray(record.videos) ? record.videos : [];
    // One entry per design: a re-pick for the same design replaces its entry
    // (freeing the old source's slot) instead of adding a second one.
    const index = designMode ? videos.findIndex(item => item.designMode === designMode)
                             : videos.findIndex(item => item.source === source);
    if (index < 0) videos.push({jobId, source, designMode, createdAt: new Date().toISOString()});
    else if (videos[index].jobId !== jobId) videos[index] = {jobId, source, designMode, createdAt: new Date().toISOString(), replaced: videos[index].jobId};
    updated = {...record, videos};
    await store.put(key(requestId, mode), JSON.stringify(updated));
    // The three clips start within the same second, and KV has no compare-and-set:
    // another clip's write can land on top of this one and drop it. Read back; if
    // this entry is gone, merge into whatever is there now and write again.
    let after = null;
    try { after = JSON.parse(await store.get(key(requestId, mode)) || 'null'); } catch { after = null; }
    if (Array.isArray(after?.videos) && after.videos.some(item => item.source === source && item.jobId === jobId)) return after;
  }
  return updated;
}
