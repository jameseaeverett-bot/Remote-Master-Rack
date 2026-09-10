# RMR CMS V1 — Customer-facing text

## Purpose

CMS V1 owns only published text for the specified Plugins, VST Editors, AGE Series and Tools surfaces. It does not own layout, navigation, artwork, product routes, downloads, authentication, presets, bookings, pricing or Studio Manager's local operational configuration.

The data flow is:

```
RMR Studio Manager
  → authenticated PUT /api/admin/content
  → CONTENT_DB (D1)
  → public GET /api/content
  → RMR website and Windows customer app
```

Each record uses a stable content ID and a versioned `version: 1` contract. The public endpoint returns only published fields. It never exposes the publisher identity, local Studio Manager data, or owner configuration.

## Production setup required

Create a production D1 database for customer-facing content, for example `rmr-customer-content`, and apply:

```
migrations/content/0001_customer_content.sql
```

In the existing Cloudflare Pages project, add the D1 binding:

```
CONTENT_DB → rmr-customer-content
```

Then add the encrypted Pages secret `CMS_OWNER_SUBJECTS`. Its value is a comma-separated allowlist of Auth0 user `sub` identifiers permitted to publish. This value is checked only in the Pages Function; it is not sent to either desktop application or the public site.

The existing Auth0 Native application and RMR Platform API are reused. Studio Manager requests the existing `read:account` API scope, but a valid customer token alone is not enough to publish: the token subject must also be listed in `CMS_OWNER_SUBJECTS`.

## Fallback behaviour

Website and desktop client product metadata remains the built-in fallback. If D1 is empty, a field is absent, or `/api/content` is unavailable, the current built-in text stays visible. A CMS response can replace one field without requiring a duplicate record of all product copy.

In Studio Manager, **Restore built-in defaults** restores the selected record to its built-in values ready for a subsequent explicit **Publish Changes** action. It does not alter application defaults.
