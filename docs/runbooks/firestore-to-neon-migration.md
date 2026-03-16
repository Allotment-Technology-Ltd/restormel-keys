# Firestore to Neon migration — Restormel Keys dashboard

This runbook covers switching the dashboard storage from **Firestore** to **Neon Postgres**, and optionally migrating existing data.

**Canonical:** This doc is the single source for Neon storage setup. See also [03-infrastructure-and-billing.md](../03-infrastructure-and-billing.md) for overall infra.

**Dashboard on Vercel + site on Cloudflare:** After Neon and Neon Auth are configured, to serve the dashboard from Vercel while the main site stays on Cloudflare, see [extraction-vercel.md](../reference/extraction-vercel.md) § "Current setup (1)" for wiring **KEYS_DASHBOARD_URL** and **NEON_AUTH_BASE_URL**.

---

## Manual configuration checklist

To get Neon DB working with the dashboard (storage **and** GitHub sign-in via Neon Auth), configure the following. Nothing here is committed; use local `apps/dashboard/.env` and deployment secrets.

| What | Where / how |
|------|------------------|
| **1. Neon schema** | Run once per database: Section 2 below (e.g. Neon MCP **run_sql**, or psql, or Neon Console). Creates `projects`, `api_keys`, and optional `users`. Neon Auth uses its own `neon_auth` schema (managed in Neon Console). |
| **2. `DATABASE_URL`** | Neon Postgres connection string. Get from Neon MCP **get_connection_string** (with your `projectId` and `databaseName: "neondb"`) or Neon Console → Connection details. Put in `apps/dashboard/.env` and deployment env. |
| **3. `NEON_AUTH_BASE_URL`** | From Neon Console: Project → Branch → **Auth** → enable Auth → **Configuration** → copy the Auth base URL (e.g. `https://ep-xxx.neonauth.region.aws.neon.tech/neondb/auth`). Put in `.env` and deployment env. |
| **4. Neon Auth + GitHub** | In Neon Console (Auth → OAuth providers), add **GitHub**. Create a [GitHub OAuth App](https://github.com/settings/developers) and set **Authorization callback URL** to your **dashboard** auth callback so the flow is proxied: e.g. `https://restormel.dev/keys/dashboard/api/auth/callback/github` (local: `http://localhost:5173/keys/dashboard/api/auth/callback/github`). Enter the GitHub **Client ID** and **Client Secret** in Neon Console (not in app env). |

After the above, restart the dashboard (and redeploy if applicable). Sign-in with GitHub will use Neon Auth (proxied at `/api/auth/*`) and store sessions/users in Neon.

---

## 1. Prerequisites

1. **Neon project** — Create one in [Neon Console](https://console.neon.tech) or use an existing project. For this repo the Neon project is typically named **restormel-keys** (project ID e.g. `green-sky-53569304`; your ID may differ).
2. **Neon MCP (optional)** — If you use Cursor with the Neon MCP enabled, you can list projects, run SQL, and get the connection string from the MCP instead of the Console.
3. **Dashboard dependencies** — The dashboard already includes `@neondatabase/serverless` and the migration file `apps/dashboard/migrations/001_initial.sql`. No extra install needed.

---

## 2. Schema (run once per Neon database)

The dashboard expects tables: `users` (optional, for future auth), `projects`, `api_keys`. Apply the migration once per database (e.g. default branch + `neondb`).

### Option A — Neon MCP (Cursor)

With the **Neon MCP** enabled:

1. **Get project ID** — Call **list_projects** (no args, or `search: "restormel-keys"`). Note the `id` of the project you want (e.g. `green-sky-53569304`).
2. **Run the migration** — Call **run_sql** for each statement below, with `projectId` set to that id and `databaseName: "neondb"` (or your database name). Run in this order:
   - `CREATE TABLE IF NOT EXISTS users ( id TEXT PRIMARY KEY, email TEXT, created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT );`
   - `CREATE TABLE IF NOT EXISTS projects ( id TEXT PRIMARY KEY, name TEXT NOT NULL, user_id TEXT NOT NULL, created_at BIGINT NOT NULL );`
   - `CREATE INDEX IF NOT EXISTS idx_projects_user_created ON projects(user_id, created_at DESC);`
   - `CREATE TABLE IF NOT EXISTS api_keys ( id TEXT PRIMARY KEY, project_id TEXT NOT NULL, key_prefix TEXT NOT NULL, key_hash TEXT NOT NULL, created_at BIGINT NOT NULL, CONSTRAINT fk_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE );`
   - `CREATE INDEX IF NOT EXISTS idx_api_keys_project_created ON api_keys(project_id, created_at DESC);`
3. **Verify** — Call **get_database_tables** with the same `projectId` and `databaseName`. Confirm `public.projects` and `public.api_keys` are listed.

(Full SQL is in `apps/dashboard/migrations/001_initial.sql` if you prefer to run statements from that file one by one.)

### Option B — psql

```bash
# From repo root, with DATABASE_URL set to your Neon connection string
cd apps/dashboard && psql "$DATABASE_URL" -f migrations/001_initial.sql
```

### Option C — Neon Console

In [Neon Console](https://console.neon.tech) → your project → **SQL Editor**, paste and run the contents of `apps/dashboard/migrations/001_initial.sql`.

---

## 3. Connection string and env

**Do not commit the connection string.** Store it only in local `.env` or deployment secrets.

### Getting the connection string

- **Neon MCP:** Use the **get_connection_string** tool with your `projectId` (and optional `branchId`, `databaseName`). Copy the result into `apps/dashboard/.env` as `DATABASE_URL`.
- **Neon Console:** Project → **Connection details** → copy the connection string (pooler recommended for serverless).

### Dashboard env

In `apps/dashboard/.env` (create from `.env.example`):

```env
# Neon storage
DATABASE_URL=postgresql://...

# Neon Auth (GitHub sign-in; OAuth configured in Neon Console)
NEON_AUTH_BASE_URL=https://ep-xxx.neonauth.region.aws.neon.tech/neondb/auth   # From Neon Console → Auth → Configuration
```

For **deployment**, set `DATABASE_URL` and `NEON_AUTH_BASE_URL` in the platform environment variables or secrets. Configure GitHub OAuth in **Neon Console** (Auth → OAuth providers). The GitHub OAuth App **Authorization callback URL** must be your dashboard’s auth callback (e.g. `https://restormel.dev/keys/dashboard/api/auth/callback/github`).

### Getting NEON_AUTH_BASE_URL (Neon MCP + API)

- **Neon Console (simplest):** Project → select branch (e.g. **production**) → **Auth** → **Configuration** → copy the **Auth base URL** (no trailing slash).
- **Neon MCP:** Use **list_projects** or **search** (`query: "restormel-keys"`) to get your `projectId`. Use **describe_project** with that ID to get the default branch ID. The MCP does not return the Auth base URL; use the Console or the API below.
- **Neon API (if you have an API key):** `GET https://console.neon.tech/api/v2/projects/{project_id}/branches/{branch_id}/auth` with `Authorization: Bearer $NEON_API_KEY`. The response includes `base_url` (your `NEON_AUTH_BASE_URL`). See [Manage Neon Auth via the API](https://neon.com/docs/auth/guides/manage-auth-api).

### Verify Neon Auth is provisioned (Neon MCP)

With the **Neon MCP** enabled you can confirm the `neon_auth` schema exists (Auth is provisioned):

1. **list_projects** (or **search** with `query: "restormel-keys"`) → note `projectId` (e.g. `green-sky-53569304`).
2. **run_sql** with `projectId`, `sql`: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'neon_auth' ORDER BY table_name;` → you should see tables such as `account`, `session`, `user`. If the query returns no rows, provision Auth in Neon Console (Project → Branch → Auth → enable) or use the MCP **provision_neon_auth** tool (once per branch/database).

---

## 4. Switching the dashboard to Neon (Stage 4)

You're ready for this step when: schema is applied (Section 2), `DATABASE_URL` and `NEON_AUTH_BASE_URL` are set (Section 3), and GitHub OAuth is configured in Neon Console (manual checklist).

**Do the switch:**

1. **Confirm env** — In `apps/dashboard/.env` (and deployment env): `DATABASE_URL` and `NEON_AUTH_BASE_URL` are set. No code change is required; the app uses Neon for data and proxies `/api/auth/*` to Neon Auth.
2. **Restart the dashboard** — Local: stop and run `pnpm run dev` (or your usual command) from the dashboard app. Deployed: trigger a redeploy or restart so the process picks up the env.
3. **Verify** — Open the [dashboard](https://restormel.dev/keys/dashboard), [Sign in](https://restormel.dev/keys/dashboard/login) with GitHub, create a project, and create a Gateway Key (Access). If all succeed, the dashboard is running on Neon for data and Neon Auth for sign-in.

**If you see "HTTP 503 Service Unavailable" on the login page:**

1. **Check the server terminal** after clicking "Sign in with GitHub":
   - If you see **`[auth] NEON_AUTH_BASE_URL is not set`** → the env var is not loaded. Fix: (1) Use **`apps/dashboard/.env`** (not repo root). (2) The line must be exactly `NEON_AUTH_BASE_URL=https://...` (no space around `=`, no quotes, no typo in the name). (3) The dashboard’s `vite.config.ts` sets `envDir` so `.env` is loaded from the dashboard directory even when the dev server is started from the monorepo root—restart the dev server after changing `.env`. If it still fails, start the server from the dashboard package: `cd apps/dashboard && pnpm run dev`.
   - If you see **`[auth] Neon Auth returned 503 for ...`** → the proxy is configured but Neon Auth is returning 503. Confirm in Neon Console: Project → Branch → **Auth** is enabled, and the **Auth base URL** in Configuration matches your `NEON_AUTH_BASE_URL` exactly (no trailing slash). Try opening `{NEON_AUTH_BASE_URL}/get-session` in a browser or with `curl` to see if the Auth service responds.

2. **Env file location:** When running `pnpm run dev`, the process must see `apps/dashboard/.env`. If you run from repo root via a workspace script, ensure the dashboard’s working directory is `apps/dashboard` or that env is passed through.

**If you see "404 Not Found" or "502" after returning from GitHub (URL contains `neon_auth_session_verifier`):**

- **Browser 404** (Chrome “This localhost page can’t be found”): The request is not reaching the SvelteKit app. Ensure the dev server is running from `apps/dashboard` (`cd apps/dashboard && pnpm run dev`) and you open `http://localhost:5173/keys/dashboard` (with base path). Restart the server after changing `.env`.
- **502 with JSON body** (`"Neon Auth callback returned 404"`): The callback route ran but Neon Auth did not recognize the path. The app tries `callback` then `callback/github`. Check `NEON_AUTH_BASE_URL` in Neon Console → Auth → Configuration (no trailing slash). If the problem persists, check Neon Auth / Better Auth docs for the exact callback path for your provider.

**If you see `error=session-verifier-not-found` after GitHub redirect:**

Neon Auth could not find the session verifier (expired, already used, or state mismatch). Use **Log out** in the sidebar (or the link in the error message) to clear any existing session, then **Sign in with GitHub** again for a fresh OAuth flow. Ensure `callbackURL` is an absolute URL (the app uses `window.location.origin + base + "/"`). In Neon Console → Auth → Domains, ensure your app URL (e.g. `http://localhost:5173`) is allowed.

For other failures: confirm DATABASE_URL is the correct Neon connection string (pooler for serverless); GitHub callback URL in your OAuth App matches the dashboard auth callback path.

---

## 5. Migrating existing Firestore data (optional)

If you already have projects and Gateway keys in Firestore and want them in Neon:

1. **Export from Firestore:** Use the Firebase Console or a script to read `projects` and each project’s `apiKeys` subcollection. Export to JSON or a format you can iterate over.
2. **Import into Neon:** For each project, `INSERT INTO projects (id, name, user_id, created_at) VALUES (...)`. For each Gateway key, `INSERT INTO api_keys (id, project_id, key_prefix, key_hash, created_at) VALUES (...)`. Use the same `id` values if you rely on existing URLs or references.
3. **Verify:** Run the dashboard with Neon and confirm projects and keys appear. Then switch off Firestore (set `USE_NEON_DB=true` and remove or stop using Firebase for this data).

A one-off script can be added under `apps/dashboard/scripts/` (e.g. `migrate-firestore-to-neon.ts`) that uses the Firebase Admin SDK to read and the Neon driver to write; keep it out of the main app and do not commit any credentials.

---

## 6. Rollback

To revert to Firestore: you would need to restore the previous data layer and auth (no longer in scope; the dashboard is Neon + Neon Auth only).

---

## 7. Security

- **Secrets:** Never commit `DATABASE_URL` or paste it into docs or chat. Use `.env` (gitignored) locally and deployment secrets in production.
- **Key storage:** Neon stores only `key_prefix` and `key_hash`; raw API keys are never persisted (same as Firestore). See [security-baseline.md](../security-baseline.md).
