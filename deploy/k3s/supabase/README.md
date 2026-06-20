# Self-hosted Supabase on K3s (PlotBudget) — sovereign migration manifests

> **Config authoring only. No infra is applied by this PR.** Reviewable Kubernetes manifests
> for Phase B (B2) of the sovereign K3s migration — self-hosting the full Supabase stack for
> PlotBudget, **Option 1** of the ADR in `planning/full-migration-plan-k3s.md` §B. Apply happens
> later, via GitOps (Argo CD), gated by the founder.

Source of truth: `planning/full-migration-plan-k3s.md` §B (the Option-1 decision + the RLS /
auth / extensions findings) and `planning/k3s-cluster-target-design.md` §4.1 (the dedicated
`pg-plotbudget` CNPG cluster).

## Shape

Standard self-hosted Supabase, **minus its bundled Postgres** — every service is pointed at the
**`pg-plotbudget` CloudNativePG cluster** (design §4.1), reached at
`pg-plotbudget-rw.data.svc.cluster.local:5432`. Kong is the single public entrypoint.

| File | Service | Image (pinned, checked 2026-06-20) |
|---|---|---|
| `30-auth-gotrue.yaml` | GoTrue (auth) | `supabase/gotrue:v2.189.0` |
| `40-rest-postgrest.yaml` | PostgREST | `postgrest/postgrest:v14.12` |
| `50-storage.yaml` | Storage API + imgproxy | `supabase/storage-api:v1.60.4`, `darthsim/imgproxy:v3.30.1` |
| `60-realtime.yaml` | Realtime | `supabase/realtime:v2.102.3` |
| `70-kong.yaml` | Kong gateway | `kong/kong:3.9.1` |
| `80-meta-studio.yaml` | postgres-meta + Studio | `supabase/postgres-meta:v0.96.6`, `supabase/studio:2026.06.03-sha-0bca601` |
| `90-functions-email-hook.yaml` | send-resend-email (GoTrue hook) | `supabase/edge-runtime:v1.69.12` |

Secrets (`10-externalsecret.yaml`) and non-secret config (`20-config.yaml`) are shared. **No real
secret values are in git** — all auth/JWT/DB/OAuth/S3 secrets arrive via ESO ← Infisical
(placeholders + refs only).

> Pinned tags track the upstream `supabase/supabase` self-hosted `docker/docker-compose.yml`
> at the time of writing. Re-verify against that file (and PlotBudget's hosted versions —
> GoTrue 2.186 / Storage 1.37 / PostgREST 14.1 / PG 17.6.1 per the §B deep-dive) before apply;
> pin GoTrue/PostgREST/Storage **at or above** the hosted versions to avoid a downgrade on import.

---

## Storage backend choice — Hetzner Object Storage (S3), not in-cluster MinIO

**Decision: back Storage with Hetzner Object Storage (S3-compatible, `hel1`).** Justification:

- The cluster **already uses Hetzner Object Storage** (`hel1.your-objectstorage.com`) for CNPG
  Barman WAL/PITR (design §4.3). Reusing it means **one object store, one set of creds, one
  egress/billing surface** — no second storage system to operate, secure, back up, and monitor.
- The boxes are small (8 GB; `.150` is the tightest at ~24 GB disk free). An **in-cluster MinIO**
  StatefulSet would consume RAM + a CSI PVC and become its own single-writer durability + backup
  problem on already-constrained nodes — exactly the kind of avoidable moving part the design
  warns against.
- Hetzner Object Storage is **EU (Helsinki)**, S3v4, with 1 TB + 1 TB egress included — far above
  the Vault/avatars footprint. Keeps the sovereignty story clean (off Supabase cloud → Hetzner EU).
- Trade-off vs MinIO: Storage talks to the object store over the network rather than a local
  socket (marginally higher latency, fine for document/avatar workloads), and the bucket
  (`plotbudget-storage`) must be pre-created with the right ACL. Acceptable for this workload.

Config: `STORAGE_BACKEND=s3`, `STORAGE_S3_ENDPOINT=https://hel1.your-objectstorage.com`,
`STORAGE_S3_FORCE_PATH_STYLE=true`, region `hel1` (`20-config.yaml`); creds via the
`supabase-storage-s3` ExternalSecret. The two buckets — `vault-documents` (private,
household-scoped RLS) and `avatars` (public) — map to prefixes/policies inside the single
`plotbudget-storage` bucket; bucket rows + object RLS live in the `storage` schema on
`pg-plotbudget`.

---

## How RLS (`auth.uid()`) keeps working — unchanged

