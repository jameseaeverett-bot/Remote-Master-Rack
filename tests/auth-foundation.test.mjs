import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SESSION_COOKIE,
  TRANSACTION_COOKIE,
  createSessionCookie,
  getAuthConfig,
  getDesktopApiConfig,
  openCookie,
  sealCookie,
  startAuthentication,
  upsertCustomerAccount,
  verifyAccessToken,
  verifyIdToken,
} from '../functions/_lib/auth.js';

const sessionSecret = Buffer.alloc(32, 7).toString('base64url');
const environment = {
  AUTH0_DOMAIN: 'example.auth0.com',
  AUTH0_CLIENT_ID: 'rmr-test-client',
  AUTH0_CLIENT_SECRET: 'test-only-secret',
  AUTH_SESSION_SECRET: sessionSecret,
  AUTH_BASE_URL: 'https://remotemasterrack.com',
};

const encodeSegment = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

test('encrypted cookies reject tampering and expiry', async () => {
  const valid = await sealCookie({ value: 'safe', exp: Math.floor(Date.now() / 1000) + 60 }, sessionSecret, 'test');
  assert.deepEqual(await openCookie(valid, sessionSecret, 'test'), {
    value: 'safe',
    exp: Math.floor(Date.now() / 1000) + 60,
  });
  assert.equal(await openCookie(`${valid.slice(0, -1)}x`, sessionSecret, 'test'), null);
  const expired = await sealCookie({ exp: Math.floor(Date.now() / 1000) - 1 }, sessionSecret, 'test');
  assert.equal(await openCookie(expired, sessionSecret, 'test'), null);
});
test('login starts an Auth0 code flow with PKCE and a hardened transaction cookie', async () => {
  const response = await startAuthentication({
    request: new Request('https://remotemasterrack.com/auth/login'),
    env: environment,
  }, 'login');
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get('Location'));
  assert.equal(location.origin, 'https://example.auth0.com');
  assert.equal(location.pathname, '/authorize');
  assert.equal(location.searchParams.get('response_type'), 'code');
  assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(location.searchParams.get('state'));
  assert.ok(location.searchParams.get('nonce'));
  assert.ok(location.searchParams.get('code_challenge'));
  const cookie = response.headers.get('Set-Cookie');
  assert.match(cookie, new RegExp(`^${TRANSACTION_COOKIE}=`));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
});

test('ID tokens require a valid signature, issuer, audience, authorised party and nonce', async () => {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  publicJwk.kid = 'rmr-test-key';
  publicJwk.use = 'sig';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ keys: [publicJwk] });

  const config = getAuthConfig(environment);
  const now = Math.floor(Date.now() / 1000);
  const sign = async (claims) => {
    const header = encodeSegment({ alg: 'RS256', typ: 'JWT', kid: publicJwk.kid });
    const payload = encodeSegment(claims);
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keyPair.privateKey, new TextEncoder().encode(`${header}.${payload}`));
    return `${header}.${payload}.${Buffer.from(signature).toString('base64url')}`;
  };
  const claims = {
    iss: config.issuer,
    aud: config.clientId,
    sub: 'auth0|customer-one',
    nonce: 'expected-nonce',
    iat: now,
    exp: now + 300,
  };

  try {
    assert.equal((await verifyIdToken(await sign(claims), config, 'expected-nonce')).sub, claims.sub);
    await assert.rejects(verifyIdToken(await sign({ ...claims, nonce: 'wrong' }), config, 'expected-nonce'));
    await assert.rejects(verifyIdToken(await sign({ ...claims, aud: [config.clientId, 'another-client'] }), config, 'expected-nonce'));
    assert.equal((await verifyIdToken(
      await sign({ ...claims, aud: [config.clientId, 'another-client'], azp: config.clientId }),
      config,
      'expected-nonce',
    )).sub, claims.sub);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('desktop access tokens require the RMR API audience, Native client and account scope', async () => {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  publicJwk.kid = 'rmr-desktop-test-key';
  publicJwk.use = 'sig';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ keys: [publicJwk] });

  const config = getDesktopApiConfig({
    AUTH0_DOMAIN: 'desktop-test.auth0.com',
    AUTH0_API_AUDIENCE: 'https://api.remotemasterrack.com',
    AUTH0_DESKTOP_CLIENT_ID: 'rmr-native-client',
  });
  const now = Math.floor(Date.now() / 1000);
  const sign = async (claims) => {
    const header = encodeSegment({ alg: 'RS256', typ: 'JWT', kid: publicJwk.kid });
    const payload = encodeSegment(claims);
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keyPair.privateKey, new TextEncoder().encode(`${header}.${payload}`));
    return `${header}.${payload}.${Buffer.from(signature).toString('base64url')}`;
  };
  const claims = {
    iss: config.issuer,
    aud: config.audience,
    azp: config.clientId,
    sub: 'auth0|customer-one',
    scope: 'openid profile email read:account',
    iat: now,
    exp: now + 300,
  };

  try {
    assert.equal((await verifyAccessToken(await sign(claims), config)).sub, claims.sub);
    await assert.rejects(verifyAccessToken(await sign({ ...claims, aud: 'another-api' }), config));
    await assert.rejects(verifyAccessToken(await sign({ ...claims, azp: 'another-client' }), config));
    await assert.rejects(verifyAccessToken(await sign({ ...claims, scope: 'openid profile email' }), config));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('account linking is idempotent and the RMR session contains no profile data', async () => {
  let storedAccount;
  const database = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async run() {
              if (!sql.includes('INSERT INTO customer_accounts')) throw new Error('Unexpected write query.');
              if (!storedAccount) {
                storedAccount = {
                  id: values[0],
                  auth_provider: 'auth0',
                  auth_subject: values[1],
                  email: values[2],
                  display_name: values[3],
                  created_at: '2026-09-08 12:00:00',
                  updated_at: '2026-09-08 12:00:00',
                  account_status: 'active',
                };
              } else {
                storedAccount.email = values[2];
                storedAccount.display_name = values[3] || storedAccount.display_name;
              }
            },
            async first() {
              if (!sql.includes('FROM customer_accounts')) throw new Error('Unexpected read query.');
              return storedAccount?.auth_subject === values[0] ? { ...storedAccount } : null;
            },
          };
        },
      };
    },
  };
  const env = { ...environment, ACCOUNTS_DB: database };
  const first = await upsertCustomerAccount(env, { sub: 'auth0|one', email: 'FIRST@EXAMPLE.COM', name: 'James' });
  const second = await upsertCustomerAccount(env, { sub: 'auth0|one', email: 'second@example.com', name: 'James' });
  assert.equal(second.id, first.id);
  assert.equal(second.email, 'second@example.com');

  const config = getAuthConfig(env);
  const sessionHeader = await createSessionCookie(second, {
    sub: 'auth0|one',
    exp: Math.floor(Date.now() / 1000) + 300,
  }, config);
  assert.match(sessionHeader, new RegExp(`^${SESSION_COOKIE}=`));
  assert.match(sessionHeader, /HttpOnly; Secure; SameSite=Lax/);
  const encryptedValue = sessionHeader.slice(sessionHeader.indexOf('=') + 1, sessionHeader.indexOf(';'));
  const payload = await openCookie(encryptedValue, sessionSecret, 'rmr-session-v1');
  assert.equal(payload.accountId, second.id);
  assert.equal(payload.subject, 'auth0|one');
  assert.equal('email' in payload, false);
  assert.equal('displayName' in payload, false);
});
