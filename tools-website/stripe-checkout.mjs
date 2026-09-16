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
  creator: {priceVariable: 'STRIPE_PRICE_CREATOR', name: 'Creator set', images: 10},
  studio: {priceVariable: 'STRIPE_PRICE_STUDIO', name: 'Signature studio', images: 25},
};

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

export async function resolvePrice(env, configured) {
  if (/^price_[A-Za-z0-9]+$/.test(configured)) return configured;
  if (!/^prod_[A-Za-z0-9]+$/.test(configured)) throw new Error('Configured value is neither a price nor a product id');
  const cached = resolvedPrices.get(configured);
  if (cached) return cached;
  const response = await fetch(`${API}/products/${encodeURIComponent(configured)}`, {
    headers: {Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY},
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
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET
    && env.STRIPE_PRICE_CREATOR && env.STRIPE_PRICE_STUDIO);
}

/**
 * Create a Checkout Session for one package.
 * requestId travels as client_reference_id and as metadata so the webhook can
 * tie the payment back to the identity request that should unlock.
 */
export async function createCheckoutSession(env, {requestId, packageId, origin}) {
  const chosen = PAID_PACKAGES[packageId];
  if (!chosen) throw new Error('Unknown package');
  const configured = env[chosen.priceVariable];
  if (!configured) throw new Error('Package price is not configured');
  const price = await resolvePrice(env, configured);

  const response = await fetch(`${API}/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
      // Repeated clicks reuse one session rather than creating a new one each time.
      'Idempotency-Key': `identity-${requestId}-${packageId}`,
    },
    body: form({
      mode: 'payment',
      'line_items[0][price]': price,
      'line_items[0][quantity]': 1,
      client_reference_id: requestId,
      'metadata[requestId]': requestId,
      'metadata[packageId]': packageId,
      success_url: `${origin}/?purchase=complete#logo`,
      cancel_url: `${origin}/?purchase=cancelled#logo`,
    }),
    signal: AbortSignal.timeout(15000),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.url) {
    // Stripe's message can name internal configuration; keep it out of the client.
    const reason = payload?.error?.code || payload?.error?.type || response.status;
    throw new Error('Stripe rejected the checkout session: ' + reason);
  }
  return {url: payload.url, id: payload.id};
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

const purchaseKey = requestId => PURCHASE_PREFIX + requestId;

/** Record a completed purchase. Called only after the signature verifies. */
export async function recordPurchase(store, session) {
  const requestId = session?.metadata?.requestId || session?.client_reference_id || '';
  const packageId = session?.metadata?.packageId || '';
  if (!/^[a-f0-9]{32}$/.test(requestId) || !PAID_PACKAGES[packageId]) return null;
  if (session.payment_status !== 'paid') return null;
  const record = {
    packageId,
    sessionId: typeof session.id === 'string' ? session.id : '',
    amountTotal: Number.isFinite(session.amount_total) ? session.amount_total : null,
    currency: typeof session.currency === 'string' ? session.currency : '',
    paidAt: new Date().toISOString(),
  };
  await store.put(purchaseKey(requestId), JSON.stringify(record));
  return {requestId, ...record};
}

/** What a request has paid for, or null. Never derived from anything the client sends. */
export async function purchaseFor(store, requestId) {
  if (!/^[a-f0-9]{32}$/.test(requestId || '')) return null;
  const raw = await store.get(purchaseKey(requestId));
  if (!raw) return null;
  try {
    const record = JSON.parse(raw);
    return PAID_PACKAGES[record?.packageId] ? record : null;
  } catch { return null; }
}
