const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const SESSION_COOKIE = '__Host-rmr_session';
export const TRANSACTION_COOKIE = '__Host-rmr_auth_txn';
export const SESSION_LIFETIME_SECONDS = 8 * 60 * 60;
const TRANSACTION_LIFETIME_SECONDS = 10 * 60;
const CLOCK_SKEW_SECONDS = 60;

let cachedJwks;
let cachedJwksIssuer;
let cachedJwksAt = 0;

const base64UrlEncode = (bytes) => {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const base64UrlDecode = (value) => {
  const normalised = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalised + '='.repeat((4 - (normalised.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const parseJsonSegment = (value) => JSON.parse(decoder.decode(base64UrlDecode(value)));

const randomValue = (size = 32) => {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
};

const constantTimeEqual = (left, right) => {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  leftBytes.forEach((value, index) => { difference |= value ^ rightBytes[index]; });
  return difference === 0;
};

const getCookie = (request, name) => {
  const cookieHeader = request.headers.get('Cookie') || '';
  for (const cookie of cookieHeader.split(';')) {
    const separator = cookie.indexOf('=');
    if (separator < 0) continue;
    if (cookie.slice(0, separator).trim() === name) return cookie.slice(separator + 1).trim();
  }
  return null;
};

const importCookieKey = async (secret) => {
  const bytes = base64UrlDecode(secret || '');
  if (bytes.length !== 32) throw new Error('AUTH_SESSION_SECRET must be a base64url-encoded 32-byte value.');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
};

export const sealCookie = async (payload, secret, purpose) => {
  const key = await importCookieKey(secret);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(purpose) },
    key,
    encoder.encode(JSON.stringify(payload)),
  );
  return `v1.${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(ciphertext))}`;
};

export const openCookie = async (value, secret, purpose) => {
  try {
    const [version, encodedIv, encodedCiphertext] = String(value || '').split('.');
    if (version !== 'v1' || !encodedIv || !encodedCiphertext) return null;
    const key = await importCookieKey(secret);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64UrlDecode(encodedIv), additionalData: encoder.encode(purpose) },
      key,
      base64UrlDecode(encodedCiphertext),
    );
    const payload = JSON.parse(decoder.decode(plaintext));
    if (!payload || typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
};

export const cookieValue = (name, value, maxAge) => `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
export const clearCookie = (name) => `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

export const getAuthConfig = (env) => {
  const domain = String(env.AUTH0_DOMAIN || '').replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const clientId = String(env.AUTH0_CLIENT_ID || '');
  const clientSecret = String(env.AUTH0_CLIENT_SECRET || '');
  const sessionSecret = String(env.AUTH_SESSION_SECRET || '');
  const baseUrl = String(env.AUTH_BASE_URL || '').replace(/\/+$/, '');
  if (!domain || !clientId || !clientSecret || !sessionSecret || !baseUrl) throw new Error('Authentication is not configured.');
  if (!/^[a-z0-9.-]+$/i.test(domain)) throw new Error('AUTH0_DOMAIN is invalid.');
  const issuerUrl = new URL(`https://${domain}/`);
  const parsedBaseUrl = new URL(baseUrl);
  if (parsedBaseUrl.protocol !== 'https:' && parsedBaseUrl.hostname !== '127.0.0.1' && parsedBaseUrl.hostname !== 'localhost') {
    throw new Error('AUTH_BASE_URL must use HTTPS.');
  }
  if (parsedBaseUrl.pathname !== '/' || parsedBaseUrl.search || parsedBaseUrl.hash) throw new Error('AUTH_BASE_URL must be an origin without a path.');
  return { domain, clientId, clientSecret, sessionSecret, baseUrl, issuer: issuerUrl.toString() };
};

export const readSession = async (request, env) => {
  const { sessionSecret } = getAuthConfig(env);
  return openCookie(getCookie(request, SESSION_COOKIE), sessionSecret, 'rmr-session-v1');
};

export const startAuthentication = async ({ request, env }, screenHint) => {
  const config = getAuthConfig(env);
  const existingSession = await readSession(request, env);
  if (existingSession) return Response.redirect(`${config.baseUrl}/account.html`, 302);

  const state = randomValue();
  const nonce = randomValue();
  const verifier = randomValue(48);
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(verifier));
  const transaction = await sealCookie({
    state,
    nonce,
    verifier,
    exp: Math.floor(Date.now() / 1000) + TRANSACTION_LIFETIME_SECONDS,
  }, config.sessionSecret, 'rmr-auth-transaction-v1');

  const authorizeUrl = new URL('/authorize', config.issuer);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', config.clientId);
  authorizeUrl.searchParams.set('redirect_uri', `${config.baseUrl}/auth/callback`);
  authorizeUrl.searchParams.set('scope', 'openid profile email');
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('nonce', nonce);
  authorizeUrl.searchParams.set('code_challenge', base64UrlEncode(new Uint8Array(digest)));
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');
  if (screenHint === 'signup') authorizeUrl.searchParams.set('screen_hint', 'signup');

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl.toString(),
      'Set-Cookie': cookieValue(TRANSACTION_COOKIE, transaction, TRANSACTION_LIFETIME_SECONDS),
      'Cache-Control': 'no-store',
    },
  });
};

