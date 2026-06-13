# Restormel Keys — minimum viable refactor path

**Purpose:** Smallest safe sequence of steps from current repo state toward the target control-plane architecture. Grounded in [restormel-repo-audit-and-gap-analysis.md](restormel-repo-audit-and-gap-analysis.md).

**Status:** Reference. Use for phased implementation and first-task selection.

---

## 1. Architectural constraints found in repo

| Constraint | Location | Implication |
|------------|----------|-------------|
| **Better Auth owns `user` table** | `002_better_auth.sql`: `"user"` (id, name, email, …). Auth uses this. | App-level `users` in neon.ts is separate: id, email, created_at. Either (a) add a `users` migration for app use, or (b) use Better Auth `user` and stop calling `upsertUser` if it duplicates. |
| **upsertUser called on every authenticated request** | `hooks.server.ts` → `upsertUser(session.user.id, session.user.email)`. | If `users` table is missing, requests fail after login. Repo must have a migration that creates `users` (or drop upsertUser and use `user` from Better Auth everywhere). |
| **Projects keyed by user_id** | `projects.user_id`; all list/create/get filter by `locals.user.uid`. | Workspace introduction: add `workspace_id` to projects; default one workspace per user at first; keep user_id for ownership. |
| **api_keys table: project_id, key_prefix, key_hash** | `001_initial.sql`, neon.ts. | Keys are project-scoped. Renaming to “Gateway Key” is copy/type only; table can stay `api_keys` until a later migration to `gateway_keys` + optional scope columns. |
| **Key format rk_*** and hash (SHA-256)** | neon.ts KEY_PREFIX, hashKey(). | No change to format or hashing for backward compatibility. Zuplo and clients expect `rk_...`. |
| **No gateway key verification in dashboard** | Zuplo validates consumer keys; dashboard API uses session or backend key. | Backend key is one of the project keys. Verification is in middleware/API (session vs Bearer). No change needed for key taxonomy rename. |
| **Dashboard base path** | `/keys/dashboard`. | All routes and links use `base`; nav and docs assume this. Keep. |
| **Paddle billing** | `apps/dashboard/src/lib/server/billing/paddle.ts`, checkout/webhook. | Leave as-is. Forecasting/calculator are additive. |
| **Zuplo runbooks** | `KEYS_BACKEND_API_KEY` = dashboard key. | Rename in docs to “backend Gateway Key”; env var name can stay for compatibility. |

---

## 2. Minimum viable refactor path (summary)

- **Rename first:** “API key” → “Gateway Key” in dashboard UI, copy, and runbooks (and optional API response labels). No schema change.
- **Fix schema:** Add `users` table migration (or switch to Better Auth `user` and remove `upsertUser`).
- **Then hierarchy:** Workspace (one per user), then Environment (dev/prod per project), then expand nav and project detail.
- **Then new surfaces:** Access section (move Gateway Keys there), Provider Integrations (new), then Models, Routes, Policies, Logs/Analytics in order.

---

## 3. What can remain as-is temporarily

| Area | Leave as-is |
|------|-------------|
| **Table name `api_keys`** | Keep. Rename to `gateway_keys` in a later migration when adding scope columns. |
| **Key format and hashing** | `rk_...`, SHA-256, prefix+hash only. No change. |
| **Project detail URL** | `/projects/[id]`. Keys can stay on project detail as “Gateway keys (scoped to this project)” until Access section exists. |
| **Billing** | Paddle checkout and webhook. No change. |
| **Core package** | `KeyConfig`, `ProviderDefinition`, router, cost — no structural change for Phase 1. |
| **Embeddables (Svelte, React, Elements)** | KeyManager still manages **provider** keys client-side. No change until Provider Integrations backend exists. |
| **CLI** | Commands stay; add “gateway key” wording in help and responses when dashboard exposes Gateway Keys. |
| **Zuplo env var name** | `KEYS_BACKEND_API_KEY` can stay; document as “backend Gateway Key”. |
| **Usage page** | Placeholder. Replace when RequestLog/UsageAggregate exist. |
| **Demo apps** | No change for key taxonomy; they use provider keys, not Gateway Keys. |

