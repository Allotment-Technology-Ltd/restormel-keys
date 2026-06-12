# Coolify cutover runbook — restormel-keys (Stage 2)

**Written for:** product owner new to self-hosting  
**Strategy source:** `docs/infra/coolify-migration-plan-2026-06.md` (merged, PR #262)  
**Env vars reference:** `docs/infra/coolify-env-inventory.md` (this same PR)  
**Pattern source:** `~/projects/allotment-technology-ltd/INFRA-RUNBOOK.md` (pilot box experience)

> **How to use this runbook:** every step is tagged as either **[OWNER]** (you do it — in a
> browser, terminal, or DNS panel) or **[AGENT]** (a Claude agent does it — with the branch or
> PR reference where it was or will be done). Every [OWNER] step ends with a "Verify" line
> telling you what success looks like before you continue. Every destructive or irreversible
> step (DNS flip, project delete) has a **STOP** gate — do not proceed past a STOP gate
> without the team's explicit go-ahead.

---

## Where are we now — status checklist

Use this to orient any session or model picking this up.

### Infrastructure
- [x] **Stage 0: Control plane** — Hetzner CX33 at `77.42.125.150`, Coolify, Forgejo
      (`git.allotmentology.tech`), act_runner — all live and green
- [x] **Stage 1: Git + CI on Forgejo** — `Allotment-Technology-Ltd/restormel-keys` mirrored;
      `.forgejo/workflows/` live; tag-triggered publishers ported; CI green on docker runner
- [x] **Stage 2.0: Provision prod box** — **N/A: reusing the shared box `77.42.125.150`** (decision D1, 2026-06-12). It is already provisioned, hardened, and running Coolify/Forgejo (Stage 0/1). No new server. Phase A's A1–A3 are SKIPPED.
- [ ] **Stage 2.1: Adapter + Dockerfile** — `svelte.config.js` still on adapter-vercel; Dockerfile still on node:20; `VERCEL_ENV` call sites not yet audited
- [ ] **Stage 2.2: Worker daemon + inline-drain gate** — daemon script not yet written; `CONNECT_INGEST_INLINE_DRAIN` gate not yet implemented
- [ ] **Stage 2.3: Staging deploy** — not yet done; `staging.restormel.dev` DNS not yet created
- [ ] **Stage 2.4: Forgejo CI deploy pipeline** — `.forgejo/workflows/deploy-dashboard.yml` not yet written
- [ ] **Stage 2.5: Production cutover** — not yet started; DNS apex still points to Vercel
- [ ] **Stage 2.6: Post-cutover hardening** — deferred

### Decisions outstanding (from migration plan §10)
- [x] **D1** ~~Dedicated CX33 vs reuse shared box~~ — **DECIDED 2026-06-12: REUSE the shared box `77.42.125.150`.** Prototyping, low usage; revisit if contention appears. Wherever this runbook says `<prod-box-ip>`, use `77.42.125.150`.
- [x] **D2** ~~Hetzner region~~ — **N/A** (no new server; shared box already placed).
- [ ] **D5** Calendar date for T0 (the prod DNS flip) — after ≥1 week staging bake

### Cron drain status
- [x] Vercel cron changed from `*/5 * * * *` to daily (`0 4 * * *`) — this is already
      in production (e02eb0a / `fix(vercel): drain cron daily not */5`, PR #264). The
      drain route remains and the daily cron is a backstop. The Coolify worker daemon
      replaces it entirely when deployed (Stage 2.2–2.3).

---

## Phase A — Get the box ready for the app

> ### ✅ DECISION D1: reusing the shared box `77.42.125.150` (2026-06-12)
> The box already exists, is hardened, and runs Coolify + Forgejo (Stage 0/1). So for your
> path, **Phase A is just two steps: A4 (staging DNS) and A5 (pull the Vercel env)** — then
> straight to Phase B. **Skip A1, A2, A3** (order server / harden host / register remote
> server) — that work is already done. They are kept below, struck through, only in case you
> later split out a dedicated box. Throughout the runbook, `<prod-box-ip>` = `77.42.125.150`.
>
> One note for A3: because Coolify *runs on* this same box, the dashboard deploys to Coolify's
> **own/localhost server** — there is no separate remote server to register. In Phase B, when
> Coolify asks which server to deploy to, choose the existing local server.

**Goal (shared-box path):** `staging.restormel.dev` resolves to `77.42.125.150`, and the
production env is exported ready to paste into Coolify.

---

### ~~A1 [OWNER] — Order the Hetzner server~~ — SKIP (reusing shared box)
### ~~A2 [OWNER] — Host hardening~~ — SKIP (shared box already hardened)
### ~~A3 [OWNER] — Register the prod box as a remote server in Coolify~~ — SKIP (deploy to Coolify's local server in Phase B)

> The original A1–A3 instructions are retained below for the dedicated-box path only. **If you
> are on the shared-box path (you are), jump to A4.**

---

### A1 [OWNER] — Order the Hetzner server

1. Go to [https://console.hetzner.cloud](https://console.hetzner.cloud) → your project
   (the same project as the existing `77.42.125.150` shared box).
2. Click **Add Server**.
3. Settings:
   - **Location:** fsn1 or nbg1 (owner decision D2)
   - **Image:** Ubuntu 24.04
   - **Type:** Shared vCPU → x86 → **CX33** (4 vCPU / 8 GB / 80 GB)
   - **SSH keys:** add a new key — on your local machine run:
     ```
     ssh-keygen -t ed25519 -f ~/.ssh/id_hetzner_restormel_prod -C "restormel-prod"
     ```
     Paste the contents of `~/.ssh/id_hetzner_restormel_prod.pub` into the Hetzner key field.
   - **Firewall:** assign the existing Cloud Firewall (or create a new one with rules:
     allow inbound TCP 22, 80, 443 only — **no other inbound ports**).
     This is critical: Docker bypasses ufw and binds Coolify's management ports to
     `0.0.0.0`; the Hetzner Cloud Firewall is the only thing blocking them from the
     internet (verified on the pilot box).
   - **Name:** `restormel-prod`
4. Click **Create & Buy**.

**Verify:** the new server appears in the Hetzner console with a public IPv4 address and
status "Running". Note the IP — it is referred to as `<prod-box-ip>` throughout this runbook.

---

### A2 [OWNER] — Host hardening

SSH in as root and run the hardening script (same recipe as the pilot — INFRA-RUNBOOK.md §0.1):

```bash
ssh -i ~/.ssh/id_hetzner_restormel_prod root@<prod-box-ip>
```

Then run as root (set the variables at the top first):

```bash
export DEPLOY_USER=deploy
export DEBIAN_FRONTEND=noninteractive

# Create non-root deploy user
useradd -m -s /bin/bash $DEPLOY_USER
usermod -aG sudo,docker $DEPLOY_USER   # docker group added after Docker install below

# Install Docker
apt-get update -q
apt-get install -yq ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | tee /etc/apt/sources.list.d/docker.list
apt-get update -q
apt-get install -yq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add deploy user to docker group (now that Docker is installed)
usermod -aG docker $DEPLOY_USER

# SSH: key-only, no root login
mkdir -p /home/$DEPLOY_USER/.ssh
cp ~/.ssh/authorized_keys /home/$DEPLOY_USER/.ssh/authorized_keys   # copy the key you used for root
chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
chmod 700 /home/$DEPLOY_USER/.ssh
chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys
sed -i 's/#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd

# ufw (belt-and-braces — Hetzner Cloud Firewall is the primary enforcement layer)
apt-get install -yq ufw fail2ban
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# unattended-upgrades (non-interactive)
apt-get install -yq unattended-upgrades
echo 'APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";' > /etc/apt/apt.conf.d/20auto-upgrades
```

**Verify:** `ssh -i ~/.ssh/id_hetzner_restormel_prod deploy@<prod-box-ip>` — you get a shell.
Root login should now be refused.

---

### A3 [OWNER] — Register the prod box as a remote server in Coolify

1. Open the Coolify dashboard on the **shared box** via SSH tunnel:
   ```
   ssh -i ~/.ssh/id_hetzner_<your-key> -L 8000:localhost:8000 -N deploy@77.42.125.150
   ```
   Then open [http://localhost:8000](http://localhost:8000) in your browser.
2. Go to **Servers → Add Server**.
3. Enter:
   - **Name:** `restormel-prod`
   - **IP address:** `<prod-box-ip>`
   - **SSH port:** 22
   - **User:** `deploy`
4. Generate or paste a deploy SSH key for Coolify to use. Coolify will provide its own
   public key — add it to `~/.ssh/authorized_keys` on the prod box:
   ```bash
   ssh -i ~/.ssh/id_hetzner_restormel_prod deploy@<prod-box-ip> \
     'echo "<coolify-public-key>" >> ~/.ssh/authorized_keys'
   ```
5. Click **Validate** in Coolify. Coolify will SSH in and install Docker if not already present.

**Verify:** Coolify shows the server as **Reachable** with a green status indicator.

---

### A4 [OWNER] — Create staging DNS record

1. Go to [https://vercel.com/dashboard](https://vercel.com/dashboard) → your restormel.dev
   domain → **DNS**.
2. Add an **A record**:
   - **Name:** `staging`
   - **Value:** `<prod-box-ip>`
   - **TTL:** 300
3. Click **Save**.

> Note the negative-cache gotcha from the pilot runbook: if you query
> `staging.restormel.dev` before the record exists, your DNS resolver may cache the
> NXDOMAIN for up to 10 hours. If `dig staging.restormel.dev` does not resolve after
> a few minutes, switch your local DNS to 1.1.1.1 temporarily or add a `/etc/hosts` entry.

**Verify:** `dig staging.restormel.dev @1.1.1.1` returns `<prod-box-ip>`.

---

### A5 [OWNER] — Pull the Vercel environment and prepare it for Coolify

1. Install the Vercel CLI if not already: `npm i -g vercel`
2. Log in: `vercel login`
3. Pull the prod env:
   ```
   vercel env pull --environment=production apps/dashboard/.env.vercel-prod
   ```
   This writes the current prod env to a local file. Keep it only on your local machine;
   delete it after pasting into Coolify. **Never commit this file.**
4. Generate a fresh `CRON_SECRET` for the Coolify environment (do not reuse Vercel's):
   ```
   openssl rand -base64 32
   ```
   Note the value in your password manager. You will use it in Phase B.
5. Cross-reference the env file against `docs/infra/coolify-env-inventory.md` and mark any
   flagged vars (`PADDLE_API_KEY`, `PADDLE_ENVIRONMENT`, `OPENAI_API_KEY`) as present or missing.

**Verify:** `apps/dashboard/.env.vercel-prod` exists locally and contains `DATABASE_URL`.
Confirm all boot-blockers from the inventory checklist are present.

---

## Phase B — First staging deploy + parity check

**Goal:** `https://staging.restormel.dev` serves the dashboard; sign-in works; the worker
claims and completes an ingest job.

---

### B1 [AGENT] — Adapter swap and Dockerfile update (Stage 2.1)

Branch: `feat/coolify-adapter-node` (to be opened)

Agent tasks:
- Make `apps/dashboard/svelte.config.js` env-selected: `DEPLOY_TARGET=node` → adapter-node,
  else adapter-vercel (default unchanged, so Vercel previews remain byte-identical).
- Bump `Dockerfile.dashboard` base image to `node:22-alpine`.
- Add `ENV NODE_ENV=production` to the serve stage.
- Add a comment documenting `ORIGIN`, `BODY_SIZE_LIMIT`, `HOST` requirements.
- Add healthcheck: `HEALTHCHECK CMD wget -qO- http://localhost:8080/keys/v1/catalog || exit 1`.
- Audit the three `VERCEL_ENV` call sites (currently in
  `apps/dashboard/src/lib/server/connect/outbound-surreal-endpoint.ts:17` and
  `apps/dashboard/src/routes/keys/dashboard/connect/+page.server.ts:18`) — replace with
  `NODE_ENV === "production"` where appropriate.
- Gate: `pnpm --filter dashboard check` and vitest pass under both adapter selections;
  `docker build -f Dockerfile.dashboard .` succeeds.

---

### B2 [AGENT] — Worker daemon + inline-drain gate (Stage 2.2)

Branch: `feat/connect-ingest-worker-daemon` (to be opened)

Agent tasks:
- Write `apps/dashboard/scripts/connect-ingest-worker-daemon.ts`: infinite loop calling
  `drainConnectIngestQueue({ maxJobs })`, sleeping `CONNECT_INGEST_WORKER_INTERVAL_MS`
  (default 5000ms ± jitter), handling `SIGTERM` gracefully (stop claiming new jobs; let
  the current job's stage finish or let its lease expire).
- Add env gate `CONNECT_INGEST_INLINE_DRAIN=0` to `scheduleConnectIngestWorkerDrain()` —
  when set to `0`, the function becomes a no-op (worker owns execution).
- Add `package.json` script `"connect-ingest-worker:daemon"`.
- Add unit tests: SIGTERM path, env gate behaviour, jitter bounds.
- Gate: tests green; daemon processes a stub job locally (`CONNECT_INGEST_WORKER_MODE=stub`)
  and exits cleanly on SIGTERM.

---

### B3 [OWNER] — Create Coolify applications for staging

Once Stages 2.1 and 2.2 are merged to main:

1. Open Coolify (SSH tunnel as in A3).
2. **New Resource → Application** on the `restormel-prod` server.
   - **Source:** Private Git repo → Forgejo
   - **Repository URL:** `git@10.0.1.1:22222/Allotment-Technology-Ltd/restormel-keys.git`
     (internal Coolify network address — see INFRA-RUNBOOK.md §"Private Forgejo repo as
     Coolify git source" for the SSH key dance: generate a keypair, add public key as
     read-only deploy key on the Forgejo repo, register private key in Coolify)
   - **Branch:** `main`
   - **Build pack:** Dockerfile → `Dockerfile.dashboard`
   - **Target server:** restormel-prod
   - **Domain:** `https://staging.restormel.dev`
   - **Name:** `restormel-dashboard-staging`
3. In the application's **Environment** tab, paste all variables from
   `docs/infra/coolify-env-inventory.md` using your `.env.vercel-prod` file as the source.
   Add the "new for Coolify" vars:
   - `DEPLOY_TARGET=node`
   - `CONNECT_INGEST_INLINE_DRAIN=0`
   - `ORIGIN=https://staging.restormel.dev`
   - `HOST=0.0.0.0`
   - `PORT=8080`
   - `BODY_SIZE_LIMIT=10mb`
   - `NODE_ENV=production`
   - `DATABASE_URL` → use the Forgejo CI Neon branch URL, **not prod**
   - `CRON_SECRET` → the fresh value generated in A5
   - `PADDLE_ENVIRONMENT=sandbox`
4. **New Resource → Application** (second app, the worker):
   - Same source, branch, build pack, target server.
   - **Domain:** none (no HTTP traffic).
   - **Start command:** `node --import tsx scripts/connect-ingest-worker-daemon.ts`
   - **Name:** `restormel-worker-staging`
   - **Restart policy:** Always.
   - **Memory limit:** 2GB (Coolify → Advanced → Resource Limits).
   - Environment: same vars as the dashboard, plus:
     - `CONNECT_INGEST_WORKER_INTERVAL_MS=5000`
     - Remove `CONNECT_INGEST_INLINE_DRAIN` (not needed on the worker).
5. Set memory limit on the dashboard application: 1.5GB.
6. Deploy both applications.

**Verify:** both applications show green status in Coolify; container logs show startup
messages with no crash-restart loops.

---

### B4 [OWNER] — Add staging origin to Neon Auth

1. Go to [https://console.neon.tech](https://console.neon.tech) → your project → **Auth**.
2. Under **Trusted Origins**, add `https://staging.restormel.dev`.
3. Save.

> This step is required before sign-in can work on staging. It was explicitly flagged as
> "not yet proven" in the pilot runbook — proving it is the purpose of this step.

**Verify:** the Neon Auth console shows `staging.restormel.dev` in the trusted origins list.

---

### B5 [OWNER] — Smoke tests on staging

Work through this checklist in order. Do not proceed to Phase C until all pass.

- [ ] `curl -sf https://staging.restormel.dev/keys/v1/catalog` returns HTTP 200 with JSON.
- [ ] Opening `https://staging.restormel.dev/keys/dashboard` in a browser loads the UI.
- [ ] Sign-in completes successfully (GitHub OAuth round-trip via Neon Auth).
- [ ] After sign-in, the dashboard home page loads without errors.
- [ ] Create a test ingest job from the dashboard UI.
- [ ] Watch the **worker** container logs in Coolify — confirm it claims and processes the job.
- [ ] Watch the **dashboard** container logs — confirm they show **no** drain activity for
      the job you just created (the `CONNECT_INGEST_INLINE_DRAIN=0` gate is working).
- [ ] `kill -9` the worker container (Coolify → Containers → Stop, then wait for the
      restart policy to bring it back). Confirm the run console shows "reclaimed after stall"
      on the in-progress job and the restarted worker picks it up cleanly.
- [ ] `curl -w "\nTime: %{time_total}s\n" https://staging.restormel.dev/keys/dashboard` —
      after the process has been running for 30+ minutes, first-byte time should show
      no 2-second cold-start signature. Compare to Vercel baseline (~290–460ms warm SSR).

**Verify:** all eight items above are checked.

---

## Phase C — Forgejo CI deploy pipeline

**Goal:** a push to `main` automatically builds a new Docker image and deploys it to
staging without any manual step.

---

### C1 [OWNER] — Mint Coolify API token and Forgejo org secret (5 minutes)

1. In Coolify → **Settings → Keys & Tokens** → New API Token.
   - Name: `forgejo-ci-deploy`
   - Permissions: read + write + deploy (skip root + read:sensitive)
2. Copy the token.
3. In Forgejo (`git.allotmentology.tech`) → `Allotment-Technology-Ltd` org → **Settings →
   Actions → Secrets** → **New Secret**:
   - Name: `COOLIFY_DEPLOY_TOKEN`
   - Value: paste the token

**Verify:** the secret appears in the Forgejo org secrets list (values are never shown after creation).

---

### C2 [AGENT] — Write the Forgejo CI deploy workflow (Stage 2.4)

Branch: `feat/forgejo-deploy-dashboard` (to be opened)

Agent tasks:
- Create `.forgejo/workflows/deploy-dashboard.yml`:
  - Trigger: push to `main` with path filter (dashboard-relevant paths + Dockerfile.dashboard).
  - Build `Dockerfile.dashboard` on the `docker` runner (the shared box's act_runner).
  - Tag: `git.allotmentology.tech/allotment-technology-ltd/restormel-keys/dashboard:<sha>` + `:latest`.
  - Push to Forgejo container registry.
  - Call Coolify deploy webhook/API using `COOLIFY_DEPLOY_TOKEN` org secret to redeploy
    `restormel-dashboard-staging` and `restormel-worker-staging`.
- Switch both Coolify applications' source from "build from repo" to "pull Docker image" at this point.
  (Prod box never runs builds — only the shared box's runner does.)
- Gate: a `main` push produces a Coolify deploy; the new image SHA is visible at
  `/keys/dashboard` (the deploy-marker endpoint); no human step was needed.

---

## Phase D — Production cutover

**Goal:** `restormel.dev` serves the dashboard from the Coolify box. Vercel remains live
as an instant rollback target throughout.

> **Bake time:** do not start Phase D until staging has been running cleanly for at least
> **one week** after Phase B completes. Check the status checkbox for D5 (bake date) at the
> top of this runbook.

---

### D1 [OWNER] — Pre-lower prod DNS TTLs (≥24 hours before T0)

**STOP — do this step at least 24 hours before the planned DNS flip (T0).**

1. Go to Vercel → your restormel.dev domain → **DNS**.
2. Change the TTL of the **apex A record** (`@` or blank host, pointing to Vercel) to **300**.
3. Change the TTL of the **`www` CNAME** to **300** (if present).
4. Save.

**Verify:** `dig restormel.dev @1.1.1.1 | grep TTL` shows 300.

> With TTL 300, a DNS rollback after the flip takes ≤5 minutes to propagate.
> Without this step, rollback could take hours.

---

### D2 [OWNER] — Create prod Coolify applications

Before the DNS flip, stand up the prod apps with prod env so they can be verified
on the box without live traffic.

1. In Coolify, create two new applications identical to staging but with:
   - **Names:** `restormel-dashboard-prod` and `restormel-worker-prod`
   - **Domain:** `https://restormel.dev`
   - **Environment:**
     - `DATABASE_URL` → prod Neon URL (from `.env.vercel-prod`)
     - `ORIGIN=https://restormel.dev`
     - `PADDLE_ENVIRONMENT=production`
     - All other prod values from the inventory
     - A fresh `CRON_SECRET` (can reuse the one from staging if you rotated it)
2. Deploy both.
3. Verify on the box **before flipping DNS** by using `curl --resolve`:
   ```bash
   curl -sf --resolve restormel.dev:443:<prod-box-ip> \
     https://restormel.dev/keys/v1/catalog
   ```
   This routes the HTTPS request to the prod box while DNS still points to Vercel.

**Verify:** `curl --resolve` returns HTTP 200 with JSON from the box. TLS cert is valid
(Let's Encrypt should have issued it — if it fails, see the cert troubleshooting note
in the kill criteria below).

---

### D3 [OWNER] — Verify Neon Auth trusted origins for prod

1. In Neon Auth trusted origins, confirm `https://restormel.dev` is listed.
2. It is already the current prod origin — **verify, don't assume.**

**Verify:** `https://restormel.dev` appears in the Neon Auth trusted origins list.

---

### D4 [OWNER] — Verify Paddle webhook URL

1. In Paddle Dashboard → **Notifications → Webhooks**.
2. Confirm the webhook URL points at `https://restormel.dev/...` (not a vercel.app URL).
3. If it points at a vercel.app host, update it to the restormel.dev path — but this is
   expected to be correct already (the domain has always been restormel.dev).

**Verify:** webhook URL contains `restormel.dev`, not `*.vercel.app`.

---

### D5 [OWNER] — Flip the apex DNS (T0)

**STOP — confirm with the team before executing this step.**

**Prerequisites for T0:**
- Staging has baked for ≥1 week with all smoke tests passing (Phase B complete)
- TTLs lowered to 300 for ≥24 hours (D1 complete, ≥24h ago)
- Prod apps running and verified with `curl --resolve` (D2 complete)
- Neon Auth origin confirmed (D3 complete)
- Paddle webhook confirmed (D4 complete)

**The flip:**
1. Go to Vercel → restormel.dev → **DNS**.
2. Change the **apex A record** (`@`) value from the Vercel IP to `<prod-box-ip>`.
3. Change the **`www` CNAME** target if it was pointing at Vercel's hosts (or leave as
   a CNAME to restormel.dev if you want `www` to redirect to apex — your DNS panel may
   handle this differently; confirm with the Vercel DNS documentation).
4. Save.

**T0 = the moment you save.** Note the time.

**Immediately verify:**
- [ ] `dig restormel.dev @1.1.1.1` returns `<prod-box-ip>`
- [ ] `curl -sf https://restormel.dev/keys/v1/catalog` returns HTTP 200
- [ ] `https://restormel.dev/keys/dashboard` loads in a browser with a valid TLS cert
- [ ] Sign in successfully (Neon Auth round-trip)
- [ ] Check Coolify dashboard logs — worker is claiming jobs normally

---

### D6 — 72-hour dual-run window (T0 → T+72h)

During this window, both the Vercel deployment and the Coolify box serve traffic.
Traffic drains to the box as DNS propagates. Both are stateless against the same Neon
Postgres — dual-running is safe by construction. The Vercel daily cron drain and the
box worker may both run concurrently — the lease/heartbeat claiming (PR #229) makes
concurrent drainers safe.

**Monitor during dual-run window:**
- [ ] Coolify dashboard logs: no crash-restart loops
- [ ] Coolify worker logs: jobs claiming and completing normally
- [ ] Neon Auth: sign-in success rate (check Neon console → Auth → Sessions)
- [ ] Paddle: no webhook delivery failures (Paddle Dashboard → Notifications → Activity)
- [ ] allotmentology.tech: `/keys/v1/catalog` consumer working (check allotmentology logs)
- [ ] Run console: ingest jobs completing without corruption
- [ ] `curl -w` TTFB once per day — compare to Vercel baseline (~290–460ms warm)

**Kill criteria — any one of these triggers an immediate rollback (D7):**
- Sign-in success rate degrades (Neon Auth origin/cookie issue on the new host)
- `/keys/v1/catalog` returning non-200s to the allotmentology.tech consumer
- Paddle webhook delivery failures (signature/origin mismatch)
- p50 warm TTFB on the box worse than the Vercel baseline for more than 1 hour, or
  any recurring multi-second stalls (cold-start-like behaviour)
- Let's Encrypt cert issuance failure leaving the apex without a valid cert
- An ingest run corrupting state (worker bug class not seen on staging)

---

### D7 [OWNER] — Rollback procedure (if kill criteria triggered)

**STOP — this is a rollback. Confirm with the team first, then act quickly.**

1. Go to Vercel → restormel.dev → **DNS**.
2. Revert the apex A record to the Vercel IP (it has not changed — Vercel deployment
   is still live and has never stopped running).
3. Save.
4. Verify: `dig restormel.dev @1.1.1.1` returns the Vercel IP; `curl https://restormel.dev`
   returns HTTP 200 from Vercel.

> Rollback is a single DNS record change. With TTL 300 it propagates in ≤5 minutes.
> The Vercel deployment, env, and cron have been untouched throughout — it is a hot standby.
> The box keeps running staging; nothing needs to be un-deployed.

After rollback: file findings in a new GitHub issue, leave the box running staging, and
schedule a retrospective before re-attempting.

---

### D8 [OWNER] — Declare success (T+72h)

**STOP — confirm with the team before executing.**

If all monitoring checks passed and no kill criteria were triggered for 72 hours:

1. In the `main` branch: merge a PR that removes the `*/5 * * * *` cron block from
   `apps/dashboard/vercel.json` (the Vercel daily cron is also removable now, but verify
   nothing else depends on the drain endpoint being called externally first).
2. Continue to Phase E.

**Verify:** Vercel cron is removed; Coolify worker is the sole drain mechanism.

---

## Phase E — Post-cutover hardening (Stage 2.6)

---

### E1 [OWNER] — Vercel to previews-only

**STOP — only do this after T+72h success (D8 complete).**

1. In Vercel → your restormel.dev project → **Settings → Domains**.
2. Remove `restormel.dev` and `www.restormel.dev` from the project's domains.
   (The vercel.app preview URL will continue to work; per-PR preview deployments keep building.)
3. Do not delete the Vercel project — it is the DR target and the PR preview service.

**Verify:** `https://restormel.dev` still serves from the box; Vercel project still builds
preview deploys for PRs (check an open PR's deployment link).

---

### E2 [OWNER] — Set up uptime monitoring

1. Sign up or log in to UptimeRobot (free tier) or equivalent.
2. Add an HTTP(S) monitor for `https://restormel.dev/keys/v1/catalog`.
   - Check interval: every 5 minutes
   - Alert threshold: 3 consecutive failures
   - Alert channel: email to your address
3. Optional: add a second monitor for `https://staging.restormel.dev/keys/v1/catalog`.

**Verify:** UptimeRobot shows the monitor as "UP".

---

### E3 [OWNER] — Hetzner snapshot schedule

1. In Hetzner Cloud console → your `restormel-prod` server → **Snapshots**.
2. Enable **automatic snapshots** (daily or weekly).

> The prod box is stateless — all persistent state is in Neon. Snapshots capture the
> Docker/Coolify configuration so a rebuild after hardware failure takes minutes
> (snapshot → new server → restore snapshot) rather than starting from scratch.

**Verify:** at least one snapshot scheduled.

---

### E4 [AGENT] — TTFB measurement and docs update (Stage 2.6)

Branch: `docs/coolify-post-cutover-perf` (to be opened after cutover)

Agent tasks:
- Set `DASHBOARD_PERF_LOG=1` on both Coolify applications for one week.
- After one week: collect `curl -w` TTFB samples from staging and prod box.
- Update `docs/reviews/dashboard-latency-taskforce-2026-06.md` with a "Post-cutover
  measurements" table next to the Vercel baseline.
- Remove `DASHBOARD_PERF_LOG=1` from the Coolify env after the measurement week.
- Update `docs/runbooks/` to reference the new hosting.
- Update the master docs index.

---

### E5 [AGENT] — Remove Vercel cron from vercel.json (already in progress)

Branch: merges into main as part of the D8 PR. The cron block removal from `vercel.json`
is the final code change confirming the Coolify worker is the sole drain mechanism.

---

## Phase F — Off-GitHub to Forgejo (primary remote)

> This phase is about moving day-to-day development workflow from GitHub to Forgejo as
> the primary remote. It is **separate from the hosting cutover** and should only start
> after Phase E is complete and stable.

### What this phase covers

- Setting Forgejo (`git.allotmentology.tech/Allotment-Technology-Ltd/restormel-keys`) as
  the upstream remote for daily pushes.
- Moving PR review workflow from GitHub to Forgejo.
- Updating CI references.
- **Vercel preview deployments** will keep using GitHub as a mirror (GitHub stays as
  a push-mirror target via Forgejo's mirror settings) until/unless the previews question
  is resolved (migration plan §5, decision D4 and D6).

This phase has no detailed steps here — it warrants its own runbook once the
infrastructure is stable.

---

## Phase G — Off-Neon (FLAGGED — SEPARATE FUTURE PROJECT)

> **Do not attempt this phase until all of Phases A–F are complete and have been stable
> for a meaningful period (the migration plan suggests 14 days soak at a minimum).**

Moving off Neon (self-hosting Postgres, replacing Neon Auth with Better Auth) is a
separate, more complex undertaking. It was validated on the pilot (allotmentology.tech)
but has significant additional complexity for restormel-keys:

- Driver swap (`neon-http` → `pg` Pool) — needed PR #2-equivalent
- Neon Auth → Better Auth migration — UI, session shim, email delivery (SMTP/Migadu)
- Data migration (pg_dump → restore to self-hosted Postgres, maintenance window)
- Coolify Postgres provisioning on the prod box

This is a separate project with its own plan. It is flagged here for awareness. The
current plan deliberately keeps Neon managed and untouched throughout Stages 2.0–2.6.

---

## Appendix: quick reference

### SSH tunnel to Coolify (shared box)
```bash
ssh -i ~/.ssh/id_hetzner_<your-key> -L 8000:localhost:8000 -N deploy@77.42.125.150
# Then open http://localhost:8000
```

### Check staging TTFB
```bash
curl -w "\nDNS: %{time_namelookup}s  Connect: %{time_connect}s  TTFB: %{time_starttransfer}s  Total: %{time_total}s\n" \
  -o /dev/null -sf https://staging.restormel.dev/keys/dashboard
```

### Check prod box via --resolve (before DNS flip)
```bash
curl -sf --resolve restormel.dev:443:<prod-box-ip> https://restormel.dev/keys/v1/catalog
```

### Drain manually (emergency)
```bash
curl -sf -H "Authorization: Bearer <CRON_SECRET>" \
  https://restormel.dev/keys/dashboard/api/connect/ingest/drain
```

### Rollback DNS (one command, after TTL lowered)
Go to Vercel → DNS → revert apex A record to Vercel IP. No code change needed.

### Kill criteria summary (copy to incident channel)
1. Sign-in success rate drops
2. /keys/v1/catalog non-200 from allotmentology.tech
3. Paddle webhook failures
4. TTFB worse than baseline for >1h or recurring multi-second stalls
5. TLS cert missing on apex
6. Worker corrupting ingest state
