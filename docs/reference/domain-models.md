---
title: Canonical domain models
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-03-16
last-reviewed: 2026-06-13
review-interval: P12M
---

# Canonical domain models

**Status:** Reference. Canonical types live in code; this doc points to them and describes current persistence.

**Source of truth:** [packages/core/src/domain.ts](../../packages/core/src/domain.ts). Types are exported from `@restormel/keys`.

## Purpose

The control-plane product model uses consistent nouns across UI, API, CLI, and docs. Domain types in `@restormel/keys` define the canonical shape for:

- Workspace, Project, Environment  
- GatewayKey, ManagementKey  
- ProviderIntegration, ProviderBinding  
- Model, ProviderModelVariant  
- Route, RouteStep  
- Policy, PolicyBinding  
- RequestLog, UsageAggregate, AuditEvent  
- CustomerTenant, ExposureRule  
- PricingRecord, RateLimitRecord, LifecycleEvent  

See [restormel-dashboard-docs-data-onboarding.md](restormel-dashboard-docs-data-onboarding.md) § Data model for field-level semantics.

## Current persistence mapping

| Domain type     | Persisted? | Where | Notes |
|----------------|------------|--------|--------|
| Workspace      | Yes        | `apps/dashboard`: `workspaces` table | One default workspace per user (migration 003). |
| Project        | Yes        | `apps/dashboard`: `projects` table | Has `user_id` and `workspace_id`; aligns to domain.Project subset. |
| Environment    | Yes        | `apps/dashboard`: `environments` table | Dev and prod per project (migration 003, seeded on create). |
| GatewayKey     | Yes        | `apps/dashboard`: `api_keys` table | Optional columns added in 004 (name, scope, status, etc.); prefix + hash only, no raw key. |
| ManagementKey  | Yes (table only) | `apps/dashboard`: `management_keys` | Phased groundwork (migration 004). |
| ProviderIntegration | Yes (table only) | `apps/dashboard`: `provider_integrations` | Phased groundwork; credential_ref only, no raw secrets (004). |
| ProviderBinding   | Yes (table only) | `apps/dashboard`: `provider_bindings` | Phased groundwork (004). |
| Model, ProviderModelVariant | Yes (table only) | `apps/dashboard`: `models`, `provider_model_variants` | Phased groundwork (004). |
| Route, RouteStep | Yes (table only) | `apps/dashboard`: `routes`, `route_steps` | Phased groundwork (004). |
| Policy, PolicyBinding | Yes (table only) | `apps/dashboard`: `policies`, `policy_bindings` | Phased groundwork (004). |
| RequestLog     | Yes (table only) | `apps/dashboard`: `request_logs` | Phased groundwork; ingestion from gateway later. |
| UsageAggregate | Yes (table only) | `apps/dashboard`: `usage_aggregates` | Phased groundwork; aggregation job later. |
| AuditEvent     | Yes        | `apps/dashboard`: `audit_events` | Written on Gateway key create/revoke; see [control-plane-schema-004.md](../archive/reference/control-plane-schema-004.md). |
| CustomerTenant, ExposureRule | No | — | Placeholder. |
| PricingRecord, RateLimitRecord, LifecycleEvent | No | — | Placeholder. |

When adding persistence for a new entity, add a migration and update this table. Keep types in `domain.ts` as the single source of shape; map DB rows to these types in the data layer.

## Using the types

- **Backend / API:** Import from `@restormel/keys` (e.g. `import type { Project, GatewayKey } from "@restormel/keys"`) for response shapes and service boundaries.
- **Frontend:** Same; use domain types for props and API client types so naming stays aligned with docs and UI.
- **Migrations:** When introducing a new table, align columns to the camelCase field names in domain (or document the snake_case mapping in the migration).