---

## 4. What must be renamed immediately

| Current | Rename to | Where |
|--------|-----------|--------|
| “API key” (Restormel auth) | “Gateway Key” | Dashboard: layout welcome, overview, projects list/detail, key section headings, empty states, confirmations, runbooks (zuplo-setup, zuplo-launch-cli), dashboard README. |
| “Generate API key” | “Create Gateway Key” / “Generate Gateway Key” | Project detail CTA and button. |
| “API keys” (section title) | “Gateway keys” | Project detail. |
| “Revoke this API key?” | “Revoke this Gateway key?” | Confirm dialog. |
| “Backend API key” in runbooks | “Backend Gateway Key” (or “Gateway key used by Zuplo”) | docs/runbooks. |

**Do not rename:**  
- External env vars (`KEYS_BACKEND_API_KEY`, `PADDLE_API_KEY`).  
- DB table/column names in the first slice (optional later migration).  
- “API key” where it clearly means **provider** API key (e.g. OpenAI key in docs); prefer “Provider credential” there.

---

## 5. Unavoidable backend/data changes

| Change | When | Notes |
|--------|------|--------|
| **`users` table** | Phase 0 | Add migration `003_users.sql`: `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT, created_at BIGINT);` — or remove `upsertUser` and use Better Auth `user` only (then audit all `user_id`/userId usage). |
| **workspace + project.workspace_id** | Phase 2 | New table `workspaces`; add `workspace_id` to `projects`; backfill one workspace per user. |
| **environments** | Phase 3 | New table `environments(project_id, name, type, ...)`; seed dev/prod per project. |
| **Gateway key scope (optional)** | Later | Add `workspace_id`, `environment_id` nullable to keys table when Access is workspace-level. |
| **Provider integrations, routes, policies, logs** | Phases 4+ | New tables per audit; no change to existing tables except FKs from new ones. |

---

## 6. Unavoidable frontend/nav changes

| Change | When | Notes |
|--------|------|--------|
| **Copy: “API key” → “Gateway Key”** | Phase 1 | All user-facing strings in dashboard and linked runbooks. |
| **Add “Access” to nav** | Phase 2 or 4 | When Gateway Keys are listed at workspace level (or keep under Projects and add Access as a stub linking to project keys). |
| **Project detail structure** | Phase 3 | Add Environments (tab or section); later add Routes, Policies, Models, Usage, Logs, Settings per wireframe. |
| **New nav items** | Phases 4–5+ | Provider Integrations, Models, Routes, Policies, Analytics, Logs & Traces, Lifecycle, Documentation — as backend and data exist. |

Minimum first: copy and key taxonomy (Phase 1). Then schema fix (Phase 0). Then workspace/environment and nav (Phases 2–3).

---

## 7. What can be feature-flagged

| Feature | Flag idea | Use |
|---------|-----------|-----|
| Workspace switcher | Hide until multi-workspace (invites/teams) exists | Avoid empty UX. |
| Environment switcher | Hide or show “Default” until environments are meaningful | Ship envs in DB first, then switcher. |
| Access as top-level section | Show as “Access (Gateway keys)” only when list is workspace-scoped | Or always show and list keys by project. |
| Provider Integrations UI | Gate “Connect provider” behind flag if backend is not ready | Usually not needed; ship when backend is ready. |
| New nav items (Models, Routes, etc.) | Add nav items as stubs (empty state) or hide until backend exists | Prefer stubs with “Coming soon” over hiding. |

---

## 8. Where backward compatibility matters

