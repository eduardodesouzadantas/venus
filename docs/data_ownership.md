# Data Ownership And LGPD Baseline

## Categories

| Category | Examples | Owner | Classification | Retention |
| --- | --- | --- | --- | --- |
| Store operational data | `products`, `leads`, `whatsapp_conversations`, `whatsapp_messages`, `tryon_events` | Tenant / lojista | Restricted | Keep only while tenant is active, then purge on tenant deletion |
| Shopper personal data | name, email, phone, WhatsApp, photos, `saved_results.payload`, `lead_context` | Tenant as controller, platform as processor | Sensitive or personal | Minimize, avoid logs, purge on tenant deletion |
| Derived data | intent score, lead context, enrichment output, recommendations | Tenant derived, platform computed | Derived | Retain only while useful for operation; purge with tenant data |
| Platform governance | `tenant_events`, `privacy_audit_events`, billing and access metadata | Platform | Operational | Retain for audit and compliance, no business content beyond summary |

## Owner Rules

- The tenant owns store operations data and shopper consented interactions.
- The platform owns governance events, access control metadata and billing state.
- Derived data must never be treated as immutable source-of-truth if the original personal data is deleted.
- Logs must carry summaries, not raw PII or image payloads.

## Retention Rules

- `saved_results`: keep until tenant deletion or explicit retention cleanup. Use `retention_until` and `deleted_at` markers for future jobs.
- `tryon_events` and uploaded images: keep only while operationally needed.
- `privacy_audit_events`: keep for audit continuity after tenant deletion.
- Logs: keep short-lived and sanitized, never store secrets, raw payloads, or full image URLs.

## Export And Delete

- Export is tenant-scoped and must be served from the backend as the source of truth.
- Delete is tenant-scoped and must remove tenant tables plus storage objects for the org prefix.
- Merchant access is always checked against the current tenant slug and membership before any action is accepted.
