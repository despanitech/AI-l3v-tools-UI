// Stripe Checkout for the paid identity packages.
//
// Generation costs real provider money, so entitlement is recorded and read
// server side only. A browser saying "I came back from checkout" proves
// nothing; the webhook from Stripe is the only thing that grants access.

const API = 'https://api.stripe.com/v1';
const SIGNATURE_TOLERANCE_SECONDS = 300;
const PURCHASE_PREFIX = 'purchase:';

/** Paid packages, keyed as the UI knows them. Prices live in configuration. */
export const PAID_PACKAGES = {
  creator: {name: 'Creator set', images: 10, videos: 0},
  studio: {name: 'Signature studio', images: 30, videos: 3},
};

export const MODES = ['test', 'live'];

/**
 * Test and live Stripe accounts are entirely separate: different keys,
 * different products, different webhook secrets. Each mode is configured
 * independently and STRIPE_MODE selects which one is in force.
 *
 * Anything other than an explicit "live" means test, so a missing or
 * misspelled value cannot start charging real cards.
 */
export function stripeConfig(env) {
  const mode = env.STRIPE_MODE === 'live' ? 'live' : 'test';
  const suffix = mode === 'live' ? '_LIVE' : '_TEST';
  return {
    mode,
    secretKey: env['STRIPE_SECRET_KEY' + suffix] || '',
    webhookSecret: env['STRIPE_WEBHOOK_SECRET' + suffix] || '',
    products: {
      creator: env['STRIPE_PRICE_CREATOR' + suffix] || '',
      studio: env['STRIPE_PRICE_STUDIO' + suffix] || '',
    },
  };
}

/** Webhook secrets for every configured mode, so an event can be attributed. */
export function webhookSecrets(env) {
  return {
    test: env.STRIPE_WEBHOOK_SECRET_TEST || '',
    live: env.STRIPE_WEBHOOK_SECRET_LIVE || '',
  };
}

const form = params => {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined) body.set(key, String(value));
  return body;
};

/** Constant time, so a wrong signature cannot be narrowed down by timing. */
function equal(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

const hex = bytes => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}

// Configuration may name a price directly or a product whose default price
// should be used. Resolved ids are cached for the life of the isolate so a
// product lookup does not happen on every checkout.
const resolvedPrices = new Map();

export async function resolvePrice(secretKey, configured) {
  if (/^price_[A-Za-z0-9]+$/.test(configured)) return configured;
  if (!/^prod_[A-Za-z0-9]+$/.test(configured)) throw new Error('Configured value is neither a price nor a product id');
  const cached = resolvedPrices.get(configured);
  if (cached) return cached;
  const response = await fetch(`${API}/products/${encodeURIComponent(configured)}`, {
    headers: {Authorization: 'Bearer ' + secretKey},
    signal: AbortSignal.timeout(10000),
  });
  const payload = await response.json().catch(() => ({}));
  const price = typeof payload?.default_price === 'string' ? payload.default_price
    : typeof payload?.default_price?.id === 'string' ? payload.default_price.id : '';
  if (!response.ok || !price) throw new Error('Product has no default price: ' + configured);
  resolvedPrices.set(configured, price);
  return price;
}

export function checkoutReady(env) {
  const config = stripeConfig(env);
  return Boolean(config.secretKey && config.webhookSecret
    && config.products.creator && config.products.studio);
}

/**
 * Create a Checkout Session for one package.
 * requestId travels as client_reference_id and as metadata so the webhook can
 * tie the payment back to the identity request that should unlock.
 */
export async function createCheckoutSession(env, {requestId, packageId, origin}) {
  if (!PAID_PACKAGES[packageId]) throw new Error('Unknown package');
  const config = stripeConfig(env);
  const configured = config.products[packageId];
  if (!configured) throw new Error(`Package is not configured for ${config.mode} mode`);
  const price = await resolvePrice(config.secretKey, configured);
  const body = form({
    mode: 'payment',
    'line_items[0][price]': price,
    'line_items[0][quantity]': 1,
    client_reference_id: requestId,
    'metadata[requestId]': requestId,
    'metadata[packageId]': packageId,
    'metadata[mode]': config.mode,
    success_url: `${origin}/?purchase=complete#logo`,
    cancel_url: `${origin}/?purchase=cancelled#logo`,
  });

  // A double click must not create two sessions, so the first attempt uses a
  // key derived from the request. Stripe replays that response for 24 hours
  // though, so once the session is spent or expired the same dead url comes
  // back and the buyer lands on "You're all done here". A replayed session
  // that is no longer open is therefore discarded and asked for again under a
  // fresh key.
  const stable = `identity-${config.mode}-${requestId}-${packageId}`;
  let session = await postSession(config.secretKey, body, stable);
  if (session.status && session.status !== 'open') {
    session = await postSession(config.secretKey, body, `${stable}-${Date.now()}`);
  }
  if (!session.url) throw new Error('Stripe returned a session without a url');
  return {url: session.url, id: session.id, status: session.status || ''};
}