This is the whole point of Option 1. The §B deep-dive found **42 tables RLS-enabled, 158
policies, every one keyed on `auth.uid()` (171 occurrences); ZERO `auth.jwt()`/`auth.role()`/
`request.jwt.claims`.** RLS is enforced **by Postgres**, not by Supabase services — so it ports
**verbatim** as long as the Supabase Postgres primitives exist in `pg-plotbudget`:

- **`auth.uid()`** is a SQL function in the `auth` schema that reads
  `current_setting('request.jwt.claim.sub', true)`. PostgREST/GoTrue set that GUC from the
  verified JWT on each request. Because GoTrue still signs and PostgREST still verifies with the
  **same `JWT_SECRET`** (carried over as `SUPABASE_JWT_SECRET` — see below), `auth.uid()` resolves
  exactly as it does on hosted Supabase. **No policy is rewritten.**
- The `authenticated` / `anon` / `service_role` roles and the `request.jwt.*` GUC mechanism must
  exist on `pg-plotbudget` (see the audit gap below) — once they do, all 158 policies apply as-is.
- **Mandatory revalidation** (full-migration-plan §B/§D): after migrating `auth.*` + `public.*`,
  run **positive AND negative** RLS tests — a user can read their own household's rows, and
  **cannot** read another household's. This is a security boundary over real financial data; it
  gets a formal, tested cutover runbook.

> **Same `JWT_SECRET` is load-bearing.** `JWT_SECRET` in `supabase-core` MUST equal PlotBudget's
> existing `SUPABASE_JWT_SECRET`, or every already-issued session token becomes invalid at
> cutover and `auth.uid()` returns null (RLS denies everything). Carry the secret over; do not
> regenerate it during the infra move.

---

## ⚠️ Roles / extensions audit gap (founder + apply-time flag)

Stock **CloudNativePG runs the upstream `postgres` image**, which does **not** ship the Supabase
layer. The hosted Supabase Postgres image bundles roles, schemas, and extensions that PlotBudget's
schema depends on implicitly. **The `pg-plotbudget` CNPG cluster must provide these before the
Supabase services or the RLS policies will work.** What we confirmed vs what is a gap:

**Confirmed from the 82 migrations (read-only audit, 2026-06-20):**
- Only **`uuid-ossp`** is ever `CREATE EXTENSION`-ed explicitly. ✅ (matches §B)
- `auth.uid()` × 171; **no** `auth.jwt()` / `auth.role()`. ✅
- Roles referenced: `authenticated` (×32 GRANTs), `service_role` (×3), `anon` (×3).

**The gap — provided implicitly by hosted Supabase, NOT by stock CNPG, and therefore must be
added to the CNPG bootstrap (`postInitSQL` / a custom image):**
- **Roles**: `supabase_admin`, `authenticator`, `anon`, `authenticated`, `service_role`,
  `supabase_auth_admin`, `supabase_storage_admin` — GoTrue/PostgREST/Storage and the RLS GRANTs
  assume these exist with the right membership/login attributes.
- **Schemas**: `auth` (the `auth.users` FK target + the `handle_new_user()` provisioning trigger),
  `storage` (bucket/object tables + RLS), `graphql_public`, `extensions`, `realtime`.
- **The `auth.uid()` / `auth.role()` SQL helper functions** + the `request.jwt.*` GUC convention —
  installed by GoTrue/Supabase's migrations, not present on a blank CNPG database.
- **Extensions** that Supabase normally pre-installs:
  - `pgjwt` — used by Supabase's auth SQL helpers. **May need a custom CNPG image** (not in the
    stock `postgres` image / not on the default CNPG extension allowlist). **FLAG.**
  - `pg_graphql` — backs the `/graphql/v1` route. Not in stock CNPG → **custom image. FLAG.**
    (PlotBudget makes only 3 `.rpc()` calls and may not use GraphQL — confirm; if unused, the
    `graphql-v1` Kong route + this extension can be dropped.)
  - `pgvector` — **not used by PlotBudget** (§B: "essentially none … `uuid-ossp` only"), so it is
    **not required** for PlotBudget. Listed here only because the task asked to confirm: **pgvector
    is NOT needed** for this database. (It IS relevant elsewhere in the stack — SurrealDB carries
    the vector workload — but not for pg-plotbudget.)
  - `pgcrypto` / `pgsodium` — GoTrue may expect these for encryption helpers; verify against the
    GoTrue version's migrations.

