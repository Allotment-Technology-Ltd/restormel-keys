# Custom domain mapping: restormel.dev on Google Cloud

This runbook describes how **restormel.dev** (and **www.restormel.dev**) are served via the existing GCP load balancer and Cloud Run, with DNS managed in **Vercel**. It assumes you are using the Pulumi stack in `infra/` and that DNS for the domain is configured in Vercel (domain purchased there).

---

## 1. What was added (infrastructure)

The existing Pulumi stack in `infra/index.ts` was extended to support a custom apex domain and `www`:

- **Dual-domain managed SSL certificate**  
  When `domain` config is set (e.g. `restormel.dev`), a Google-managed SSL certificate is created for both the apex and `www` (e.g. `restormel.dev`, `www.restormel.dev`).

- **URL map behaviour**  
  - **Apex** (`restormel.dev`) → backend (Cloud Run via serverless NEG).  
  - **www** (`www.restormel.dev`) → 301 redirect to `https://restormel.dev` (canonical).

- **HTTP → HTTPS redirect**  
  A global HTTP (port 80) forwarding rule on the same load balancer IP redirects all HTTP traffic to HTTPS (same host).

- **Exports**  
  The stack now exports: `loadBalancerIp`, `dashboardServiceName`, `managedCertificateName`, and `dnsRecordsForVercel` (shape of the DNS records to create).

No new GCP project or region was introduced; the same global external HTTPS load balancer, serverless NEG, and Cloud Run service are used. DNS remains in Vercel—no Cloud DNS is required for the public domain.

---

## 2. Prerequisites

- Pulumi CLI installed and logged in (`pulumi login`).
- GCP project (e.g. `restormel-keys-prod`) with billing and required APIs enabled (see `infra/README.md`).
- Domain **restormel.dev** added and DNS managed in Vercel (where the domain was purchased).

---

## 3. Commands to run

### 3.1 Set domain config and deploy infra

From the repo root:

```bash
cd infra
pulumi stack select production
pulumi config set gcp:project YOUR_GCP_PROJECT_ID   # if not already set
pulumi config set domain restormel.dev
pulumi preview   # review changes
pulumi up         # confirm to create/update resources
```

After `pulumi up`, note the **outputs** (see section 4).

### 3.2 Get the load balancer IP from outputs

```bash
cd infra
pulumi stack output loadBalancerIp
```

Use this IP for the Vercel DNS records below.

### 3.3 (Optional) Check managed certificate status

Certificate provisioning can take up to ~60 minutes. To inspect status:

```bash
gcloud compute ssl-certificates describe keys-dashboard-cert --global --project=YOUR_GCP_PROJECT_ID
```

Look for `status: ACTIVE` when provisioning is complete. Until then, HTTPS may not serve correctly for the custom domain.

---

## 4. Expected Pulumi outputs (after deployment)

After a successful `pulumi up` with `domain` set, you should see outputs similar to:

| Output | Description |
|--------|-------------|
| `loadBalancerIp` | Global static IP of the HTTPS load balancer. **Use this for Vercel DNS A records.** |
| `dashboardServiceName` | Cloud Run service name (e.g. `keys-dashboard`). |
| `dashboardServiceUrl` | Direct Cloud Run URL (e.g. `https://keys-dashboard-xxx.run.app`). |
| `managedCertificateName` | Name of the Google-managed SSL cert (e.g. `keys-dashboard-cert`). Check status with `gcloud compute ssl-certificates describe <name> --global`. |
| `dnsRecordsForVercel` | Object describing the DNS records to create in Vercel (see section 5). |

To print all outputs:

```bash
pulumi stack output
```

To print a single output (e.g. for scripting):

```bash
pulumi stack output loadBalancerIp
pulumi stack output --json dnsRecordsForVercel
```

---

## 5. DNS records to create in Vercel

DNS is **not** managed by GCP for this domain; you create the records in **Vercel DNS**.

Use the **same IP** for both records: the value of `pulumi stack output loadBalancerIp` (from section 4).

### 5.1 Exact records (Vercel DNS)

| Type | Name | Value | TTL |
|------|------|--------|-----|
| **A** | `@` | `<load_balancer_ip>` | 3600 (or Vercel default) |
| **A** | `www` | `<load_balancer_ip>` | 3600 (or Vercel default) |

Replace `<load_balancer_ip>` with the actual IP from `pulumi stack output loadBalancerIp` (e.g. `34.120.45.67`).  
- **Apex:** `@` means the root domain (restormel.dev).  
- **www:** `www` means www.restormel.dev. Both point to the same load balancer; the LB then redirects `www` → `https://restormel.dev`.

### 5.2 Click-by-click in Vercel (manual steps)

