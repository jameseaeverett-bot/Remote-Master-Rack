# Remote Master Rack — Website & Owner Portal

The public holding page reads `website-content.json`. The Owner Portal provides drafts and direct publishing for routine wording changes.

## Daily workflow

1. Open **RMR Owner Portal** from `~/Desktop/RMR Launchers` to edit content.
2. Edit the Website Content fields.
3. Use **Save Draft** whenever you want to keep a local draft.
4. Use **Publish to Website** to commit the content to GitHub and trigger GitHub Pages.
5. Open **RMR Website (Live)** to see the public GitHub Pages website.

`RMR Website Preview` is deliberately separate: it opens the local development copy only. Publishing never opens or refreshes it. After a publish, the local project is fast-forwarded only when it is clean; modified or ahead local work is never overwritten.

## One-time secure publishing setup

The Owner Portal service runs locally and never sends a GitHub token to browser-side JavaScript. Store a GitHub fine-grained personal access token in macOS Keychain with **Contents: Read and write** access to `jameseaeverett-bot/Remote-Master-Rack`:

```bash
security add-generic-password -U -a "$USER" -s RMR_GITHUB_TOKEN -w
```

Paste the token when prompted. The RMR launchers retrieve it only into the local publishing service process. Do not put tokens in `portal-config.js`, `website-content.json`, or the Git repository.

GitHub Pages must already be configured to deploy `main` from `/(root)`.

## Local service

`owner_portal_service.py` serves the website and the secure `/api/publish` endpoint only on `127.0.0.1:4173`.