**Recommended treatment:** build a **CNPG-compatible image** that layers the Supabase
roles/schemas/extensions onto the CNPG base (or run Supabase's `db/init` + GoTrue/Storage/Realtime
migrations as CNPG `bootstrap.initdb.postInitApplicationSQL` against `pg-plotbudget`), then restore
PlotBudget's `auth.*` + `public.*` + `storage.*` data on top. **This image/bootstrap is a
prerequisite of B2 and is NOT in this PR** — it is the single biggest apply-time dependency. Until
it exists, do not apply these manifests against a blank CNPG database.

---

## OAuth (Google / Apple) — re-registration required on self-hosted GoTrue

PlotBudget uses **Google + Apple** OAuth via hosted Supabase. On self-hosted GoTrue the OAuth
**callback URL changes** to the self-hosted domain, so each provider must be **re-registered**:

1. In Google Cloud Console / Apple Developer, add the new authorized redirect URI:
   **`https://api.plotbudget.com/auth/v1/callback`** (the `<API_EXTERNAL_URL>/auth/v1/callback`
   — `20-config.yaml`; `api.plotbudget.com` is the placeholder production domain, see below).
2. Put the (possibly new) client IDs/secrets into Infisical → they flow via the `supabase-auth`
   ExternalSecret into `GOTRUE_EXTERNAL_GOOGLE_*` / `GOTRUE_EXTERNAL_APPLE_*` (`30-auth-gotrue.yaml`).
3. Existing users' linked OAuth **identities migrate with `auth.identities`** (part of the
   `auth.*` data migration); re-registration only re-points the *provider app*, it does not relink
   users — provided the provider account (Google sub / Apple sub) is unchanged.

Keep the hosted Supabase project warm until OAuth sign-in is verified end-to-end on self-host.

---

## `send-resend-email` GoTrue email-hook redeploy

PlotBudget's one edge function, **`send-resend-email`, IS the GoTrue Send-Email Hook** (HMAC,
`verify_jwt=false`) — GoTrue calls it to send mail; the app never `functions.invoke`s it
(full-migration-plan §B). On self-host it must be **redeployed and re-wired**:

- It runs on the Edge Runtime (`90-functions-email-hook.yaml`), served at
  `http://send-resend-email.supabase.svc.cluster.local:9000/send-resend-email`.
- GoTrue is wired to it via `GOTRUE_HOOK_SEND_EMAIL_ENABLED=true` +
  `GOTRUE_HOOK_SEND_EMAIL_URI` (`20-config.yaml`) + the HMAC secret
  `GOTRUE_HOOK_SEND_EMAIL_SECRETS` == `SEND_EMAIL_HOOK_SECRET` (shared via the `supabase-auth`
  ExternalSecret). **Re-issue this HMAC secret** on self-host — the hosted hook secret does not
  carry over.
- **Apply-time prerequisites (not in this PR):**
  - Mount the real function source (`supabase/functions/send-resend-email/`) into the Edge Runtime
    pod — bake it into a custom image or mount a ConfigMap/PVC. The manifest uses an `emptyDir`
    **placeholder** for the `functions` volume; replace it.
  - Add `RESEND_API_KEY` to the `supabase-auth` ExternalSecret (Resend send credential).

---

## Known apply-time TODOs (documented placeholders, intentionally not "fixed" in this PR)

- **CNPG Supabase image/bootstrap** for the roles/schemas/extensions gap above — the gating item.
- **Discrete DB passwords** for Realtime (`DB_PASSWORD`) and postgres-meta (`PG_META_DB_PASSWORD`)
  / Studio: these services read a discrete password, not a full URL. The manifests reference
  `DB_PLOTBUDGET_URL` as a placeholder; add discrete `REALTIME_DB_PASSWORD` /
  `PG_META_DB_PASSWORD` keys to the ESO `supabase-core` set at apply, or split the URL via an init.
- **PlotBudget production domain** (`api.plotbudget.com` / `app.plotbudget.com`) is a **placeholder**
  — an open question in the design (§3.5 / §10 "PlotBudget production domain TBD"). It feeds the
  Ingress host, GoTrue `SITE_URL`/`API_EXTERNAL_URL`, the OAuth redirect URIs, and the JWT
  `SITE_URL`. Confirm with the founder before apply.
- **Next.js app cutover** (off Vercel) + the `auth.*`/`public.*`/`storage.*` data migration +
  the RLS revalidation runbook are separate B2 steps, not these manifests.

## Apply order (later, not now)

`00 → 10 (after cluster-wide ESO + the Infisical bootstrap secret + the pg-plotbudget CNPG
cluster with the Supabase bootstrap exist) → 20 → 30 → 40 → 50 → 60 → 70 → 80 → 90 → 95`.
