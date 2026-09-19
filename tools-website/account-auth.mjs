// Account sign-in for the public product: OAuth (Authorization Code + PKCE) that
// resolves a verified email to the same 64-hex accountId the rest of the system
// uses, and a stateless signed session cookie the Worker reads like it reads the
// invitation. The id token is taken directly from the provider's token endpoint
// over the server-to-server TLS exchange, so its payload is trusted without a
// separate JWKS signature check (the standard approach for the code flow).

const enc = new TextEncoder();
const dec = new TextDecoder();

const b64urlFromBytes = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlFromString = value => b64urlFromBytes(enc.encode(value));
function bytesFromB64url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
const stringFromB64url = value => dec.decode(bytesFromB64url(value));

const sha256hex = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(value))), b => b.toString(16).padStart(2, '0')).join('');

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign', 'verify']);
}
async function sign(secret, data) {
  return b64urlFromBytes(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(data)));
}
// Constant-time-ish compare (the HMAC over attacker-unknown secret is the real guard).
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/** A stateless signed token: base64url(JSON payload).signature, with an exp check. */
export async function signToken(secret, payload, ttlSeconds) {
  if (!secret) throw new Error('Missing signing secret');
  const body = {...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds};
  const encoded = b64urlFromString(JSON.stringify(body));
  return encoded + '.' + await sign(secret, encoded);
}
export async function verifyToken(secret, token) {
  if (!secret || typeof token !== 'string' || !token.includes('.')) return null;
  const [encoded, signature] = token.split('.', 2);
  if (!encoded || !signature) return null;
  if (!safeEqual(signature, await sign(secret, encoded))) return null;
  let payload;
  try { payload = JSON.parse(stringFromB64url(encoded)); } catch { return null; }
  if (!payload || typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

const COOKIE = 'l3v_session';
const SESSION_TTL = 60 * 60 * 24 * 30;   // 30 days
const STATE_TTL = 60 * 10;               // 10 minutes to complete the OAuth round-trip

export function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}
const cookie = (name, value, {maxAge, clear} = {}) =>
  `${name}=${clear ? '' : encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; ${clear ? 'Max-Age=0' : `Max-Age=${maxAge}`}`;

/** The account for a request from its session cookie, or null. */
export async function sessionAccount(request, env) {
  const token = readCookie(request, COOKIE);
  if (!token) return null;
  const payload = await verifyToken(env.ACCOUNT_SESSION_SECRET, token);
  return payload && /^[a-f0-9]{64}$/.test(payload.accountId || '') ? payload : null;
}

const PROVIDERS = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email',
    idFrom: 'GOOGLE_CLIENT_ID',
    secretFrom: 'GOOGLE_CLIENT_SECRET',
  },
};

export function providerConfig(env, provider) {
  const spec = PROVIDERS[provider];
  if (!spec) return null;
  const clientId = env[spec.idFrom], clientSecret = env[spec.secretFrom];
  if (!clientId || !clientSecret) return null;
  return {...spec, clientId, clientSecret};
}

const randomB64url = (bytes = 32) => b64urlFromBytes(crypto.getRandomValues(new Uint8Array(bytes)));

/** Begin sign-in: the authorize URL and the signed state cookie carrying the PKCE verifier. */
export async function startOAuth(env, provider, {origin, returnTo = '/'}) {
  const config = providerConfig(env, provider);
  if (!config) return null;
  const verifier = randomB64url(32);
  const challenge = b64urlFromBytes(await crypto.subtle.digest('SHA-256', enc.encode(verifier)));
  const nonce = randomB64url(16);
  const state = await signToken(env.ACCOUNT_SESSION_SECRET, {provider, verifier, nonce, returnTo: safeReturn(returnTo)}, STATE_TTL);
  const redirectUri = origin + '/api/account/callback';
  const authorize = new URL(config.authUrl);
  authorize.search = new URLSearchParams({
    client_id: config.clientId, redirect_uri: redirectUri, response_type: 'code',
    scope: config.scope, code_challenge: challenge, code_challenge_method: 'S256',
    state: nonce, access_type: 'online', prompt: 'select_account',
  }).toString();
  return {redirect: authorize.toString(), setCookie: cookie('l3v_oauth', state, {maxAge: STATE_TTL})};
}

// Only same-origin relative paths are honoured as a post-login destination.
const safeReturn = value => (typeof value === 'string' && /^\/[A-Za-z0-9/_#?=.&-]*$/.test(value) ? value : '/');

/** Complete sign-in: verify state, exchange the code, and return the verified email. */
export async function completeOAuth(env, {origin, code, state, stateCookie}) {
  const parsed = await verifyToken(env.ACCOUNT_SESSION_SECRET, stateCookie || '');
  if (!parsed || !safeEqual(parsed.nonce || '', state || '')) return {error: 'invalid-state'};
  const config = providerConfig(env, parsed.provider);
  if (!config || !code) return {error: 'not-configured'};
  const response = await fetch(config.tokenUrl, {
    method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      client_id: config.clientId, client_secret: config.clientSecret, code,
      code_verifier: parsed.verifier, grant_type: 'authorization_code',
      redirect_uri: origin + '/api/account/callback',
    }),
  });
  if (!response.ok) return {error: 'token-exchange-failed'};
  const tokens = await response.json().catch(() => ({}));
  const claims = decodeIdToken(tokens.id_token);
  if (!claims?.email || claims.email_verified === false) return {error: 'no-verified-email'};
  return {email: String(claims.email).toLowerCase(), returnTo: parsed.returnTo || '/'};
}

// The id token comes straight from the provider's token endpoint over TLS with
// our client secret, so its payload is trusted; we only decode it.
export function decodeIdToken(idToken) {
  if (typeof idToken !== 'string' || idToken.split('.').length !== 3) return null;
  try { return JSON.parse(stringFromB64url(idToken.split('.')[1])); } catch { return null; }
}

/** The stable 64-hex accountId for an email, created on first sign-in. */
export async function accountForEmail(env, email) {
  const key = 'account:email:' + await sha256hex('l3v-account\0' + email);
  const existing = await env.INVITATIONS.get(key);
  if (/^[a-f0-9]{64}$/.test(existing || '')) return existing;
  const accountId = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
  await env.INVITATIONS.put(key, accountId);
  return accountId;
}

/** The Set-Cookie that logs an account in, and the one that logs it out. */
export async function sessionCookie(env, {accountId, email}) {
  const token = await signToken(env.ACCOUNT_SESSION_SECRET, {accountId, email}, SESSION_TTL);
  return cookie(COOKIE, token, {maxAge: SESSION_TTL});
}
export const clearSessionCookie = () => cookie(COOKIE, '', {clear: true});
export const clearStateCookie = () => cookie('l3v_oauth', '', {clear: true});
