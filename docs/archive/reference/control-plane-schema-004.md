# Control-plane schema (migration 004)

**Status:** Reference. Describes migration `apps/dashboard/migrations/004_control_plane_tables.sql`.

## Purpose

Adds schema for the Restormel Keys control-plane model: Gateway key extensions, management keys, provider integrations and bindings, models and provider model variants, routes and route steps, policies and policy bindings, audit events, request logs, and usage aggregates.

## What is used immediately

- **api_keys** (existing; legacy table name — stores Gateway keys): Optional new columns for GatewayKey alignment (name, scope, status, created_by, last_used_at, expires_at, rotation_version). All nullable; existing rows unchanged. Table name kept for backwards compatibility.
- **audit_events**: Written on Gateway key create and revoke from `createApiKey` / `deleteApiKey`. Read via `listAuditEvents(workspaceId)` (API/dashboard can expose later).

## Phased groundwork (no service usage yet)

These tables are created and indexed but have no repository or API usage until features are built:

- **management_keys** — PATs for management API.
- **provider_integrations** — Upstream provider connections. **Secrets:** Only `credential_ref` (opaque reference); raw credentials must not be stored here (see [security-baseline.md](../security-baseline.md)).
- **provider_bindings** — Where a provider integration is allowed (project/environment).
- **models** — Canonical model catalog.
- **provider_model_variants** — Provider-specific model view.
- **routes**, **route_steps** — Route definition and steps.
- **policies**, **policy_bindings** — Governance rules and bindings.
- **request_logs** — For gateway/ingestion later.
- **usage_aggregates** — For aggregation jobs later.

## Secrets handling

- **Provider credentials:** Do not store raw API keys or tokens in `provider_integrations`. Use `credential_ref` to point at a vault path, encrypted blob id, or external secret store. See migration file header and [security-baseline.md](../security-baseline.md).
- **Gateway keys:** Continue to store only prefix + hash in `api_keys`; no raw key in DB or logs.

## Rollback

To revert migration 004, drop tables in reverse dependency order (see comment at top of `004_control_plane_tables.sql`). Then optionally drop the added columns on `api_keys` if you no longer need them. Backward compatibility: existing code paths do not depend on the new columns; only audit write depends on `audit_events` (and is wrapped in try/catch so key create/revoke still succeed if the table is missing).