1. Log in to [Vercel](https://vercel.com) and open the project or account that owns **restormel.dev** (or go to **Domains** for the team/account).
2. Open **Domains** and select **restormel.dev** (or add it if needed).
3. For the **restormel.dev** domain you will add two DNS records. If Vercel shows existing records, add or edit as below; otherwise add new records.

   **Record 1 – Apex (root domain)**  
   - **Type:** `A`  
   - **Name:** `@` (or leave blank if Vercel uses “root” / “apex”)  
   - **Value:** paste the **load balancer IP** from `pulumi stack output loadBalancerIp`  
   - **TTL:** 3600 (or leave default)  
   - Save.

   **Record 2 – www**  
   - **Type:** `A`  
   - **Name:** `www`  
   - **Value:** same **load balancer IP** as above  
   - **TTL:** 3600 (or leave default)  
   - Save.

4. Do **not** use a CNAME for the apex (`@`) — apex must be an **A** record pointing to the load balancer IP. Using CNAME for `www` is possible in theory, but an A record with the same IP is simpler and matches the Pulumi `dnsRecordsForVercel` output.

If Vercel’s UI uses different labels (e.g. “Host” instead of “Name”), use:  
- Host/Name for apex: `@` or root/apex.  
- Host/Name for www: `www`.  
- Value: the load balancer IP in both cases.

---

## 6. Verification

1. **DNS**  
   After saving the records, wait for TTL (e.g. a few minutes to an hour). Then:
   ```bash
   dig restormel.dev +short
   dig www.restormel.dev +short
   ```
   Both should return the load balancer IP.

2. **Certificate**  
   Ensure the managed cert is **ACTIVE** (see section 3.3). Until it is, HTTPS for restormel.dev may show certificate errors.

3. **HTTPS**  
   - Open `https://restormel.dev` — should serve the site (Cloud Run).  
   - Open `https://www.restormel.dev` — should 301 redirect to `https://restormel.dev`.  
   - Open `http://restormel.dev` and `http://www.restormel.dev` — should 301 redirect to the same host over HTTPS.

4. **Cloud Run**  
   The service name is in `pulumi stack output dashboardServiceName`. You can deploy/redeploy the app via your existing CI or `gcloud run deploy` targeting that service and region.

---

## 7. Deploy on push (CI)

On **push to `main`** (when `apps/**`, `infra/**`, `Dockerfile.site`, or `.github/workflows/deploy.yml` change), the **Deploy** workflow:

1. Builds the site image from `Dockerfile.site` (Astro app in `apps/site`).
2. Pushes the image to Artifact Registry: `europe-west2-docker.pkg.dev/<PROJECT>/restormel-keys/site:<sha>`.
3. Deploys to Cloud Run: `gcloud run deploy keys-dashboard --image ... --region europe-west2`.

**Required GitHub secrets:** `GCP_PROJECT_ID`, `WIF_PROVIDER`, `WIF_SERVICE_ACCOUNT` (Workload Identity Federation for GCP). The WIF service account needs **Artifact Registry Writer** and **Cloud Run Admin** (or **Editor**) on the project.

---

## 8. Summary checklist (operator)

- [ ] `pulumi config set domain restormel.dev` and `pulumi up` in `infra/`.
- [ ] Note `loadBalancerIp` from `pulumi stack output loadBalancerIp`.
- [ ] In Vercel DNS: create **A** record for **@** → `loadBalancerIp`; **A** record for **www** → `loadBalancerIp`.
- [ ] Wait for DNS propagation and for managed cert to become **ACTIVE**.
- [ ] Verify `https://restormel.dev`, `https://www.restormel.dev` (redirect to apex), and HTTP→HTTPS redirects.
- [ ] Configure GitHub secrets (GCP_PROJECT_ID, WIF_PROVIDER, WIF_SERVICE_ACCOUNT); push to `main` to deploy the site.

---

## 9. Troubleshooting

- **Certificate stuck in PROVISIONING**  
  Google needs the DNS A records to point to the load balancer IP before it can issue the cert. Confirm both apex and www resolve to that IP; then wait up to ~60 minutes.

- **403/502 from load balancer**  
  Ensure the Cloud Run service allows unauthenticated invoker (`allUsers` on `roles/run.invoker`) and that the serverless NEG is in the same region as the Cloud Run service.

- **Vercel shows “Invalid configuration” for A record**  
  Ensure the value is the **IPv4 address** only (e.g. `34.120.45.67`), no trailing dot or hostname.

- **www not redirecting**  
  Confirm the URL map in GCP has the host rule for `www.restormel.dev` and the path matcher with `defaultUrlRedirect` to the apex (this is set by the Pulumi code when `domain` is set).
