# RMR customer authentication foundation

## Architecture

```
RMR website
  → Auth0 Universal Login (Authorization Code + PKCE)
  → /auth/callback Pages Function
  → verified Auth0 ID token
  → encrypted HttpOnly RMR session cookie
  → ACCOUNTS_DB customer profile
  → protected /api/account projection
```

Auth0 owns credentials, signup, login, reset and identity-provider sessions. RMR never receives or stores passwords. The RMR database stores only a stable Auth0 subject link and the minimum customer profile needed by the platform.

## Cloudflare production configuration

The Pages project requires these production bindings:

- `ACCOUNTS_DB` — D1 database `rmr-customer-accounts` (`fcccf0c5-8d33-4596-9450-9aacf1ac0bd1`).
- `AUTH0_DOMAIN` — Auth0 tenant domain without `https://`.
- `AUTH0_CLIENT_ID` — Regular Web Application client ID.
- `AUTH_BASE_URL` — `https://remotemasterrack.com`.
- `AUTH0_CLIENT_SECRET` — encrypted Cloudflare secret, entered privately.
- `AUTH_SESSION_SECRET` — encrypted Cloudflare secret containing a base64url-encoded random 32-byte value.

Never commit either secret or any `.dev.vars`/`.env` file.

Production database ID: `fcccf0c5-8d33-4596-9450-9aacf1ac0bd1`.

The Auth0 Regular Web Application must allow:

- callback: `https://remotemasterrack.com/auth/callback`
- logout: `https://remotemasterrack.com/`
- web origin: `https://remotemasterrack.com`
- Authorization Code grant

## D1

Apply `migrations/accounts/0001_customer_accounts.sql` only to `rmr-customer-accounts`. The unique `(auth_provider, auth_subject)` constraint makes repeated logins idempotent. Email is profile data, not the identity key.

## Security decisions

- Authorization Code flow uses state, nonce and S256 PKCE.
- Auth0 ID tokens must use RS256 and are verified against the tenant JWKS.
- Issuer, audience, authorised party (when required), expiry, issue/not-before time, nonce, signature and subject are checked server-side.
- Auth0 tokens are never sent to static JavaScript, stored in browser storage or written to logs.
- The local RMR session contains only internal identifiers and is AES-GCM encrypted in a `Secure`, `HttpOnly`, `SameSite=Lax`, `__Host-` cookie.
- `/api/account` decrypts the server session and confirms the linked D1 account remains active before returning a minimal customer-safe projection.
- Logout is POST-only and clears both RMR cookies before redirecting through Auth0 logout.

## Desktop compatibility

The future desktop client should be registered as a separate Auth0 **Native Application** in the same tenant. It should use the system browser with Authorization Code + PKCE and a secure loopback or registered deep-link callback. Both website and desktop resolve to the same Auth0 `sub` and therefore the same RMR customer record. Desktop tokens must use a future RMR API audience and must not reuse the website client secret or browser cookie.

## Not implemented in this foundation

- bookings, payments, projects or entitlements;
- desktop/Electron login;
- customer administration in Studio Manager;
- passkey or MFA policy enforcement;
- refresh tokens or unattended sessions.

Auth0 Universal Login can adopt passkeys or MFA later without changing the RMR customer identity key or D1 profile relationship.

## Local validation

Run `node --test tests/auth-foundation.test.mjs`. The suite exercises encrypted-cookie tamper and expiry handling, PKCE authorization parameters, hardened cookie attributes, signed ID-token validation, duplicate-safe account linking and the profile-free session payload.
