# RMR public waiting list

## Architecture

```
Public website → /api/waitlist Pages Function → Cloudflare D1 (WAITLIST_DB)
```

The public site remains a static Cloudflare Pages project. `functions/api/waitlist.js` is a Cloudflare Pages Function, which runs on the Cloudflare Workers runtime. It is deliberately a small same-origin JSON endpoint; it does not expose database credentials to the browser.

## Relevant files

- `index.html` — accessible waiting-list dialog and form.
- `main.js` — client validation, submitting, success, duplicate and failure states.
- `functions/api/waitlist.js` — server validation and parameterised D1 reads/writes.
- `migrations/0001_waiting_list.sql` — D1 schema.

## D1 data

Create one production D1 database and bind it to the existing **Remote Master Rack Cloudflare Pages project** as `WAITLIST_DB`. The table stores only the normalised email address, optional first name, timestamp, affirmative marketing-consent flag/version, source and lifecycle status. It contains no outbound-email configuration, authentication data or payment data.

Apply the migration with Wrangler after authentication and database creation:

```powershell
npx wrangler d1 execute <database-name> --remote --file migrations/0001_waiting_list.sql
```

Then in Cloudflare: **Workers & Pages → Remote Master Rack Pages project → Settings → Bindings → Add → D1 database binding**, set the variable name to `WAITLIST_DB`, select that database, and save. Trigger a normal Pages deployment after the binding is saved.

## Local checks

The static UI can be served by any local static server. A full endpoint test requires a local D1 binding through Wrangler/Pages development; no local database is committed to this repository.

## Deliberately not implemented

- outbound marketing email;
- unsubscribe workflow or suppression management UI;
- account creation, bookings, payments or customer authentication;
- third-party mailing-list SaaS;
- analytics or behavioural tracking.

Cloudflare Turnstile and/or an edge rate-limiting rule are the immediate next hardening step once the endpoint is live and receiving real traffic.
