# Service admin operators (Allotment)

Internal Restormel Keys operators can bypass **subscription-style limits** (project count, monthly resolve quota) and **Pro dashboard gates** (e.g. System Health) so dogfooding is not blocked by Free tier caps.

## What gets waived

- **Entitlements:** High caps (999 projects, 10M monthly requests on the resolve path) and effective **Pro** plan for limit checks.
- **Pro features:** `hasProAccess` returns true (healthcheck, embedding gates).

This does **not** add customer-facing “admin” for tenant workspaces. It is only for trusted operator accounts.

## How to grant

Resolution order in code (any match grants operator status):

1. **Neon Auth / Better Auth `role`** — If `get-session` returns `user.role` as `admin`, `superadmin`, `service_admin`, or `operator` (case-insensitive), the session is treated as a service admin. Aligns with marking a user **Admin** in the Neon Auth console when that value is exposed on the session payload.

2. **Environment user IDs** — Set `RESTORMEL_SERVICE_ADMIN_USER_IDS` to a comma-separated list of Better Auth user IDs (same `id` as in the `"user"` / session user). Useful for Vercel without a DB migration.

3. **Environment owner emails** — Set `RESTORMEL_SERVICE_OWNER_EMAILS` to comma-separated sign-in emails (normalized case-insensitive). GitHub may return `…@gmail.com` or `…@googlemail.com` for the same mailbox; list both if needed. If this variable is **not set**, built-in primary-operator defaults apply (override by setting the env explicitly, including empty `RESTORMEL_SERVICE_OWNER_EMAILS=` to disable email-based grants). Allowlisted emails also receive a `service_admins` row on sign-in (`bootstrap:service_owner_email`).

4. **Database** — After migration **`023_service_admins.sql`**:

   ```sql
   INSERT INTO service_admins (user_id, note, created_at)
   VALUES ('<better-auth-user-id>', 'Allotment operator', EXTRACT(EPOCH FROM NOW()) * 1000);
   ```

## User management (UI)

Service owners signed in with a **session** open **`/keys/admin`** (avatar menu → **Admin**, or **Profile** link when you are an operator). The admin console is separate from the end-user dashboard sidebar; it includes **User management** and **Package registry** insights. The user list shows signed-in accounts from the app **`users`** mirror (populated on each Neon Auth session via `upsertUser`), enriched from Better Auth **`"user"`** when that table is populated; toggles **`service_admins`** membership. **Primary email allowlist** accounts cannot be demoted via the UI (change `RESTORMEL_SERVICE_OWNER_EMAILS` or Neon configuration instead). You cannot remove your own operator flag via the UI (use another operator account).

API (canonical): **`GET /keys/admin/api/users`**, **`PATCH /keys/admin/api/users/{userId}`** with body `{ "serviceOwner": true | false }` — session + operator only. Legacy paths **`/keys/dashboard/api/admin/users`** remain supported for existing automation.

## Verify

- Open **Subscription & Billing**: you should see **Pro (operator)** and the operator banner.
- Create more than two projects (Free cap) without a Paddle subscription.
- **System Health** should not be blocked by Pro env gates.

## Rollback

- Remove env entries, delete `service_admins` rows, or clear Neon Auth admin role.
- Redeploy or restart so `resolveServiceAdminStatus` re-evaluates.
