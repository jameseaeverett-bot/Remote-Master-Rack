# RMR Community Presets V1

## Shared service

All RMR clients use the same public service:

```
Website / Windows client / future Mac client / future editor integrations
  → RMR Platform API
  → PRESETS_DB (D1 metadata and rating aggregates)
  → PRESET_FILES (R2 preset files)
```

`customer_accounts` remains the only customer identity system. `preset_ratings.customer_account_id` uses that existing internal ID; email is never an ownership key.

## Production bindings

- `PRESETS_DB`: a new D1 database named **rmr-community-presets**.
- `PRESET_FILES`: a private R2 bucket named **rmr-community-preset-files**.

Do not enable public R2 access. Downloads remain backend-served at `GET /api/presets/:id/download`, so the service can verify publication state, handle a missing object safely, count successful object retrievals, and preserve future entitlement options.

## API contract

All public responses are JSON and are intentionally presentation-neutral.

- `GET /api/presets?editor=&creator=&genre=&sourceBus=&sort=&limit=&offset=` — published list. `sort` is `popular`, `highest-rated`, `most-downloaded`, or `newest`.
- `GET /api/presets/:id` — one published preset.
- `GET /api/presets/:id/download` — attachment stream for one published R2 object.

Unknown editor slugs and malformed queries return `400`; unknown or unpublished preset IDs return `404`; missing bindings return `503`. List/detail responses include editor slug, creator display name, classification, description, file metadata, rating average/count, download count and timestamps. They do not expose R2 keys, checksum values, account IDs or internal moderation data.

## Ratings and popularity

The schema permits exactly one rating per `(preset_id, customer_account_id)` and supports future upsert-based rating changes. Rating submission is deliberately not exposed in V1.

`popular` uses a Bayesian rating prior of 3.5 across five notional ratings plus a capped download contribution. This prevents a single five-star rating outranking an established preset with many strong ratings. `highest-rated` remains a separate sort and exposes both average and rating count.

## Download counting

The backend first retrieves the published R2 object. Only then does it atomically increment `download_count` and stream the attachment. A missing file never increments the count. V1 is deliberately anonymous and does not attempt aggressive abuse prevention.

## File safety and future uploads

There is no V1 upload endpoint or public contribution UI. `allowedPresetExtensions` is an intentionally empty per-editor configuration boundary in `functions/_lib/presets.js`: preset file formats have not yet been supplied or inferred.

Before an upload/import path is built, James must provide the permitted preset extension(s) and expected content/MIME details for each editor. The future validator must enforce the editor-specific allowlist, size limit, safe generated R2 key, non-client-controlled path, checksum, and content sanity. Executables, scripts, installers and general ZIP uploads are prohibited unless expressly approved.

## Production setup sequence

1. Create D1 database `rmr-community-presets` and apply `migrations/presets/0001_community_presets.sql` to it.
2. Create private R2 bucket `rmr-community-preset-files`.
3. In Cloudflare Pages → Remote Master Rack → Settings → Bindings, add D1 binding `PRESETS_DB` and R2 binding `PRESET_FILES`, then save.
4. Deploy this repository revision. Do not seed a production preset until an approved real preset file and its verified metadata are available.

No Auth0 changes are required for public V1 browsing/downloads. Account-gated rating, upload, ownership editing and moderation are future work.
