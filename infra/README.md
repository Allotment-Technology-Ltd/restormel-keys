# Restormel Keys – GCP infra (Pulumi, legacy)

> **Status:** This stack is **legacy**. The dashboard now runs on **Vercel** with Neon (`DATABASE_URL`, `NEON_AUTH_BASE_URL` in Vercel env). Use this Pulumi stack **only for emergency rollback** or while decommissioning the old Cloud Run deployment. Do **not** run `pulumi up` for routine deploys.

Pulumi stack for the previous dashboard deployment (Cloud Run) and Artifact Registry on GCP. No load balancer; site is on Cloudflare Worker; dashboard was reached via direct Cloud Run URL or Worker proxy.

## Before any (rare) `pulumi up`

You should normally **not** need to run this stack anymore. If you temporarily re-enable the GCP path (for example, as a short-term rollback), do these steps before **any** `pulumi up` (first run or after changing infra):

1. **Build the program** — Pulumi runs the compiled `bin/index.js`, not `index.ts`. If you changed `index.ts`, run:
   ```bash
   cd infra && pnpm run build
   ```
   Skipping this can cause the wrong resources to be created or updated (e.g. repeated 403 on Secret Manager).
Then run `pulumi up` from the `infra` directory. Ensure dashboard env (DATABASE_URL, NEON_AUTH_BASE_URL) are set via Pulumi config secret refs or Cloud Run env; see [Neon setup](#neon-setup-dashboard-database--auth) below.

## Prerequisites

- [Pulumi CLI](https://www.pulumi.com/docs/install/) and login (`pulumi login`)
- [gcloud CLI](https://cloud.google.com/sdk/docs/install) and application default credentials:
  ```bash
  gcloud auth application-default login
  ```
- GCP project (e.g. `restormel-keys-prod`) with **billing** and required **APIs** enabled.

## Required GCP permissions

**Two different identities:**

1. **Identity running `pulumi up`** (your user or a service account) must have these permissions on the target project. If you see **403 Permission denied** for:

| Error / resource | Required permission / role |
|------------------|-----------------------------|
| `iam.serviceAccounts.create` | `roles/iam.serviceAccountAdmin` |
| (none; no load balancer) | — |
| `artifactregistry.repositories.create` | `roles/artifactregistry.admin` |
| Cloud Run service | `roles/run.admin` |

**Quick fix (project owner):** Grant your user or the service account used by Pulumi one of:

- **Option A – broad (easiest):** Project **Editor** or **Owner** on the project.
- **Option B – minimal:** Grant these roles on the project:
  - `roles/iam.serviceAccountAdmin`
  - `roles/artifactregistry.admin`
  - `roles/run.admin`

After changing IAM, **refresh Application Default Credentials** so Pulumi (and the GCP provider) use the updated permissions:

```bash
gcloud auth application-default login
```

Then run `pulumi up` again.

### Grant roles via gcloud (project owner runs this)

Replace `YOUR_EMAIL` (or the service account email) and `restormel-keys-prod`:

```bash
export PROJECT_ID=restormel-keys-prod
export PRINCIPAL="user:YOUR_EMAIL"   # or serviceAccount:SA_EMAIL

for role in roles/iam.serviceAccountAdmin roles/artifactregistry.admin roles/run.admin; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="$PRINCIPAL" \
    --role="$role"
done
```

Or in **GCP Console:** IAM & Admin → IAM → select the principal → Edit → Add another role → add the three roles above → Save.

2. **Deploy identity (GitHub Actions)** — the service account used by the Deploy workflow (WIF or key-based) must have **Artifact Registry Writer** and **Cloud Run Admin** on the same project so it can push the site image and deploy. See [docs/archive/infra-superseded/domain-mapping-restormel-dev.md](../docs/archive/infra-superseded/domain-mapping-restormel-dev.md) §9 (Troubleshooting: `uploadArtifacts` denied).

## Enable APIs

Ensure these APIs are enabled for the project:

```bash
gcloud services enable compute.googleapis.com run.googleapis.com artifactregistry.googleapis.com iam.googleapis.com secretmanager.googleapis.com --project=restormel-keys-prod
```

## Config and run

```bash
cd infra
pnpm run build          # compile TypeScript → bin/index.js (Pulumi runs this)
pulumi stack select production
pulumi config set gcp:project restormel-keys-prod
# optional: pulumi config set gcp:region europe-west2
pulumi up
```

**Important:** After any change to `index.ts`, run `pnpm run build` before `pulumi up`. Pulumi executes `bin/index.js`; if the build is stale, the wrong resources may be created or updated.

## Neon setup (dashboard database + auth)

The dashboard uses **Neon Postgres** for data (workspaces, projects, Gateway keys) and **Neon Auth** (sessions + GitHub OAuth, managed in Neon Console).

1. **Create a Neon project** at [Neon](https://neon.tech) and a database. Copy the connection string.
2. **Enable Neon Auth** in Neon Console: Project → Branch → **Auth** → enable and copy the **Auth base URL** (e.g. `https://ep-xxx.neonauth.region.aws.neon.tech/neondb/auth`). Add **GitHub** as an OAuth provider in the same Auth section (Client ID and Secret from your GitHub OAuth App).
3. **Store the connection string** in GCP Secret Manager (e.g. create secret `neon-database-url` with the value). Grant the dashboard service account access to read this secret if you use secret refs.
4. **Pulumi config:** Set secret refs so Cloud Run gets env at runtime, e.g.:
   - `pulumi config set DATABASE_URL_SECRET_REF neon-database-url`
   - `pulumi config set NEON_AUTH_BASE_URL_SECRET_REF neon-auth-base-url` (or set `NEON_AUTH_BASE_URL` as plain config if not secret)
   Create the corresponding secrets in Secret Manager. The dashboard only needs `DATABASE_URL` and `NEON_AUTH_BASE_URL`; GitHub credentials live in Neon Console.
5. **Run migrations once** against the Neon database: from repo root, `psql "$DATABASE_URL" -f apps/dashboard/migrations/001_initial.sql` (and optionally `002_better_auth.sql` if you had previously used in-app Better Auth; Neon Auth uses its own `neon_auth` schema).
6. **GitHub OAuth App:** Set **Authorization callback URL** to your dashboard’s auth callback: `https://<your-domain>/keys/dashboard/api/auth/callback/github` so the OAuth flow is proxied through the app.

See **docs/archive/reference/phase-3-manual-steps.md** §B and **docs/archive/reference/phase-3-deployment.md** §5.2 and §5.4 for troubleshooting.