async function postSession(secretKey, body, idempotencyKey) {
  const response = await fetch(`${API}/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + secretKey,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': idempotencyKey,
    },
    body,
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.url) {
    // Stripe's message can name internal configuration; keep it out of the client.
    const reason = payload?.error?.code || payload?.error?.type || response.status;
    throw new Error('Stripe rejected the checkout session: ' + reason);
  }
  return payload;
}

/**
 * Verify a Stripe webhook signature header.
 * Returns the parsed event, or null when the signature or timestamp fails.
 */
export async function verifyWebhook(payload, header, secret, now = Date.now()) {
  if (!header || !secret) return null;
  const parts = Object.create(null);
  const versions = [];
  for (const piece of header.split(',')) {
    const [key, value] = piece.split('=');
    if (key === 'v1') versions.push(value);
    else if (key) parts[key] = value;
  }
  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp) || !versions.length) return null;
  // A replayed old payload keeps a valid signature forever without this.
  if (Math.abs(Math.floor(now / 1000) - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return null;

  const expected = await hmac(`${timestamp}.${payload}`, secret);
  if (!versions.some(candidate => equal(expected, candidate || ''))) return null;
  try { return JSON.parse(payload); } catch { return null; }
}

/**
 * Try every configured mode's secret and report which one signed the event.
 * Both endpoints post to the same URL, so attribution has to come from the
 * signature rather than from anything in the payload.
 */
export async function verifyWebhookForModes(payload, header, secrets, now = Date.now()) {
  for (const mode of MODES) {
    const secret = secrets?.[mode];
    if (!secret) continue;
    const event = await verifyWebhook(payload, header, secret, now);
    if (event) return {event, mode};
  }
  return null;
}

// Keyed by mode as well as request: test and live purchases are separate
// facts and must not overwrite one another in the shared namespace.
const purchaseKey = (requestId, mode) => `${PURCHASE_PREFIX}${mode}:${requestId}`;

/** Record a completed purchase. Called only after the signature verifies. */
export async function recordPurchase(store, session, mode = 'test') {
  const requestId = session?.metadata?.requestId || session?.client_reference_id || '';
  const packageId = session?.metadata?.packageId || '';
  if (!/^[a-f0-9]{32}$/.test(requestId) || !PAID_PACKAGES[packageId]) return null;
  if (session.payment_status !== 'paid') return null;
  const record = {
    packageId,
    mode: MODES.includes(mode) ? mode : 'test',
    sessionId: typeof session.id === 'string' ? session.id : '',
    amountTotal: Number.isFinite(session.amount_total) ? session.amount_total : null,
    currency: typeof session.currency === 'string' ? session.currency : '',
    paidAt: new Date().toISOString(),
  };
  await store.put(purchaseKey(requestId, record.mode), JSON.stringify(record));
  return {requestId, ...record};
}

/**
 * Mark a purchase delivered once its bundle is stored durably. The record is
 * kept rather than deleted, so the payment stays auditable, but it no longer
 * unlocks generation: one purchase buys one package, not an open allowance.
 */
export async function markFulfilled(store, requestId, mode = 'test') {
  const record = await purchaseFor(store, requestId, mode, {includeFulfilled: true});
  if (!record) return null;
  if (record.fulfilledAt) return record;
  const updated = {...record, fulfilledAt: new Date().toISOString()};
  await store.put(purchaseKey(requestId, mode), JSON.stringify(updated));
  return updated;
}

/** Record that the buyer took delivery. Never gates access; it is a receipt. */
export async function markDownloaded(store, requestId, mode = 'test') {
  // Delivery is when downloads happen, so the receipt must outlive fulfilment.
  const record = await purchaseFor(store, requestId, mode, {includeFulfilled: true});
  if (!record) return null;
  const updated = {...record, downloadedAt: record.downloadedAt || new Date().toISOString(),
    downloadCount: (Number(record.downloadCount) || 0) + 1};
  await store.put(purchaseKey(requestId, mode), JSON.stringify(updated));
  return updated;
}

/**
 * Forget a purchase so the flow can be exercised again. Test mode only - in
 * live mode a paid request must stay paid, so this refuses rather than
 * deleting a record someone was charged for.
 */
export async function clearPurchase(store, requestId, mode) {
  if (mode !== 'test') return false;
  if (!/^[a-f0-9]{32}$/.test(requestId || '')) return false;
  await store.delete(purchaseKey(requestId, 'test'));
  return true;
}

/** What a request has paid for, or null. Never derived from anything the client sends. */
export async function purchaseFor(store, requestId, mode = 'test', {includeFulfilled = false} = {}) {
  if (!/^[a-f0-9]{32}$/.test(requestId || '')) return null;
  const raw = await store.get(purchaseKey(requestId, mode));
  if (!raw) return null;
  try {
    const record = JSON.parse(raw);
    if (!PAID_PACKAGES[record?.packageId]) return null;
    // Checked again even though the key is scoped: a purchase made with a
    // test card must never unlock real generation.
    if (record.mode !== mode) return null;
    // A delivered purchase is still a receipt, but it no longer entitles.
    if (record.fulfilledAt && !includeFulfilled) return null;
    return record;
  } catch { return null; }
}
