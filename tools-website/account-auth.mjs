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
const cookie = (name, value, {maxAge, clear, sameSite = 'Lax'} = {}) =>
  `${name}=${clear ? '' : encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=${sameSite}; ${clear ? 'Max-Age=0' : `Max-Age=${maxAge}`}`;

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
    scope: 'openid email', pkce: true, idToken: true,
    idFrom: 'GOOGLE_CLIENT_ID', secretFrom: 'GOOGLE_CLIENT_SECRET',
  },
  microsoft: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'openid email', pkce: true, idToken: true,
    idFrom: 'MICROSOFT_CLIENT_ID', secretFrom: 'MICROSOFT_CLIENT_SECRET',
  },
  github: {
    // GitHub is OAuth2 without an id token: exchange the code, then read the
    // account's primary verified email from its API.
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scope: 'user:email', pkce: false, idToken: false,
    emailUrl: 'https://api.github.com/user/emails',
    idFrom: 'GITHUB_CLIENT_ID', secretFrom: 'GITHUB_CLIENT_SECRET',
  },
  apple: {
    // Apple: the client secret is an ES256 JWT we sign, and the callback is a
    // cross-site form POST, so it uses response_mode=form_post and its state
    // cookie is SameSite=None. Email arrives in the id token (first consent).
    authUrl: 'https://appleid.apple.com/auth/authorize',
    tokenUrl: 'https://appleid.apple.com/auth/token',
    scope: 'name email', pkce: false, idToken: true, appleSecret: true, formPost: true,
    idFrom: 'APPLE_CLIENT_ID', secretFrom: 'APPLE_PRIVATE_KEY',
  },
};

export function providerConfig(env, provider) {
  const spec = PROVIDERS[provider];
  if (!spec) return null;
  const clientId = env[spec.idFrom], clientSecret = env[spec.secretFrom];
  if (!clientId || !clientSecret) return null;
  if (spec.appleSecret && !(env.APPLE_TEAM_ID && env.APPLE_KEY_ID)) return null;
  return {...spec, clientId, clientSecret};
}

const randomB64url = (bytes = 32) => b64urlFromBytes(crypto.getRandomValues(new Uint8Array(bytes)));

/** Begin sign-in: the authorize URL and the signed state cookie carrying the PKCE verifier. */
export async function startOAuth(env, provider, {origin, returnTo = '/'}) {
  const config = providerConfig(env, provider);
  if (!config) return null;
  const verifier = randomB64url(32);
  const nonce = randomB64url(16);
  const state = await signToken(env.ACCOUNT_SESSION_SECRET, {provider, verifier, nonce, returnTo: safeReturn(returnTo)}, STATE_TTL);
  const redirectUri = origin + '/api/account/callback';
  const params = {client_id: config.clientId, redirect_uri: redirectUri, response_type: 'code', scope: config.scope, state: nonce};
  if (config.pkce) {
    params.code_challenge = b64urlFromBytes(await crypto.subtle.digest('SHA-256', enc.encode(verifier)));
    params.code_challenge_method = 'S256';
    params.prompt = 'select_account';
  }
  if (config.formPost) params.response_mode = 'form_post';
  const authorize = new URL(config.authUrl);
  authorize.search = new URLSearchParams(params).toString();
  return {redirect: authorize.toString(), setCookie: cookie('l3v_oauth', state, {maxAge: STATE_TTL, sameSite: config.formPost ? 'None' : 'Lax'})};
}

// Only same-origin relative paths are honoured as a post-login destination.
const safeReturn = value => (typeof value === 'string' && /^\/[A-Za-z0-9/_#?=.&-]*$/.test(value) ? value : '/');

/** Complete sign-in: verify state, exchange the code, and return the verified email. */
export async function completeOAuth(env, {origin, code, state, stateCookie}) {
  const parsed = await verifyToken(env.ACCOUNT_SESSION_SECRET, stateCookie || '');
  if (!parsed || !safeEqual(parsed.nonce || '', state || '')) return {error: 'invalid-state'};
  const config = providerConfig(env, parsed.provider);
  if (!config || !code) return {error: 'not-configured'};
  const clientSecret = config.appleSecret ? await appleClientSecret(env) : config.clientSecret;
  if (!clientSecret) return {error: 'not-configured'};
  const form = {client_id: config.clientId, client_secret: clientSecret, code, grant_type: 'authorization_code', redirect_uri: origin + '/api/account/callback'};
  if (config.pkce) form.code_verifier = parsed.verifier;
  const response = await fetch(config.tokenUrl, {
    method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json'},
    body: new URLSearchParams(form),
  });
  if (!response.ok) return {error: 'token-exchange-failed'};
  const tokens = await response.json().catch(() => ({}));
  const email = config.idToken ? emailFromIdToken(tokens.id_token) : await emailFromUserInfo(config, tokens.access_token);
  if (!email) return {error: 'no-verified-email'};
  return {email: email.toLowerCase(), returnTo: parsed.returnTo || '/'};
}

// The id token comes straight from the provider's token endpoint over TLS with
// our client secret, so its payload is trusted; we only decode it.
export function decodeIdToken(idToken) {
  if (typeof idToken !== 'string' || idToken.split('.').length !== 3) return null;
  try { return JSON.parse(stringFromB64url(idToken.split('.')[1])); } catch { return null; }
}
function emailFromIdToken(idToken) {
  const claims = decodeIdToken(idToken);
  return claims?.email && claims.email_verified !== false ? String(claims.email) : null;
}
// Providers without an id token (GitHub): read the primary, verified email.
async function emailFromUserInfo(config, accessToken) {
  if (!accessToken) return null;
  const response = await fetch(config.emailUrl, {headers: {Authorization: 'Bearer ' + accessToken, Accept: 'application/vnd.github+json', 'User-Agent': 'l3v-tools'}});
  if (!response.ok) return null;
  const list = await response.json().catch(() => null);
  if (!Array.isArray(list)) return null;
  const primary = list.find(item => item?.primary && item?.verified && item?.email);
  const anyVerified = list.find(item => item?.verified && item?.email);
  return (primary || anyVerified)?.email || null;
}
export const supportedProviders = env => Object.keys(PROVIDERS).filter(name => providerConfig(env, name));

function pkcs8FromPem(pem) {
  const body = String(pem).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  return bytesFromB64url(body.replace(/\+/g, '-').replace(/\//g, '_'));
}
// Apple's client secret: a short-lived ES256 JWT signed with the team's key.
async function appleClientSecret(env) {
  if (!(env.APPLE_PRIVATE_KEY && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_CLIENT_ID)) return null;
  const key = await crypto.subtle.importKey('pkcs8', pkcs8FromPem(env.APPLE_PRIVATE_KEY), {name: 'ECDSA', namedCurve: 'P-256'}, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlFromString(JSON.stringify({alg: 'ES256', kid: env.APPLE_KEY_ID}));
  const payload = b64urlFromString(JSON.stringify({iss: env.APPLE_TEAM_ID, iat: now, exp: now + 300, aud: 'https://appleid.apple.com', sub: env.APPLE_CLIENT_ID}));
  const signature = await crypto.subtle.sign({name: 'ECDSA', hash: 'SHA-256'}, key, enc.encode(header + '.' + payload));
  return header + '.' + payload + '.' + b64urlFromBytes(signature);
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
