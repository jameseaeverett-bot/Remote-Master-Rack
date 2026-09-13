# DAW Detectives Crash Intelligence

## Purpose

This foundation stores reviewed, evidence-backed crash knowledge separately from DAW Detectives application code. It does not diagnose a customer's computer, collect telemetry, or alter the DAW Detectives client. Referenced plug-ins, drivers, modules and vendors are evidence only; they are never represented as automatic proof of root cause.

## Boundaries

- The unlisted management surface is `/dd-crash-intelligence.html`.
- Management APIs require an existing RMR website session plus the existing `CMS_OWNER_SUBJECTS` owner allowlist.
- Public read routes expose only immutable published database artefacts. They never expose research notes, draft records, owner identity, or administration state.
- No real crash reports, research claims, or production database content are seeded by this source change. The migration seeds only the agreed DAW reference list.

## Storage model

Create one dedicated D1 database for this feature, for example `rmr-daw-detectives-crash-intelligence`, and bind it to Pages as `DD_INTELLIGENCE_DB`.

`migrations/dd/0001_crash_intelligence.sql` defines:

- `dd_daws`, `dd_sources`, and their source-to-DAW relationship;
- `dd_knowledge_records` with DAW applicability, platform, version range, exception code, event/module/vendor evidence, guidance, confidence, evidence state, provenance and soft retirement;
- `dd_knowledge_daws` and `dd_knowledge_sources` for many-to-many relationships;
- `dd_research_records` for private, unpublishable leads;
- `dd_database_versions` for immutable canonical JSON datasets; and
- `dd_current_manifest` as the sole mutable pointer used for rollback.

Apply the migration only after the binding is created and reviewed:

```powershell
npx wrangler d1 execute rmr-daw-detectives-crash-intelligence --remote --file migrations/dd/0001_crash_intelligence.sql
```

Do not reuse `CONTENT_DB`, the waiting-list database, or customer-account database.

## Publication contract

Publication generates stable, recursively key-ordered JSON and calculates its SHA-256 before it is stored. Each completed publish receives a new integer version. Existing version rows are never modified. A rollback only repoints `dd_current_manifest` to a previously stored version.

The publisher fails before advancing the manifest if approved knowledge is malformed, has no source, references a missing/inactive source, contains unsupported evidence metadata, is retired, or is marked research.

Public endpoints:

- `GET /api/dd/crash-intelligence/manifest`
- `GET /api/dd/crash-intelligence/database/{version}`

The manifest provides the current version, canonical database URL, SHA-256, byte size, published time and schema version. Both routes use ETags. There is intentionally no client-updater behaviour in this milestone.

## Owner workflow

1. Sign into the RMR website with the configured owner account.
2. Open the unlisted management page.
3. Add source records before approving knowledge that cites them.
4. Create knowledge as draft, then add only reviewed evidence and safe guidance.
5. Mark a record approved only when it has source references and an appropriate evidence state.
6. Publish. Review the resulting version/hash and manifest.
7. If required, use **Make current** beside an existing immutable version. This does not rewrite historical data.

Research is deliberately private and cannot be included in a publication.

## Operational notes

Knowledge search is paginated and filterable by text, DAW, DAW version, crash code, module, platform, confidence, evidence state and review-needed state. Source and research areas are deliberately management-only. As the collection grows, source/research pagination or dedicated search can be added without altering the public dataset contract.

Before production enablement, create/bind the D1 store, apply the migration, verify the owner allowlist secret remains configured, and test one non-sensitive reviewed record through publication and rollback. No Cloudflare configuration is made by this source change.
