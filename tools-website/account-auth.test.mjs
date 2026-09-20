import test from 'node:test';
import assert from 'node:assert/strict';
import {signToken, verifyToken, sessionAccount, sessionCookie, clearSessionCookie, accountForEmail, decodeIdToken, startOAuth, completeOAuth, readCookie} from './account-auth.mjs';

const SECRET = 'a-stable-session-secret-at-least-32-chars-long';
const b64url = obj => Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const idToken = claims => 'x.' + b64url(claims) + '.y';
const kvEnv = () => { const m = new Map(); return {INVITATIONS: {get: async k => m.get(k) ?? null, put: async (k,v) => { m.set(k,v); }}, _m: m}; };
const req = cookie => new Request('https://tools.l3v.ai/', {headers: cookie ? {Cookie: cookie} : {}});

test('a signed token round-trips, and tampering or expiry rejects it', async () => {
  const token = await signToken(SECRET, {accountId: 'a'.repeat(64), email: 'x@y.com'}, 60);
  const payload = await verifyToken(SECRET, token);
  assert.equal(payload.accountId, 'a'.repeat(64));
  assert.equal(await verifyToken('other-secret-32-chars-................', token), null, 'wrong secret rejected');
  assert.equal(await verifyToken(SECRET, token.slice(0, -2) + 'zz'), null, 'tampered signature rejected');
  assert.equal(await verifyToken(SECRET, await signToken(SECRET, {accountId: 'b'.repeat(64)}, -1)), null, 'expired rejected');
});

test('sessionAccount reads a valid session cookie and rejects a bad one', async () => {
  const env = {ACCOUNT_SESSION_SECRET: SECRET};
  const set = await sessionCookie(env, {accountId: 'c'.repeat(64), email: 'me@l3v.ai'});
  const value = set.split(';')[0].split('=').slice(1).join('=');
  const account = await sessionAccount(req('l3v_session=' + value), env);
  assert.equal(account.accountId, 'c'.repeat(64));
  assert.equal(account.email, 'me@l3v.ai');
  assert.equal(await sessionAccount(req('l3v_session=not-a-token'), env), null);
  assert.equal(await sessionAccount(req(''), env), null, 'no cookie, no account');
  assert.match(clearSessionCookie(), /Max-Age=0/);
});

test('an email maps to a stable 64-hex accountId, created once', async () => {
  const env = kvEnv();
  const first = await accountForEmail(env, 'buyer@example.com');
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(await accountForEmail(env, 'buyer@example.com'), first, 'same email, same account');
  assert.notEqual(await accountForEmail(env, 'other@example.com'), first, 'different email, different account');
});

test('decodeIdToken reads the claims payload', () => {
  assert.equal(decodeIdToken(idToken({email: 'A@B.com', email_verified: true})).email, 'A@B.com');
  assert.equal(decodeIdToken('not-a-jwt'), null);
});

test('startOAuth needs provider config and produces a PKCE authorize url + signed state', async () => {
  const bare = {ACCOUNT_SESSION_SECRET: SECRET};
  assert.equal(await startOAuth(bare, 'google', {origin: 'https://tools.l3v.ai'}), null, 'no client id, not configured');
  const env = {ACCOUNT_SESSION_SECRET: SECRET, GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'csecret'};
  const start = await startOAuth(env, 'google', {origin: 'https://tools.l3v.ai', returnTo: '/#assets'});
  assert.match(start.redirect, /accounts\.google\.com/);
  assert.match(start.redirect, /code_challenge_method=S256/);
  assert.match(start.redirect, /redirect_uri=https%3A%2F%2Ftools\.l3v\.ai%2Fapi%2Faccount%2Fcallback/);
  assert.match(start.setCookie, /^l3v_oauth=/);
});

test('completeOAuth rejects a mismatched state before any token exchange', async () => {
  const env = {ACCOUNT_SESSION_SECRET: SECRET, GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'csecret'};
  const start = await startOAuth(env, 'google', {origin: 'https://tools.l3v.ai'});
  const stateCookie = start.setCookie.split(';')[0].split('=').slice(1).join('=');
  const bad = await completeOAuth(env, {origin: 'https://tools.l3v.ai', code: 'x', state: 'wrong-nonce', stateCookie: decodeURIComponent(stateCookie)});
  assert.equal(bad.error, 'invalid-state');
});

test('supportedProviders lists only configured ones, and Apple needs its team and key ids', async () => {
  const {supportedProviders} = await import('./account-auth.mjs');
  assert.deepEqual(supportedProviders({ACCOUNT_SESSION_SECRET: SECRET}), []);
  const env = {ACCOUNT_SESSION_SECRET: SECRET, GOOGLE_CLIENT_ID: 'g', GOOGLE_CLIENT_SECRET: 's',
    APPLE_CLIENT_ID: 'com.l3v.web', APPLE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nMIG-----END PRIVATE KEY-----'};
  assert.deepEqual(supportedProviders(env), ['google'], 'apple without team/key id is not offered');
  env.APPLE_TEAM_ID = 'TEAM'; env.APPLE_KEY_ID = 'KEY';
  assert.deepEqual(supportedProviders(env).sort(), ['apple', 'google']);
});

test('apple sign-in uses form_post and a SameSite=None state cookie', async () => {
  const {startOAuth} = await import('./account-auth.mjs');
  const env = {ACCOUNT_SESSION_SECRET: SECRET, APPLE_CLIENT_ID: 'com.l3v.web', APPLE_TEAM_ID: 'T', APPLE_KEY_ID: 'K', APPLE_PRIVATE_KEY: 'x'};
  const start = await startOAuth(env, 'apple', {origin: 'https://tools.l3v.ai'});
  assert.match(start.redirect, /appleid\.apple\.com/);
  assert.match(start.redirect, /response_mode=form_post/);
  assert.match(start.setCookie, /SameSite=None/);
});
