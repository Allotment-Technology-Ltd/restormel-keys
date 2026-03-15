# Restormel Keys – GCP infra (Pulumi)

Pulumi stack for dashboard (Cloud Run) and Artifact Registry on GCP. No load balancer; site is on Cloudflare Worker; dashboard is reached via direct Cloud Run URL or Worker proxy.

## Before every `pulumi up`

Do these **every time** you are about to run `pulumi up` (first run or after changing infra):

1. **Build the program** — Pulumi runs the compiled `bin/index.js`, not `index.ts`. If you changed `index.ts`, run:
   ```bash
   cd infra && pnpm run build
   ```
   Skipping this can cause the wrong resources to be created or updated (e.g. repeated 403 on Secret Manager).
2. **One-time only: grant Firebase secret access** — If the dashboard service account does not yet have access to the Firebase Admin secret, run once from repo root:
   ```bash
   ./infra/grant-firebase-secret-access.sh
   ```
   See [Secret Manager: Firebase secret access (one-time)](#secret-manager-firebase-secret-access-one-time) below. If Cloud Run already starts successfully, you can skip this.

Then run `pulumi up` from the `infra` directory.

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

2. **Deploy identity (GitHub Actions)** — the service account used by the Deploy workflow (WIF or key-based) must have **Artifact Registry Writer** and **Cloud Run Admin** on the same project so it can push the site image and deploy. See [docs/domain-mapping-restormel-dev.md](../docs/domain-mapping-restormel-dev.md) §9 (Troubleshooting: `uploadArtifacts` denied).

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

## Secret Manager: Firebase secret access (one-time)

**Why not Pulumi:** The GCP provider resolves the project for Secret Manager IAM as the Pulumi project name (`restormel-keys`), not `gcp:project`, so `SecretIamMember` would call the API with the wrong project and hit **403 CONSUMER_INVALID**. IAM for this secret is therefore not managed by Pulumi.

**One-time step:** Grant the dashboard service account access to the Firebase Admin secret so Cloud Run can mount it. From the repo root:

```bash
./infra/grant-firebase-secret-access.sh
```

Optional: pass a different project, e.g. `./infra/grant-firebase-secret-access.sh restormel-keys-prod`.

Ensure the secret `firebase-admin-credentials` exists in the GCP project and has at least one version. Then run `pulumi up`. If Cloud Run still reports "Permission denied on secret", run the script again and retry.
