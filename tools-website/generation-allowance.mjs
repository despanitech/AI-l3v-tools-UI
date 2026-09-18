// What a request may generate, decided at the edge from server-side facts.
//
// Hiding the Generate button is not a gate: the endpoint could be called
// directly and every image costs provider money. Every request gets the nine
// automatic previews; anything beyond that needs an undelivered purchase, and
// then only up to the package's image count. Once the purchase is delivered
// the allowance falls back to the included nine, in line with one purchase
// buying one identity.

import {PAID_PACKAGES} from './stripe-checkout.mjs';

/** The automatic previews every identity gets on step 3. */
export const INCLUDED_PREVIEWS = 5;

export function allowanceFor(purchase) {
  const paid = purchase && !purchase.fulfilledAt ? PAID_PACKAGES[purchase.packageId]?.images || 0 : 0;
  return INCLUDED_PREVIEWS + paid;
}

/**
 * Decide one visualization-generate call.
 * `existing` is the request's current visualization list from the gateway.
 * Returns {allowed, reason, used, allowance}.
 */
export function gateVisualization(existing, purchase, {designId, template}) {
  const list = Array.isArray(existing) ? existing : [];
  // The same design and template is the same job at the gateway; asking for
  // it again creates nothing, so it never counts against the allowance.
  const same = list.some(item => item?.output?.sourceDesignId === designId && item?.output?.template === template)
    || list.some(item => item?.designId === designId && item?.output?.template === template);
  // Failed jobs did not produce an image and are not charged again on retry.
  const used = list.filter(item => item && item.status !== 'failed').length;
  const allowance = allowanceFor(purchase);
  if (same) return {allowed: true, reason: 'existing', used, allowance};
  if (used >= allowance) {
    return {allowed: false, used, allowance,
      reason: purchase && !purchase.fulfilledAt ? 'package-complete' : 'included-used'};
  }
  return {allowed: true, reason: 'within-allowance', used, allowance};
}
