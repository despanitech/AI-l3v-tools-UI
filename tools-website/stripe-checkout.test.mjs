import assert from 'node:assert/strict';
import test from 'node:test';
import {createCheckoutSession, verifyWebhook, verifyWebhookForModes, recordPurchase, purchaseFor, checkoutReady, resolvePrice, stripeConfig, clearPurchase, markFulfilled} from './stripe-checkout.mjs';

const SECRET = 'whsec_test_secret';
const REQUEST = 'a'.repeat(32);

const env = extra => ({
  STRIPE_MODE: 'test',
  STRIPE_SECRET_KEY_TEST: 'sk_test_x', STRIPE_WEBHOOK_SECRET_TEST: SECRET,
  STRIPE_PRICE_CREATOR_TEST: 'price_creator', STRIPE_PRICE_STUDIO_TEST: 'price_studio', ...extra,
});

function store() {
  const map = new Map();
  return {map, get: async key => map.get(key) ?? null, put: async (key, value) => void map.set(key, value)};
}

const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
async function sign(payload, timestamp, secret = SECRET) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`)));
}

const session = (extra = {}) => ({
  id: 'cs_test_1', payment_status: 'paid', amount_total: 599, currency: 'usd',
  client_reference_id: REQUEST, metadata: {requestId: REQUEST, packageId: 'creator'}, ...extra,
});

test('a correctly signed event is accepted', async () => {
  const payload = JSON.stringify({type: 'checkout.session.completed'});
  const now = Date.now(), t = Math.floor(now / 1000);
  const event = await verifyWebhook(payload, `t=${t},v1=${await sign(payload, t)}`, SECRET, now);
  assert.equal(event.type, 'checkout.session.completed');
});

test('a forged signature is refused', async () => {
  const payload = JSON.stringify({type: 'checkout.session.completed'});
  const t = Math.floor(Date.now() / 1000);
  assert.equal(await verifyWebhook(payload, `t=${t},v1=${'0'.repeat(64)}`, SECRET), null);
});

test('a signature from a different secret is refused', async () => {
  const payload = JSON.stringify({type: 'checkout.session.completed'});
  const now = Date.now(), t = Math.floor(now / 1000);
  const header = `t=${t},v1=${await sign(payload, t, 'whsec_someone_else')}`;
  assert.equal(await verifyWebhook(payload, header, SECRET, now), null);
});

test('a replayed old event is refused even though its signature is valid', async () => {
  // Without the timestamp window a captured payload would unlock forever.
  const payload = JSON.stringify({type: 'checkout.session.completed'});
  const now = Date.now(), old = Math.floor(now / 1000) - 3600;
  const header = `t=${old},v1=${await sign(payload, old)}`;
  assert.equal(await verifyWebhook(payload, header, SECRET, now), null);
});

test('a tampered payload is refused', async () => {
  const original = JSON.stringify({type: 'checkout.session.completed', amount: 599});
  const now = Date.now(), t = Math.floor(now / 1000);
  const header = `t=${t},v1=${await sign(original, t)}`;
  const tampered = JSON.stringify({type: 'checkout.session.completed', amount: 1});
  assert.equal(await verifyWebhook(tampered, header, SECRET, now), null);
});

test('a missing header or secret is refused rather than throwing', async () => {
  assert.equal(await verifyWebhook('{}', null, SECRET), null);
  assert.equal(await verifyWebhook('{}', 't=1,v1=abc', ''), null);
  assert.equal(await verifyWebhook('{}', 'garbage', SECRET), null);
});

test('only a paid session is recorded', async () => {
  const kv = store();
  assert.equal(await recordPurchase(kv, session({payment_status: 'unpaid'}), 'test'), null);
  assert.equal(kv.map.size, 0);
  assert.ok(await recordPurchase(kv, session(), 'test'));
  assert.equal(kv.map.size, 1);
});

test('a session naming an unknown package or malformed request is ignored', async () => {
  const kv = store();
  assert.equal(await recordPurchase(kv, session({metadata: {requestId: REQUEST, packageId: 'free'}}), 'test'), null);
  assert.equal(await recordPurchase(kv, session({metadata: {requestId: 'nope', packageId: 'creator'}, client_reference_id: 'nope'}), 'test'), null);
  assert.equal(kv.map.size, 0);
});

test('a recorded purchase reads back for that request only', async () => {
  const kv = store();
  await recordPurchase(kv, session(), 'test');
  const found = await purchaseFor(kv, REQUEST, 'test');
  assert.equal(found.packageId, 'creator');
  assert.equal(found.amountTotal, 599);
  assert.equal(await purchaseFor(kv, 'b'.repeat(32), 'test'), null, 'another request is not entitled');
  assert.equal(await purchaseFor(kv, 'not-an-id', 'test'), null);
});

test('corrupt stored data does not grant entitlement', async () => {
  const kv = store();
  await kv.put('purchase:test:' + REQUEST, '{not json');
  assert.equal(await purchaseFor(kv, REQUEST, 'test'), null);
  await kv.put('purchase:test:' + REQUEST, JSON.stringify({packageId: 'free'}));
  assert.equal(await purchaseFor(kv, REQUEST, 'test'), null);
});

test('checkout is not offered until every Stripe value is configured', () => {
  assert.equal(checkoutReady(env()), true);
  assert.equal(checkoutReady(env({STRIPE_SECRET_KEY_TEST: ''})), false);
  assert.equal(checkoutReady(env({STRIPE_WEBHOOK_SECRET_TEST: ''})), false);
  assert.equal(checkoutReady(env({STRIPE_PRICE_STUDIO_TEST: ''})), false);
});

test('the session carries the request id so the webhook can tie payment to it', async () => {
  let sent;
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    sent = {url, options, body: new URLSearchParams(options.body)};
    return new Response(JSON.stringify({url: 'https://checkout.stripe.com/c/pay/cs_test', id: 'cs_test'}), {status: 200});
  };
  try {
    const result = await createCheckoutSession(env(), {requestId: REQUEST, packageId: 'creator', origin: 'https://tools.l3v.ai'});
    assert.equal(result.url, 'https://checkout.stripe.com/c/pay/cs_test');
    assert.equal(sent.body.get('client_reference_id'), REQUEST);
    assert.equal(sent.body.get('metadata[requestId]'), REQUEST);
    assert.equal(sent.body.get('metadata[packageId]'), 'creator');
    assert.equal(sent.body.get('line_items[0][price]'), 'price_creator');
    assert.equal(sent.body.get('mode'), 'payment');
    assert.match(sent.body.get('success_url'), /^https:\/\/tools\.l3v\.ai\//);
    assert.ok(sent.options.headers['Idempotency-Key'].includes(REQUEST), 'repeat clicks reuse one session');
  } finally { globalThis.fetch = original; }
});

test('a Stripe failure does not leak its message to the caller', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({error: {code: 'resource_missing', message: 'No such price: price_creator'}}), {status: 400});
  try {
    await assert.rejects(
      () => createCheckoutSession(env(), {requestId: REQUEST, packageId: 'creator', origin: 'https://tools.l3v.ai'}),
      error => !/No such price/.test(error.message));
  } finally { globalThis.fetch = original; }
});

test('an unknown package never reaches Stripe', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('must not be called'); };
  try {
    await assert.rejects(() => createCheckoutSession(env(), {requestId: REQUEST, packageId: 'free', origin: 'https://tools.l3v.ai'}));
  } finally { globalThis.fetch = original; }
});

test('a price id is used as given, without calling Stripe', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('must not be called'); };
  try { assert.equal(await resolvePrice('sk_test_x', 'price_abc123'), 'price_abc123'); }
  finally { globalThis.fetch = original; }
});

test('a product id resolves to its default price and is cached', async () => {
  // The Stripe dashboard shows product ids, so configuration accepts either.
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async url => {
    calls++;
    assert.match(String(url), /\/v1\/products\/prod_VGkF4LVYuX77ch$/);
    return new Response(JSON.stringify({id: 'prod_VGkF4LVYuX77ch', default_price: 'price_from_product'}), {status: 200});
  };
  try {
    assert.equal(await resolvePrice('sk_test_x', 'prod_VGkF4LVYuX77ch'), 'price_from_product');
    assert.equal(await resolvePrice('sk_test_x', 'prod_VGkF4LVYuX77ch'), 'price_from_product');
    assert.equal(calls, 1, 'second lookup is served from cache');
  } finally { globalThis.fetch = original; }
});

test('an expanded default price object is accepted', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({default_price: {id: 'price_expanded'}}), {status: 200});
  try { assert.equal(await resolvePrice('sk_test_x', 'prod_VGkCE5W13sNS4G'), 'price_expanded'); }
  finally { globalThis.fetch = original; }
});

test('a product with no default price fails loudly', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({id: 'prod_VGkNoDefault01', default_price: null}), {status: 200});
  try { await assert.rejects(() => resolvePrice(env(), 'prod_VGkNoDefault01'), /no default price/); }
  finally { globalThis.fetch = original; }
});

test('a configured value that is neither price nor product is refused', async () => {
  await assert.rejects(() => resolvePrice(env(), 'cus_wrong_kind'), /neither a price nor a product/);
  await assert.rejects(() => resolvePrice(env(), 'price_bad id'), /neither a price nor a product/);
});

test('mode defaults to test unless live is named exactly', () => {
  assert.equal(stripeConfig({}).mode, 'test');
  assert.equal(stripeConfig({STRIPE_MODE: 'LIVE'}).mode, 'test', 'case must match');
  assert.equal(stripeConfig({STRIPE_MODE: 'production'}).mode, 'test');
  assert.equal(stripeConfig({STRIPE_MODE: 'live'}).mode, 'live');
});

test('each mode reads its own keys and products', () => {
  const both = {
    STRIPE_SECRET_KEY_TEST: 'sk_test_x', STRIPE_SECRET_KEY_LIVE: 'sk_live_x',
    STRIPE_PRICE_CREATOR_TEST: 'prod_TestCreator01', STRIPE_PRICE_CREATOR_LIVE: 'prod_VGkCE5W13sNS4G',
  };
  assert.equal(stripeConfig({...both, STRIPE_MODE: 'test'}).secretKey, 'sk_test_x');
  assert.equal(stripeConfig({...both, STRIPE_MODE: 'live'}).secretKey, 'sk_live_x');
  assert.equal(stripeConfig({...both, STRIPE_MODE: 'live'}).products.creator, 'prod_VGkCE5W13sNS4G');
});

test('a test purchase does not unlock live generation', async () => {
  // The whole point of the toggle: a 4242 card must never buy real output.
  const kv = store();
  await recordPurchase(kv, session(), 'test');
  assert.ok(await purchaseFor(kv, REQUEST, 'test'));
  assert.equal(await purchaseFor(kv, REQUEST, 'live'), null);
});

test('a live purchase is not honoured while running in test mode', async () => {
  const kv = store();
  await recordPurchase(kv, session(), 'live');
  assert.equal(await purchaseFor(kv, REQUEST, 'test'), null);
});

test('an event is attributed to whichever mode signed it', async () => {
  const payload = JSON.stringify({type: 'checkout.session.completed'});
  const now = Date.now(), t = Math.floor(now / 1000);
  const secrets = {test: 'whsec_test_one', live: 'whsec_live_two'};
  const fromLive = `t=${t},v1=${await sign(payload, t, secrets.live)}`;
  assert.equal((await verifyWebhookForModes(payload, fromLive, secrets, now)).mode, 'live');
  const fromTest = `t=${t},v1=${await sign(payload, t, secrets.test)}`;
  assert.equal((await verifyWebhookForModes(payload, fromTest, secrets, now)).mode, 'test');
});

test('an event signed by neither secret is rejected', async () => {
  const payload = JSON.stringify({type: 'checkout.session.completed'});
  const now = Date.now(), t = Math.floor(now / 1000);
  const header = `t=${t},v1=${await sign(payload, t, 'whsec_unrelated')}`;
  assert.equal(await verifyWebhookForModes(payload, header, {test: 'whsec_a', live: 'whsec_b'}, now), null);
});

test('only the configured mode is tried when the other has no secret', async () => {
  const payload = JSON.stringify({type: 'checkout.session.completed'});
  const now = Date.now(), t = Math.floor(now / 1000);
  const header = `t=${t},v1=${await sign(payload, t, 'whsec_only_live')}`;
  const found = await verifyWebhookForModes(payload, header, {test: '', live: 'whsec_only_live'}, now);
  assert.equal(found.mode, 'live');
});

test('a test and a live purchase for one request coexist', async () => {
  // Both endpoints post to the same URL, so both records can exist at once.
  // Keyed only by request id, the second would have overwritten the first.
  const kv = store();
  await recordPurchase(kv, session({metadata: {requestId: REQUEST, packageId: 'creator'}}), 'test');
  await recordPurchase(kv, session({metadata: {requestId: REQUEST, packageId: 'studio'}}), 'live');
  assert.equal((await purchaseFor(kv, REQUEST, 'test')).packageId, 'creator');
  assert.equal((await purchaseFor(kv, REQUEST, 'live')).packageId, 'studio');
  assert.equal(kv.map.size, 2);
});

test('a test purchase can be cleared so the flow can be exercised again', async () => {
  const kv = store();
  kv.delete = async key => void kv.map.delete(key);
  await recordPurchase(kv, session(), 'test');
  assert.ok(await purchaseFor(kv, REQUEST, 'test'));
  assert.equal(await clearPurchase(kv, REQUEST, 'test'), true);
  assert.equal(await purchaseFor(kv, REQUEST, 'test'), null);
});

test('a live purchase is never cleared', async () => {
  // Someone was charged for it; forgetting it would hand back what they bought.
  const kv = store();
  kv.delete = async key => void kv.map.delete(key);
  await recordPurchase(kv, session(), 'live');
  assert.equal(await clearPurchase(kv, REQUEST, 'live'), false);
  assert.ok(await purchaseFor(kv, REQUEST, 'live'), 'live purchase survives');
});

test('clearing refuses a malformed request id', async () => {
  const kv = store();
  let deletes = 0;
  kv.delete = async () => { deletes++; };
  assert.equal(await clearPurchase(kv, 'not-an-id', 'test'), false);
  assert.equal(deletes, 0);
});

test('a delivered purchase stops entitling but is kept as a receipt', async () => {
  // One purchase buys one package. Without this the entitlement persisted and
  // the same payment could unlock generation again and again.
  const kv = store();
  await recordPurchase(kv, session(), 'test');
  assert.ok(await purchaseFor(kv, REQUEST, 'test'), 'entitles before delivery');
  const marked = await markFulfilled(kv, REQUEST, 'test');
  assert.ok(marked.fulfilledAt, 'delivery is recorded');
  assert.equal(await purchaseFor(kv, REQUEST, 'test'), null, 'no longer entitles');
  assert.ok(await purchaseFor(kv, REQUEST, 'test', {includeFulfilled: true}), 'record survives as a receipt');
});

test('marking delivery twice keeps the first timestamp', async () => {
  const kv = store();
  await recordPurchase(kv, session(), 'test');
  const first = await markFulfilled(kv, REQUEST, 'test');
  const second = await markFulfilled(kv, REQUEST, 'test');
  assert.equal(second.fulfilledAt, first.fulfilledAt);
});

test('delivery cannot be marked for a purchase that does not exist', async () => {
  const kv = store();
  assert.equal(await markFulfilled(kv, REQUEST, 'test'), null);
  assert.equal(kv.map.size, 0);
});

test('a replayed session that is no longer open is asked for again under a fresh key', async () => {
  const original = globalThis.fetch;
  const keys = [];
  globalThis.fetch = async (url, options) => {
    keys.push(options.headers['Idempotency-Key']);
    // Stripe replays a completed session for 24 hours under the same key, so
    // the first answer here is the dead one the buyer used to land on.
    const complete = keys.length === 1;
    return new Response(JSON.stringify({
      id: complete ? 'cs_test_spent' : 'cs_test_fresh',
      url: complete ? 'https://checkout.stripe.com/c/pay/cs_test_spent' : 'https://checkout.stripe.com/c/pay/cs_test_fresh',
      status: complete ? 'complete' : 'open',
    }), {status: 200});
  };
  try {
    const result = await createCheckoutSession(env(), {requestId: REQUEST, packageId: 'creator', origin: 'https://tools.l3v.ai'});
    assert.equal(keys.length, 2, 'the spent session is not handed to the buyer');
    assert.notEqual(keys[0], keys[1], 'the retry uses a different idempotency key');
    assert.equal(result.id, 'cs_test_fresh');
    assert.equal(result.url, 'https://checkout.stripe.com/c/pay/cs_test_fresh');
    assert.equal(result.status, 'open');
  } finally { globalThis.fetch = original; }
});

test('an open session is used as is, without a second create', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({id: 'cs_test_open', url: 'https://checkout.stripe.com/c/pay/cs_test_open', status: 'open'}), {status: 200});
  };
  try {
    const result = await createCheckoutSession(env(), {requestId: REQUEST, packageId: 'creator', origin: 'https://tools.l3v.ai'});
    assert.equal(calls, 1, 'repeat clicks still reuse one session');
    assert.equal(result.id, 'cs_test_open');
  } finally { globalThis.fetch = original; }
});