| Area | Requirement |
|------|-------------|
| **Existing keys** | All existing `rk_...` keys must keep working. No change to format, hash algorithm, or validation. |
| **Dashboard API** | `GET/POST/DELETE /api/projects/[id]/keys` — response shape can add a label like `type: "gateway"`; do not remove or rename `keyPrefix`, `rawKey` (POST). |
| **Zuplo** | Backend key continues to be one of the project Gateway Keys; no change to header or env var name. |
| **CLI / SDK** | No breaking change to existing commands or types for key taxonomy; add wording only. |
| **Migrations** | Additive migrations only; no drop of `api_keys` or `projects` until a dedicated migration and data backfill. |

---

## 9. Recommended order of migrations

| Order | Migration | Purpose |
|-------|-----------|---------|
| 1 | **003_users.sql** (or remove upsertUser) | Align DB with neon.ts / hooks so authenticated requests don’t fail. |
| 2 | **004_workspaces.sql** | `workspaces(id, name, user_id, created_at)`; add `workspace_id` to `projects`; backfill one workspace per user. |
| 3 | **005_environments.sql** | `environments(id, project_id, name, type, created_at)`; seed dev/prod per project. |
| 4 | (Later) **00X_gateway_keys_rename.sql** | Optional: rename `api_keys` → `gateway_keys`, add `workspace_id`/`environment_id` nullable. |
| 5+ | provider_integrations, provider_bindings, models, routes, policies, request_logs, usage_aggregates, etc. | Per audit implementation order. |

---

## 10. Proposed phases

### Phase 0 — Schema and stability (1–2 days)

- Resolve `users` table: add migration `003_users.sql` with `users(id, email, created_at)` and keep `upsertUser`, or remove `upsertUser` and use Better Auth `user` everywhere (and fix any code that expects `users`).
- Verify: sign in, create project, create key, revoke key still work.

**Code areas:** `apps/dashboard/migrations/`, `apps/dashboard/src/lib/server/neon.ts`, `apps/dashboard/src/hooks.server.ts`, `apps/dashboard/src/lib/server/db.ts`.

**Risk:** If production already has a `users` table, 003 must be `IF NOT EXISTS` or no-op.

---

### Phase 1 — Key taxonomy rename (1–2 days)

- Rename all user-facing “API key” to “Gateway Key” in dashboard and runbooks (where it means Restormel auth).
- No schema or API contract change. Optional: add `type: "gateway"` in API response for keys.

**Code areas:**

- `apps/dashboard/src/routes/+layout.svelte` (welcome copy)
- `apps/dashboard/src/routes/+page.svelte` (overview empty state)
- `apps/dashboard/src/routes/projects/+page.svelte` (description, empty state)
- `apps/dashboard/src/routes/projects/[id]/+page.svelte` (section title, descriptions, buttons, confirm, empty state)
- `docs/runbooks/zuplo-setup.md`, `docs/runbooks/zuplo-launch-cli.md` (backend key wording)
- `apps/dashboard/README.md`

**Risk:** None. Copy-only.

---

### Phase 2 — Workspace (2–3 days)

- Add `workspaces` table; add `workspace_id` to `projects`; backfill one workspace per user; update listProjects/createProject/getProject and API.
- Dashboard: create default workspace on first project create if needed; optionally show workspace name in nav or project list (can be minimal).

**Code areas:** New migration, `neon.ts`, `db.ts`, `/api/projects` and project load functions, dashboard project list/detail (optional workspace label).

**Risk:** Migration must run before deploy; backfill must not fail (one workspace per distinct user_id).

---

### Phase 3 — Environment (2–3 days)

- Add `environments` table; seed dev/prod per project (and for existing projects).
- Project detail: add “Environments” section or tab (list dev/prod); no routing yet.

**Code areas:** New migration, neon.ts, project detail page (new section/tab).

**Risk:** Low. Additive.

---

### Phase 4 — Access section and nav (1–2 days)

