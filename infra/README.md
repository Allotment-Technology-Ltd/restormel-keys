# Restormel Keys – GCP infra (Pulumi)

Pulumi stack for dashboard (Cloud Run), Artifact Registry, and load balancer on GCP.

## Prerequisites

- [Pulumi CLI](https://www.pulumi.com/docs/install/) and login (`pulumi login`)
- [gcloud CLI](https://cloud.google.com/sdk/docs/install) and application default credentials:
  ```bash
  gcloud auth application-default login
  ```
- GCP project (e.g. `restormel-keys-prod`) with **billing** and required **APIs** enabled.

## Required GCP permissions

The identity running `pulumi up` (your user or a service account) must have these permissions on the target project. If you see **403 Permission denied** for:

| Error / resource | Required permission / role |
|------------------|-----------------------------|
| `iam.serviceAccounts.create` | `roles/iam.serviceAccountAdmin` |
| `compute.globalAddresses.create`, `compute.regions.list`, NEG, BackendService, URLMap | `roles/compute.networkAdmin` or `roles/compute.admin` |
| `artifactregistry.repositories.create` | `roles/artifactregistry.admin` |
| Cloud Run service | `roles/run.admin` |

**Quick fix (project owner):** Grant your user or the service account used by Pulumi one of:

- **Option A – broad (easiest):** Project **Editor** or **Owner** on the project.
- **Option B – minimal:** Grant these roles on the project:
  - `roles/iam.serviceAccountAdmin`
  - `roles/compute.networkAdmin`
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

for role in roles/iam.serviceAccountAdmin roles/compute.networkAdmin roles/artifactregistry.admin roles/run.admin; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="$PRINCIPAL" \
    --role="$role"
done
```

Or in **GCP Console:** IAM & Admin → IAM → select the principal → Edit → Add another role → add the four roles above → Save.

## Enable APIs

Ensure these APIs are enabled for the project:

```bash
gcloud services enable compute.googleapis.com run.googleapis.com artifactregistry.googleapis.com iam.googleapis.com --project=restormel-keys-prod
```

## Config and run

```bash
cd infra
pulumi stack select production
pulumi config set gcp:project restormel-keys-prod
# optional: pulumi config set gcp:region europe-west2
pulumi up
```
