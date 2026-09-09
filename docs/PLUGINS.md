# RMR Plugin Catalogue Foundation

## Public information architecture

The public plugins area is arranged as two product families:

- **VST Editors** — the current editor-product catalogue and a shared preset-library shell.
- **AGE Series** — a separate RMR product family, currently presented as an in-development holding page.

Each VST Editor has a stable public route and a shared detail-page structure. Product records are held in `plugins-data.js` so the gallery, product pages and preset context use the same canonical labels and slugs.

## Access rules (future implementation)

The public experience must distinguish between product discovery and account-only contribution:

- Visitors may browse editor pages and download published presets without an account.
- An account will be required later to upload a preset, rate or review a preset, or manage contributed presets.

These are product rules only. They do not add authentication checks, uploads, ratings, downloads or backend logic in this foundation.

## Assets still required

No product or hardware imagery is fabricated in the initial release. When approved artwork is available, supply one landscape image per editor card and detail view:

- Folktek Resonant Garden Editor — at least 1600 × 1000 px
- Pultec EQP-1A Editor — at least 1600 × 1000 px
- SSL Fusion Editor — at least 1600 × 1000 px

Use artwork that RMR is licensed to publish. Preserve the existing dark, restrained RMR visual treatment and provide meaningful alternative text when images become content rather than decoration.