- Add “Access” to left nav. Either: (a) workspace-level “Gateway keys” list (aggregate from all projects) or (b) link to project-scoped keys until workspace-level keys exist.
- Optionally move “Gateway keys” from project detail to Access and keep project detail “Access” tab as filtered list.

**Code areas:** `+layout.svelte` (nav), new route e.g. `access/+page.svelte` and optional `access/gateway-keys/+page.svelte`.

**Risk:** Low. Mostly nav + routing.

---

### Phase 5+ — Provider Integrations, Model catalog, Routes, Policies, Logs, Analytics, Lifecycle, Billing, Docs, Onboarding

- As in audit: Provider Integration storage and UI, then Model catalog, Routes, Policies, RequestLog/UsageAggregate, then Lifecycle, Billing/forecasting, in-dashboard Documentation, then onboarding flow and docs IA.
- Each as a separate phase with its own migrations and code areas.

---

## 11. Per-phase code areas affected

| Phase | Migrations | Server (neon, db, API) | Dashboard UI (routes, layout) | Docs / runbooks |
|-------|------------|------------------------|--------------------------------|------------------|
| 0 | 003_users (or remove upsertUser) | neon.ts, hooks.server.ts, db.ts | — | — |
| 1 | — | — (optional response field) | Layout, overview, projects list/detail | zuplo-setup, zuplo-launch-cli, dashboard README |
| 2 | 004_workspaces | neon, db, projects API and load | Project list/detail, optional workspace | — |
| 3 | 005_environments | neon, project load | Project detail (Environments) | — |
| 4 | — | — or key list API | Layout nav, access route(s) | — |
| 5+ | Per capability | New tables and APIs | New nav and pages | As needed |

---

## 12. Risk notes

- **Phase 0:** If `users` already exists in production, migration must be idempotent (`IF NOT EXISTS`) or skipped.
- **Phase 2:** Backfill workspace: ensure every project gets a workspace_id; handle users with no projects (no backfill row needed for them).
- **Phase 1:** Runbooks are used by operators; keep “backend Gateway Key” and “create a Gateway key in the dashboard” clear so Zuplo setup still works.
- **Backward compatibility:** No removal of or change to existing key storage/validation; only additive migrations and copy/type renames.

---

## 13. First implementation task to execute

**Task:** **Phase 0 — Add `users` table migration and verify auth + project + key flow.**

Steps:

1. Add `apps/dashboard/migrations/003_users.sql`:
   - `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT, created_at BIGINT);`
   - (Match column names and types to what `neon.ts` upsertUser uses.)
2. Document in migration comment that this is the app-level users table used by `upsertUser` (distinct from Better Auth `user` if needed).
3. Run migrations (or apply 003 manually in dev/staging).
4. Smoke test: sign in with GitHub → create project → create Gateway key (still labeled “API key” until Phase 1) → revoke key. Confirm no DB errors.

**Alternative first task:** If you prefer to ship the rename first (no migration risk), do **Phase 1 — Key taxonomy rename** as the first implementation task: change all dashboard and runbook copy from “API key” to “Gateway Key” as in §4, then run Phase 0 before introducing workspaces.

**Recommendation:** Execute Phase 0 first so the repo is schema-consistent and safe for all subsequent phases; then Phase 1 (rename) so the product language matches the target model before adding new structure.

---

## 14. Migration note (key taxonomy refactor, applied)

- **Stored data:** No change. Table `api_keys` and columns unchanged; key format `rk_...` and hash algorithm unchanged.
- **API:** Additive only. `GET /api/projects/[id]/keys` and `POST` (create) responses may include `type: "gateway"`. Existing clients can ignore it; `keyPrefix` and `rawKey` unchanged.
- **Env vars:** No renames (`KEYS_BACKEND_API_KEY` unchanged).
- **Copy/docs:** User-facing “API key” (Restormel auth) → “Gateway Key”; “API key” (provider) → “Provider credential” where clarified. No client action required.
