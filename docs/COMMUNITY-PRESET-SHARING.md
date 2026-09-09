# RMR Community Preset Sharing V1

## Verified SSL Fusion format

Production upload is enabled only for SSL Fusion `.rmrpreset` files. The rule was derived from a real editor-generated file, not an assumed extension.

The uploaded file must be UTF-8 JSON and contain:

- `editorId: "ssl-fusion"`
- `format: "rmr-vst-editor-preset"`
- `formatVersion: 1`
- a parameter payload
- SHA-256 integrity metadata

The server also enforces a 256 KB limit, rejects empty or malformed files, creates its own R2 key, computes an independent SHA-256 checksum, and does not trust the browser MIME type. Pultec EQP-1A and Folktek Resonant Garden sharing remain disabled until genuine editor-generated preset formats are provided.

## Authentication and ownership

The website reuses the existing encrypted RMR session and Auth0 flow. The requested return route is stored inside the encrypted authentication transaction and is accepted only when it is the preset-sharing route with a known editor slug. External or arbitrary return URLs are discarded.

`creator_account_id` comes only from the server-verified `customer_accounts.id`. Creator display name is presentation metadata; when an account has no display name the public-safe fallback is `RMR Customer`, never the customer's email address.

## Upload transaction

1. Validate the account, editor, fields, rights confirmation and file.
2. Reject more than ten submissions per account in one hour.
3. Compute the file SHA-256 and reject an identical checksum from the same account.
4. Store the object under `presets/<editor-slug>/<server-id>/<safe-filename>` in private `PRESET_FILES`.
5. Insert a `pending_review` row in `PRESETS_DB`.
6. Delete the newly stored R2 object if the D1 insert fails.

Pending submissions are excluded by the existing public API, which returns only `status = 'published'`.

## Manual owner review for V1

Review the private R2 object and its D1 metadata before publication. To publish one approved record in the D1 console:

```sql
UPDATE preset_entries
SET status = 'published', published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
WHERE id = 'REPLACE_WITH_REVIEWED_PRESET_ID' AND status = 'pending_review';
```

Confirm exactly one row was changed. Rejected material should instead be assigned `status = 'rejected'`; do not expose it through the public API.

## Deliberate V1 boundaries

There is no public moderation interface, edit/delete workflow, rating submission endpoint, raw R2 URL, or separate website identity. Cloudflare-native rate limiting can be added later if traffic or abuse warrants a dedicated binding; V1 includes strict size/format validation, authentication, duplicate detection and a per-account hourly submission cap.