const loadJwks = async (issuer, forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && cachedJwks && cachedJwksIssuer === issuer && now - cachedJwksAt < 6 * 60 * 60 * 1000) return cachedJwks;
  const response = await fetch(new URL('.well-known/jwks.json', issuer), { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Unable to load identity-provider keys.');
  const body = await response.json();
  if (!body || !Array.isArray(body.keys)) throw new Error('Identity-provider keys are invalid.');
  cachedJwks = body.keys;
  cachedJwksIssuer = issuer;
  cachedJwksAt = now;
  return cachedJwks;
};

const findSigningKey = async (issuer, keyId) => {
  let keys = await loadJwks(issuer);
  let key = keys.find((candidate) => candidate.kid === keyId && candidate.kty === 'RSA');
  if (!key) {
    keys = await loadJwks(issuer, true);
    key = keys.find((candidate) => candidate.kid === keyId && candidate.kty === 'RSA');
  }
  if (!key) throw new Error('No matching identity-provider signing key.');
  return key;
};

export const verifyIdToken = async (idToken, config, expectedNonce) => {
  const segments = String(idToken || '').split('.');
  if (segments.length !== 3) throw new Error('Invalid ID token.');
  const header = parseJsonSegment(segments[0]);
  const claims = parseJsonSegment(segments[1]);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error('Unsupported ID token signature.');

  const jwk = await findSigningKey(config.issuer, header.kid);
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const validSignature = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    base64UrlDecode(segments[2]),
    encoder.encode(`${segments[0]}.${segments[1]}`),
  );
  if (!validSignature) throw new Error('Invalid ID token signature.');

  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== config.issuer || !audiences.includes(config.clientId)) throw new Error('Invalid ID token issuer or audience.');
  if (audiences.length > 1 && claims.azp !== config.clientId) throw new Error('Invalid ID token authorised party.');
  if (typeof claims.exp !== 'number' || claims.exp <= now - CLOCK_SKEW_SECONDS) throw new Error('Expired ID token.');
  if (typeof claims.iat !== 'number' || claims.iat > now + CLOCK_SKEW_SECONDS) throw new Error('Invalid ID token issue time.');
  if (claims.nbf !== undefined && (typeof claims.nbf !== 'number' || claims.nbf > now + CLOCK_SKEW_SECONDS)) {
    throw new Error('ID token is not yet valid.');
  }
  if (typeof claims.nonce !== 'string' || !constantTimeEqual(claims.nonce, expectedNonce)) throw new Error('Invalid ID token nonce.');
  if (typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 255) throw new Error('Invalid ID token subject.');
  return claims;
};

export const completeAuthentication = async ({ request, env }) => {
  const config = getAuthConfig(env);
  const url = new URL(request.url);
  const transaction = await openCookie(getCookie(request, TRANSACTION_COOKIE), config.sessionSecret, 'rmr-auth-transaction-v1');
  const returnedState = url.searchParams.get('state') || '';
  const code = url.searchParams.get('code') || '';
  if (!transaction || !code || !returnedState || !constantTimeEqual(returnedState, transaction.state)) {
    throw new Error('Invalid authentication transaction.');
  }

  const tokenResponse = await fetch(new URL('/oauth/token', config.issuer), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: `${config.baseUrl}/auth/callback`,
      code_verifier: transaction.verifier,
    }),
  });
  if (!tokenResponse.ok) throw new Error('Authentication code exchange failed.');
  const tokens = await tokenResponse.json();
  const claims = await verifyIdToken(tokens.id_token, config, transaction.nonce);
  return { config, claims };
};

const cleanProfileValue = (value, maximum) => {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/\s+/g, ' ');
  return cleaned ? cleaned.slice(0, maximum) : null;
};

export const upsertCustomerAccount = async (env, claims) => {
  if (!env.ACCOUNTS_DB) throw new Error('ACCOUNTS_DB binding is not configured.');
  const id = crypto.randomUUID();
  const email = cleanProfileValue(claims.email, 254)?.toLowerCase() || null;
  const displayName = cleanProfileValue(claims.name || claims.given_name || claims.nickname, 120);
  await env.ACCOUNTS_DB.prepare(`
    INSERT INTO customer_accounts (id, auth_provider, auth_subject, email, display_name, account_status)
    VALUES (?, 'auth0', ?, ?, ?, 'active')
    ON CONFLICT(auth_provider, auth_subject) DO UPDATE SET
      email = excluded.email,
      display_name = COALESCE(excluded.display_name, customer_accounts.display_name),
      updated_at = CURRENT_TIMESTAMP
  `).bind(id, claims.sub, email, displayName).run();
  return env.ACCOUNTS_DB.prepare(`
    SELECT id, auth_provider, auth_subject, email, display_name, created_at, updated_at, account_status
    FROM customer_accounts WHERE auth_provider = 'auth0' AND auth_subject = ? LIMIT 1
  `).bind(claims.sub).first();
};

export const createSessionCookie = async (account, claims, config) => {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = Math.min(claims.exp, now + SESSION_LIFETIME_SECONDS);
  const value = await sealCookie({
    accountId: account.id,
    provider: 'auth0',
    subject: claims.sub,
    iat: now,
    exp: expiresAt,
  }, config.sessionSecret, 'rmr-session-v1');
  return cookieValue(SESSION_COOKIE, value, Math.max(0, expiresAt - now));
};

export const safeAccountProjection = (account) => ({
  email: account.email,
  displayName: account.display_name,
  createdAt: account.created_at,
  status: account.account_status,
});

export const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=UTF-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  },
});
