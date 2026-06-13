# Self-host SurrealDB 3.2 — comprehensive phased runbook (private network + Coolify 2nd server)

> **Scope & motivation.** Replace the **£25/mo Surreal Cloud** instance (Adam's dogfooding
> store + the store that powers the sibling **Sophia** project) with a **self-hosted
> SurrealDB 3.2 on a dedicated, private-networked Hetzner box managed by Coolify**.
> Target ≈£4–5/mo. This is **infrastructure for dogfooding + Sophia — NOT a restormel-keys
> product dependency**: the restormel product never runs a Surreal we own (every product
> Surreal path is BYO = the user's own endpoint; the managed/default store is the Postgres
> "graph spine"). See `docs/infra/database-strategy-roadmap.md` / memory `database-strategy`.
> **BYO-Surreal stays untouched.**
>
> **Design goal of this runbook: the AGENT does almost everything; the OWNER touches the
> bare minimum.** Every step is tagged **[OWNER]** (a human must do it — token creation, DNS,
> a one-time Coolify UI click, a laptop keypair, and go/no-go approval) or **[AGENT]** (a
> Claude agent does it, given the three tokens below). Every **[OWNER]** step is
> beginner-friendly: exact console path, copy-paste commands, and a "**Success looks like**"
> line. Every destructive/cutover step has a **STOP** gate.

---

## Operator TL;DR — the only things the OWNER ever touches

If you do these ~7 things, the agent does the rest. (Section references in brackets.)

1. **Create 3 API tokens** and paste them to the agent over a secure channel — §1:
   - **Hetzner Cloud API token** (`HCLOUD_TOKEN`) — lets the agent provision the box.
   - **Coolify API token** (`COOLIFY_TOKEN`) — lets the agent add the server + deploy.
   - **Surreal Cloud source creds** (endpoint URL + root user/pass) — for the data migration.
2. **Add one DNS record** in Vercel: `surreal.restormel.dev` A → the new box's public IP
   (the agent gives you the IP after it provisions the box) — §3.6.
3. **One Coolify UI click** to "Validate" the new server, *only if* the agent's API call
   can't auto-validate (the agent will tell you) — §3.5.
4. **Approve the go/no-go** before the data cutover (after the agent shows you verified
   row counts) — §3.10 STOP gate.
5. **Repoint two clients** when the agent says they're ready: Surrealist (laptop) and
   Sophia (Railway env var) — §3.11 (Surrealist is a 2-minute laptop task; Sophia is one
   env var the agent prepares for you).
6. **(Phase 2 only, later)** Generate a WireGuard keypair on your laptop and paste the
   **public** key to the agent — §4.3.
7. **Decommission Surreal Cloud** (cancel the £25/mo plan) once everything is verified and
   backed up for a few days — §3.13 / §6.

Everything else — provisioning, networking, firewall, swap, deploying Surreal, TLS, the
root + scoped users, the export/import, backups, and the Phase-2 private switch — is **[AGENT]**.

---

## 0. Verified facts (2026-06-13)

**Source is Surreal Cloud on 3.2** (Adam, 2026-06-13) — so the self-hosted box runs the
**same major+minor (3.2.x)**, making migration a trivial same-version export/import (no
2.x→3.x upgrade dance). Pin the self-hosted image to match the Cloud version exactly.

### 0.1 Existing infrastructure this plugs into (do not re-litigate)
- **Prod box:** Hetzner **CX32-class** at public IP `77.42.125.150`, running Coolify +
  Forgejo + act_runner (control plane). It is **already attached to a Hetzner Cloud Network**
  and holds the **private IP `10.0.1.1`** (Forgejo answers on `10.0.1.1:22222` —
  `docs/infra/coolify-cutover-runbook.md` B3). The **new Surreal box joins that same network
  and same network zone** and gets a `10.0.1.x` private IP. Inter-box traffic is private + free.
- **Coolify control plane stays on the prod box.** The new box is added as a **second
  ("remote") server** in the existing Coolify — it just runs Docker + Surreal + the proxy.
  That is why **4 GB is enough**: no control plane, no builds on this box.
- **⚠️ Cross-box reachability:** an app on the prod box (or a future Sophia container on it)
  reaches Surreal at the **private IP `10.0.1.x:8000`**, **NOT** a Coolify docker service
  name (service-name DNS only works *within one server's* docker network).
- **DNS** is on **Vercel** → the `surreal.restormel.dev` A record is an **[OWNER]** step
  (the agent has no Vercel DNS write access).

### 0.2 SurrealDB 3.2 facts that shape the commands (sources at bottom)
- **Storage:** `rocksdb:<path>` positional arg for on-disk production data. (`surrealkv://`
  is beta; `memory` is non-persistent — do not use either.)
- **Auth is ON by default.** Set a root user/pass explicitly; never pass `--unauthenticated`.
- **`surreal start` flags** (all confirmed against the CLI docs):
  `--bind` (env `SURREAL_BIND`, default `127.0.0.1:8000`); `--user`/`--pass`
  (env `SURREAL_USER`/`SURREAL_PASS`); storage as a positional `rocksdb:/path`;
  TLS `--web-crt`/`--web-key` (env `SURREAL_WEB_CRT`/`SURREAL_WEB_KEY`); `--log`
  (env `SURREAL_LOG`, default `info`); capabilities `--deny-all` (`SURREAL_CAPS_DENY_ALL`),
  `--allow-funcs` (`SURREAL_CAPS_ALLOW_FUNC`), `--allow-net`, `--allow-scripting`.
- **⚠️ 3.0 breaking change:** the **`--strict` startup flag was removed** — strict mode is
  now per-database via `DEFINE DATABASE … STRICT;`. Do **not** put `--strict` in the start
  command.
- **Scoped users (not root for Sophia):** SurrealDB 3.x has built-in roles **OWNER / EDITOR /
  VIEWER** and supports `DEFINE USER … ON NAMESPACE` / `… ON DATABASE … ROLES …`. Sophia gets
  a **database-level EDITOR** user — read/write to *its* db only, no IAM/root. See §3.9.
- **Migration is same-version (3.2 → 3.2):** plain `surreal export` → `surreal import`. No
  migration diagnostics or breaking-change remediation. (Keep the self-hosted version ≥ the
  Cloud version; never import a newer-version dump into an older server.)

### 0.3 SurrealQL the app actually exercises (drives the capability test in §3.8)
From `packages/graphrag-core/src/hybrid-candidate-generation.ts`:
- **BM25 full-text:** `DEFINE INDEX … FIELDS text SEARCH ANALYZER …_english BM25;`
- **HNSW vector index:** `DEFINE INDEX … FIELDS embedding HNSW DIMENSION 768 DIST COSINE;`
- **KNN search operator:** `WHERE embedding <|$limit,64|> $query_embedding`
- plus record-link traversal. All must work under `--deny-all --allow-funcs` (§3.8).

---

# PHASE 1 — Public TLS endpoint (now: Sophia is on Railway)

**Why Phase 1 is public.** Sophia currently runs on **Railway**, whose egress IPs are
**dynamic** → they **cannot be IP-allowlisted**. So during Phase 1 the box exposes a public
TLS endpoint `surreal.restormel.dev`, and security rests on: **TLS + a strong root password +
a scoped non-root Sophia user (never root) + a Hetzner Cloud Firewall** that locks SSH to the
owner's IP and exposes only 443. Surrealist (laptop) uses the same endpoint. Phase 2 (§4)
closes the public door once Sophia moves onto the private network.

---

## 1. [OWNER] Create the three tokens (beginner-friendly)

> Do these once, paste the values to the agent over a secure channel (password manager share,
> not chat history that persists). The agent cannot create these — they are account-scoped.

### 1.1 Hetzner Cloud API token — `HCLOUD_TOKEN`
1. Open **https://console.hetzner.cloud** and select the **same project** that contains the
   prod box `77.42.125.150` (top-left project switcher). This matters — the new box must be
   in the *same project* to share the Cloud Network.
2. Left sidebar → **Security** → **API tokens** tab → **Generate API token**.
3. Name it `restormel-surreal-agent`; permission **Read & Write**; click **Generate API token**.
4. **Copy the token now** — Hetzner shows it once.

**Success looks like:** a ~64-char token string starting with letters/numbers, shown once in
a green box. Paste it to the agent as `HCLOUD_TOKEN`.

### 1.2 Coolify API token — `COOLIFY_TOKEN`
1. Open Coolify. It runs on the prod box, reachable via an SSH tunnel:
   ```bash
   ssh -i ~/.ssh/id_hetzner_restormel_prod -L 8000:localhost:8000 -N deploy@77.42.125.150
   ```
   Then open **http://localhost:8000** in your browser.
2. Bottom-left **Settings (gear)** → **Keys & Tokens** → **API tokens** → **Create New Token**.
3. Name `surreal-agent`; tick **read**, **write**, **deploy** (leave **root** and
   **read:sensitive** unticked). Create.
4. **Copy the token now.**

**Success looks like:** a token shown once. Paste it to the agent as `COOLIFY_TOKEN`.

### 1.3 Surreal Cloud source creds (for migration only)
From your Surreal Cloud dashboard (or Surrealist's saved connection), give the agent:
- the **endpoint URL** (e.g. `wss://<id>.surreal.cloud` or the HTTP form),
- the **root username** and **password**,
- the **namespace(s)** and **database(s)** to migrate.

**Success looks like:** the agent can run a read-only `surreal sql` against Cloud and list
your namespaces (it will confirm back to you before exporting anything).

---

## 2. [AGENT] Provision the box (hcloud)

> The agent runs these with `HCLOUD_TOKEN` exported. All commands web-verified against the
> hcloud CLI docs. Region matches the prod box (`fsn1` or `nbg1` — confirm with
> `hcloud server describe 77.42.125.150` or the console; **must be the same network zone**,
> which for fsn1/nbg1 is `eu-central`).

```bash
export HCLOUD_TOKEN=...                       # owner-provided (§1.1)

# 2.1 — Register an SSH key the AGENT holds for THIS box (not the prod box key).
ssh-keygen -t ed25519 -f ~/.ssh/id_surreal_box -N "" -C "restormel-surreal-agent"
hcloud ssh-key create --name restormel-surreal-agent \
  --public-key-from-file ~/.ssh/id_surreal_box.pub

# 2.2 — Create the box. CX22 = 2 vCPU / 4 GB (~€4–5/mo) is the default.
#   ARM alt (cheaper): --type cax11 (2 GB) or cax21 (4 GB) — SurrealDB ships arm64.
#   Heavy HNSW/vector indexing? bump to --type cx32 (8 GB). Pick the SAME --location as prod.
hcloud server create \
  --name restormel-surreal \
  --type cx22 \
  --image ubuntu-24.04 \
  --location nbg1 \
  --ssh-key restormel-surreal-agent
```

**Success looks like:** `hcloud server list` shows `restormel-surreal` as `running` with a
public IPv4. Note that IP — the owner needs it for DNS (§3.6).

```bash
hcloud server ip restormel-surreal             # prints the public IPv4
```

> The agent SSHes to this box as `ssh -i ~/.ssh/id_surreal_box root@<new-box-ip>`. **This is
> NOT the prod box** — the agent holds this box's key, so SSH-driven steps here are in-scope
> for the agent (unlike the prod box).

---

## 3. Phase-1 build-out

### 3.1 [AGENT] Attach the box to the existing Cloud Network

The prod box already sits on a Cloud Network (private `10.0.1.1`). Find it and attach.

```bash
# Find the existing network's name/zone/range (the prod box is on it):
hcloud network list
hcloud server describe restormel-surreal       # later shows the assigned private IP

# Attach the new box to that network, requesting a free private IP in the 10.0.1.x range:
hcloud server attach-to-network restormel-surreal \
  --network <existing-network-name> \
  --ip 10.0.1.2                                # pick a free address; verify it's unused first
```

**Success looks like:** `hcloud server describe restormel-surreal` lists a **private net** with
IP `10.0.1.2` (or whatever was free). This `10.0.1.x` is the **PRIVATE_SURREAL_IP** used in
Phase 2. Confirm prod→new private reachability:
```bash
ssh -i ~/.ssh/id_hetzner_restormel_prod deploy@77.42.125.150 'ping -c2 10.0.1.2'
```

> If no Cloud Network exists yet (it should — Forgejo uses `10.0.1.1`), create one:
> ```bash
> hcloud network create --name restormel-net --ip-range 10.0.0.0/16
> hcloud network add-subnet restormel-net --network-zone eu-central --type cloud --ip-range 10.0.1.0/24
> ```

### 3.2 [AGENT] Configure the Hetzner Cloud Firewall

> **Why a Cloud Firewall, not just ufw:** Docker bypasses ufw and binds container ports to
> `0.0.0.0`; the Hetzner Cloud Firewall is the authoritative inbound gate (verified on the
> prod box — `coolify-cutover-runbook.md` A1). We still add ufw as belt-and-braces (§3.4).
>
> **Phase 1 inbound rules:** **443** (public TLS, from anywhere — Railway egress is dynamic so
> we cannot pin it); **22** (SSH) **locked to the owner's IP**. Do **NOT** expose 8000 publicly.
> Private network traffic (the `10.0.x.x` range) is allowed implicitly between attached servers.

```bash
OWNER_IP=$(curl -s https://ipv4.icanhazip.com)   # the owner runs this on their laptop and
                                                  # gives the agent the value, OR agent uses
                                                  # the owner-stated home/office IP.

hcloud firewall create --name restormel-surreal-fw

# 443 from anywhere (Surrealist + Railway/Sophia in Phase 1):
hcloud firewall add-rule restormel-surreal-fw \
  --direction in --protocol tcp --port 443 \
  --source-ips 0.0.0.0/0 --source-ips ::/0 \
  --description "public TLS endpoint"

# 22 SSH locked to the owner's IP only:
hcloud firewall add-rule restormel-surreal-fw \
  --direction in --protocol tcp --port 22 \
  --source-ips ${OWNER_IP}/32 \
  --description "SSH owner-only"

# Apply to this server:
hcloud firewall apply-to-resource restormel-surreal-fw \
  --type server --server restormel-surreal
```

**Success looks like:** `hcloud firewall describe restormel-surreal-fw` shows the two inbound
rules and the applied resource. From a non-owner network, `nc -vz <box-ip> 22` is refused;
`nc -vz <box-ip> 443` connects (once §3.7 deploys the proxy).

> **STOP** — confirm 8000 is **not** in any inbound rule before going further.

### 3.3 [AGENT] Host basics + Docker (SSH to the new box)

```bash
ssh -i ~/.ssh/id_surreal_box root@<new-box-ip>
```
Then on the box (the agent runs this — it is the new box, agent-held key):
```bash
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -yq ca-certificates curl gnupg ufw fail2ban
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | tee /etc/apt/sources.list.d/docker.list
apt-get update -q
apt-get install -yq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

> If you add the box to Coolify via the API (§3.5), Coolify installs Docker itself during
> validation — this manual install is then a no-op/skippable. It is listed so the box is
> usable even on the standalone-Docker fallback.

### 3.4 [AGENT] Add a ~2 GB swap file (Hetzner images ship with none)

```bash
fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab          # persist across reboot
sysctl vm.swappiness=10
echo 'vm.swappiness=10' >> /etc/sysctl.conf              # prefer RAM, use swap as a safety net
```

**Success looks like:** `swapon --show` lists `/swapfile 2G`, and `free -h` shows a 2.0Gi Swap
row. (RocksDB + a single Surreal node fit 4 GB comfortably; swap is the OOM safety net.)

ufw as a second layer (Cloud Firewall is primary):
```bash
ufw default deny incoming && ufw default allow outgoing
ufw allow 22/tcp && ufw allow 443/tcp
ufw --force enable
```

### 3.5 [AGENT, with one optional [OWNER] click] Add the box to Coolify as a 2nd server

> Coolify's API **does** support this (web-verified): `POST /private-keys` stores the SSH key,
> then `POST /servers` registers the box. Coolify validates over SSH and installs Docker.

```bash
COOLIFY="http://localhost:8000/api/v1"     # agent reaches Coolify via the same SSH tunnel
                                           # the owner used in §1.2, or runs on the prod box.
export COOLIFY_TOKEN=...                   # owner-provided (§1.2)

# 3.5a — Store the private key Coolify will use to reach the new box.
#   Use the same key the agent created in §2.1 (no passphrase — Coolify requires none).
curl -sf -X POST "$COOLIFY/private-keys" \
  -H "Authorization: Bearer $COOLIFY_TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"surreal-box-key\",\"private_key\":\"$(awk '{printf "%s\\n",$0}' ~/.ssh/id_surreal_box)\"}"
# → returns {"uuid":"<KEY_UUID>"}

# 3.5b — Register the new box as a server. instant_validate=true makes Coolify SSH in,
#   check Docker, and install it if missing.
curl -sf -X POST "$COOLIFY/servers" \
  -H "Authorization: Bearer $COOLIFY_TOKEN" -H "Content-Type: application/json" \
  -d '{
        "name": "restormel-surreal",
        "description": "Dedicated SurrealDB 3.2 box",
        "ip": "10.0.1.2",
        "port": 22,
        "user": "root",
        "private_key_uuid": "<KEY_UUID>",
        "is_build_server": false,
        "instant_validate": true,
        "proxy_type": "traefik"
      }'
```

> **Note on the IP field:** register the box by its **private IP `10.0.1.2`** so Coolify's
> control-plane→box management traffic stays on the private network (the prod box and this box
> share it). Public 22 is owner-only anyway (§3.2).

**[OWNER] one click — only if the API validate fails** (the agent will tell you the exact
error): open Coolify → **Servers** → `restormel-surreal` → click **Validate Server**.
**Success looks like:** the server shows a green **Reachable** badge and "Docker installed".

### 3.6 [OWNER] Add the DNS record (Vercel) — beginner steps

1. Go to **https://vercel.com/dashboard** → the **restormel.dev** domain → **DNS** tab.
2. Click **Add Record**:
   - **Type:** `A`
   - **Name:** `surreal`
   - **Value:** the **public IPv4** the agent gave you from §2 (e.g. `<new-box-ip>`).
   - **TTL:** `300`
3. **Save.**

> **Negative-cache gotcha:** if you (or the agent) query `surreal.restormel.dev` *before*
> the record exists, a resolver may cache the NXDOMAIN for hours. If `dig` doesn't resolve
> after a few minutes, query against `@1.1.1.1`.

**Success looks like:** `dig surreal.restormel.dev @1.1.1.1 +short` returns the box's public IP.
Tell the agent once this resolves.

### 3.7 [AGENT] Deploy SurrealDB 3.2 via Coolify (Docker Compose resource)

In Coolify, create a **Docker Compose** resource targeted at the **`restormel-surreal`** server
(via API or, if needed, the UI: **New Resource → Docker Compose → server: restormel-surreal**).
Coolify's Traefik terminates TLS for `surreal.restormel.dev` (§3.8); Surreal stays on the
internal docker network — **8000 is never published to the host**.

```yaml
# docker-compose.yml (Coolify resource)
services:
  surreal:
    image: surrealdb/surrealdb:v3.2.0   # MATCH Surreal Cloud's version (3.2.x). Verify the exact
                                        # patch tag on Docker Hub. Never :latest. (arm64 multi-arch.)
    restart: always
    command:
      - start
      - --bind=0.0.0.0:8000             # inside the container network only — NOT published
      - --log=info
      # Capabilities: deny everything, then allow ONLY SurrealQL functions (BM25 analyzer,
      # vector/KNN ops). KEEP network + scripting DENIED. See §3.8 for the test.
      - --deny-all
      - --allow-funcs
      - rocksdb:/data/surreal.db        # positional storage path (on-disk, crash-consistent)
    environment:
      SURREAL_USER: ${SURREAL_ROOT_USER}      # Coolify secret
      SURREAL_PASS: ${SURREAL_ROOT_PASS}      # Coolify secret: openssl rand -base64 32 | tr -d '/+='
    volumes:
      - surreal-data:/data                    # the durability surface — backed up in §3.12
    labels:
      # Coolify/Traefik: expose service on 443 for the FQDN, proxy → container:8000.
      # In Coolify you set the domain (https://surreal.restormel.dev) in the resource UI;
      # it generates the Traefik labels. Shown here for clarity.
      - "traefik.enable=true"
      - "traefik.http.routers.surreal.rule=Host(`surreal.restormel.dev`)"
      - "traefik.http.routers.surreal.tls.certresolver=letsencrypt"
      - "traefik.http.services.surreal.loadbalancer.server.port=8000"
volumes:
  surreal-data:
```

Set the two secrets in Coolify (**resource → Environment Variables → +Secret**):
`SURREAL_ROOT_USER` (e.g. `root`) and `SURREAL_ROOT_PASS` (`openssl rand -base64 32 | tr -d '/+='`).
Deploy.

**Success looks like:** Coolify shows the resource green; `docker logs` (or Coolify logs) show
Surreal started, `Started web server on 0.0.0.0:8000`, no auth-disabled warning.

> **STOP** — confirm the container is healthy and you can connect with root creds *over the
> internal network* before exposing it. From the box:
> ```bash
> docker exec -it <surreal-container> /surreal sql \
>   --endpoint http://localhost:8000 --user "$SURREAL_ROOT_USER" --pass "$SURREAL_ROOT_PASS" \
>   --pretty
> # then: INFO FOR ROOT;
> ```

### 3.8 [AGENT] TLS + capability verification

- **TLS:** Coolify/Traefik auto-issues a Let's Encrypt cert for `surreal.restormel.dev` once
  DNS (§3.6) resolves to the box and 443 is open (§3.2). SurrealDB speaks **HTTP and WebSocket
  on 8000**; both proxy cleanly, so clients use `https://surreal.restormel.dev` (HTTP `/sql`)
  or `wss://surreal.restormel.dev` (RPC).
- **Capability test (do this against the live endpoint with root):** run the app's real
  SurrealQL shapes to confirm `--deny-all --allow-funcs` is sufficient:
  ```surql
  -- BM25 full-text (analyzer + SEARCH index)
  DEFINE ANALYZER english_test TOKENIZERS class FILTERS lowercase, snowball(english);
  DEFINE INDEX t_search ON unit FIELDS text SEARCH ANALYZER english_test BM25;
  -- HNSW vector index (Sophia embeds at 768 dims, cosine)
  DEFINE INDEX t_embed ON passage FIELDS embedding HNSW DIMENSION 768 DIST COSINE;
  -- KNN operator
  SELECT id FROM passage WHERE embedding <|5,64|> [/* 768-float probe */];
  ```
  If a needed built-in is blocked, **widen minimally** (e.g. `--allow-funcs="search,vector"`
  style); do **not** `--allow-all`, and keep `net` + `scripting` denied. (These shapes come
  from `packages/graphrag-core/src/hybrid-candidate-generation.ts`.)

**Success looks like:** browser padlock valid on `https://surreal.restormel.dev`; the three
SurrealQL statements above succeed without a capability error.

### 3.9 [AGENT] Create the root admin + the scoped non-root Sophia user

> **Sophia must NOT get root.** Root is admin-only (you, via Surrealist, and the agent for
> migration/backups). Sophia gets a **database-level EDITOR** — read/write inside *its* db, no
> ability to touch users/tokens or other namespaces/databases. (Web-verified DEFINE USER syntax.)

Connect as root, select the namespace/database, then define the scoped user:
```surql
-- Root already exists from SURREAL_USER/PASS. Select Sophia's ns/db (use real names):
USE NS sophia DB graph;

-- Database-level EDITOR for Sophia (read+write data, NO user/token/IAM, scoped to this db):
DEFINE USER sophia_app ON DATABASE
  PASSWORD 'PASTE_A_STRONG_GENERATED_PASSWORD'
  ROLES EDITOR
  COMMENT 'Sophia app — db-scoped, non-root';
```
Generate the password with `openssl rand -base64 32 | tr -d '/+='` and store it as a Coolify
secret / hand it to the owner for the Sophia env var (§3.11).

> **How Sophia authenticates as this user (web-verified — different from root!):** a
> database-level user **must** supply the namespace **and** database at sign-in:
> - **SDK:** `db.signin({ namespace: 'sophia', database: 'graph', username: 'sophia_app', password: '…' })`
> - **HTTP signin payload:** `{"NS":"sophia","DB":"graph","user":"sophia_app","pass":"…"}`
>
> Surrealist for the owner can keep using **root** (or its own admin user) for full visibility.

**Roles reference (built-in):** OWNER = view+edit everything at its level or below *including*
users/tokens; EDITOR = view+edit data but **not** users/tokens; VIEWER = read-only. Sophia gets
EDITOR; never OWNER, never root.

### 3.10 [OWNER+AGENT] Migrate data from Surreal Cloud (3.2) → the box (3.2)

Same-version move — **no migration diagnostics needed** (both 3.2). Plain export → import.

1. **[AGENT] Export** each namespace/database from Cloud → a `.surql` file. Auth as the Cloud
   **root** user (note `--auth-level root` and the `--ns`/`--db` aliases — web-verified):
   ```bash
   surreal export \
     --endpoint <surreal-cloud-endpoint> \
     --username "<cloud-root-user>" --password "<cloud-root-pass>" --auth-level root \
     --namespace <ns> --database <db> \
     dump-<ns>-<db>.surql
   ```
2. **[AGENT] Import** into the box (per ns/db). Auth as the box **root**:
   ```bash
   surreal import \
     --endpoint https://surreal.restormel.dev \
     --username "$SURREAL_ROOT_USER" --password "$SURREAL_ROOT_PASS" --auth-level root \
     --namespace <ns> --database <db> \
     dump-<ns>-<db>.surql
   ```
   Repeat per ns/db. (Re-run §3.9 to (re)define `sophia_app` *after* import if the import
   recreated the database, since a fresh db won't carry the user.)
3. **[AGENT] Verify** row counts + representative graph/KNN queries on the box match Cloud:
   ```surql
   USE NS <ns> DB <db>;
   SELECT count() FROM <main-table> GROUP ALL;
   -- spot-check a known record-link traversal and a KNN query return the same shape.
   ```

> **STOP — go/no-go cutover gate.** The agent shows the owner the row-count comparison
> (Cloud vs box) and a couple of sample query results. **[OWNER] approves** before any client
> is repointed. Do not repoint Surrealist/Sophia until the owner says go.

### 3.11 [OWNER] Repoint the two clients (agent prepares everything)

- **Surrealist (laptop) — 2-minute task:** open Surrealist → **New connection** →
  Protocol **HTTPS** (or **WSS**), address `surreal.restormel.dev`, auth **Root**, your root
  user/pass, same ns/db. **Keep the Cloud connection saved** until you've used the box for a
  few days.
  **Success looks like:** the box connection lists your namespaces and a table preview loads.
- **Sophia (Railway) — one env var:** the agent prepares the exact values; you paste them into
  Railway → Sophia service → **Variables**:
  - endpoint → `wss://surreal.restormel.dev` (or the HTTP form Sophia expects),
  - user → `sophia_app`, pass → the §3.9 password,
  - **namespace + database** must be set (the scoped user requires them — §3.9).
  Redeploy Sophia. **Success looks like:** Sophia boots, a graph read/write succeeds, no
  auth/permission errors in its logs.
- **restormel-keys:** **no change** — the product doesn't use this instance (BYO-Surreal only).

### 3.12 [AGENT] Scheduled-export backups

- **Daily logical export off-box** (Coolify **Scheduled Task** on the resource, or a
  systemd timer on the box):
  ```bash
  surreal export --endpoint http://localhost:8000 \
    --username "$SURREAL_ROOT_USER" --password "$SURREAL_ROOT_PASS" --auth-level root \
    --namespace <ns> --database <db> \
    /backups/dump-$(date +%F).surql
  # then ship /backups off-box → Hetzner Object Storage / Storage Box (retain ~14 days).
  ```
- **Volume snapshots:** enable Hetzner automatic snapshots on `restormel-surreal`
  (covers the `surreal-data` volume) — console → server → **Backups/Snapshots**.
- **Restart policy:** `restart: always` (compose). RocksDB is crash-consistent — a hard kill
  loses only the in-flight write.

**Success looks like:** the first scheduled export file lands off-box; one snapshot exists.

### 3.13 [OWNER] Decommission Surreal Cloud — only after a few clean days

**STOP — do not cancel Surreal Cloud until** the box has served Surrealist + Sophia cleanly for
a few days **and** at least one off-box backup + one snapshot exist (Cloud is your rollback
during transition — see §6). Then cancel the £25/mo plan in the Surreal Cloud dashboard.

---

# PHASE 2 — Private-only (when Sophia migrates to Hetzner + Coolify)

**Trigger:** Sophia moves off Railway onto the Hetzner all-in-one / Coolify box (see
`docs/infra/sophia-coolify-migration-plan.md`). Now Sophia is on the **same private network**,
so it can reach Surreal at `10.0.1.x:8000` directly — and the public endpoint becomes
unnecessary attack surface. Laptop (Surrealist) access then goes over **WireGuard**.

**No app change beyond the endpoint:** Sophia's only change is its Surreal endpoint
(`wss://surreal.restormel.dev` → `ws://10.0.1.2:8000`) + it keeps the same scoped `sophia_app`
user/ns/db.

## 4. Phase-2 cutover

### 4.1 [AGENT] Repoint Sophia to the private IP
With Sophia now a Coolify app on the prod/all-in-one box, set its Surreal endpoint to the
**private IP** (web-verified: cross-box must use the private IP, **not** a docker service name):
```
SURREAL_ENDPOINT=ws://10.0.1.2:8000     # PRIVATE_SURREAL_IP:8000 (plain ws on the private net)
SURREAL_USER=sophia_app
SURREAL_PASS=<§3.9 password>
SURREAL_NS=sophia
SURREAL_DB=graph
```
Redeploy Sophia. **Success looks like:** Sophia reads/writes the graph over `10.0.1.2:8000`;
no traffic to `surreal.restormel.dev`.

> **STOP** — confirm Sophia is fully working over the private IP **before** closing public 443.

### 4.2 [AGENT] Make Surreal private-only (close public 443)
1. Remove the public 443 rule (and the domain/Traefik route for `surreal.restormel.dev`):
   ```bash
   hcloud firewall delete-rule restormel-surreal-fw \
     --direction in --protocol tcp --port 443 --source-ips 0.0.0.0/0 --source-ips ::/0
   ```
   (Or recreate the firewall with only the SSH-owner rule + WireGuard UDP — see §4.4.)
2. In Coolify, remove the `surreal.restormel.dev` domain from the resource (drops the Traefik
   public route). Surreal now answers only on the private network + (via WireGuard) the laptop.
3. **[OWNER]** Optional: delete the `surreal.restormel.dev` A record in Vercel DNS (cleanup).

**Success looks like:** from the public internet, `nc -vz <box-ip> 443` is refused; from the
prod box, `nc -vz 10.0.1.2 8000` connects.

### 4.3 [OWNER] Generate a WireGuard keypair on the laptop
1. Install WireGuard (macOS: the **WireGuard** app from the App Store; or `brew install wireguard-tools`).
2. Generate a keypair:
   ```bash
   wg genkey | tee laptop-private.key | wg pubkey > laptop-public.key
   ```
3. **Paste the laptop _public_ key to the agent** (never the private key).

**Success looks like:** you have two files; you share only `laptop-public.key`'s contents.

### 4.4 [AGENT] Stand up WireGuard on the box + give the laptop its config
On the box (web-verified minimal setup):
```bash
apt-get install -yq wireguard
SERVER_PRIV=$(wg genkey); SERVER_PUB=$(echo "$SERVER_PRIV" | wg pubkey)
cat >/etc/wireguard/wg0.conf <<EOF
[Interface]
Address = 10.9.0.1/24
ListenPort = 51820
PrivateKey = ${SERVER_PRIV}

[Peer]
# Owner laptop
PublicKey = <LAPTOP_PUBLIC_KEY from §4.3>
AllowedIPs = 10.9.0.2/32
EOF
systemctl enable --now wg-quick@wg0
echo "give the owner this server public key: ${SERVER_PUB}"
```
Open the WireGuard UDP port to the owner's IP on the Cloud Firewall:
```bash
hcloud firewall add-rule restormel-surreal-fw \
  --direction in --protocol udp --port 51820 \
  --source-ips ${OWNER_IP}/32 --description "WireGuard owner-only"
```
Give the owner this laptop `wg0.conf` (the agent fills `<SERVER_PUBLIC_KEY>` and `<box-ip>`):
```ini
[Interface]
PrivateKey = <from the laptop's laptop-private.key — owner pastes locally>
Address = 10.9.0.2/24

[Peer]
PublicKey = <SERVER_PUBLIC_KEY>
Endpoint = <box-ip>:51820
AllowedIPs = 10.9.0.0/24, 10.0.1.0/24    # reach the WG net + the Hetzner private net
PersistentKeepalive = 25
```

**[OWNER]** import that config into the WireGuard app and toggle the tunnel **on**.
**Success looks like:** with WireGuard on, `ping 10.0.1.2` works from the laptop, and
Surrealist connects to `ws://10.0.1.2:8000` (root/admin) — over the private tunnel, no public
endpoint.

---

## 5. Security / hardening checklist

- [ ] Strong generated **root** password (`openssl rand -base64 32 | tr -d '/+='`), stored as a
      Coolify secret, **never** committed.
- [ ] **Sophia uses the scoped `sophia_app` DB-level EDITOR user, never root** (§3.9).
- [ ] **Phase 1:** public is **TLS-only** via Traefik; **8000 is not published to the host**;
      Cloud Firewall = 443 (any) + 22 (owner IP) only.
- [ ] **Phase 2:** public 443 **closed**; Surreal private-only (`10.0.1.x:8000`); laptop via
      WireGuard (UDP 51820 owner-IP only).
- [ ] **Auth on** (no `--unauthenticated`); capabilities `--deny-all --allow-funcs` (net +
      scripting denied) — widened only as the §3.8 test requires.
- [ ] ufw enabled as a second layer; Cloud Firewall is the primary gate (Docker bypasses ufw).
- [ ] Swap file present (2 GB) so an indexing spike degrades instead of OOM-killing.
- [ ] Off-box daily export **and** Hetzner snapshots both running.
- [ ] **Surreal Cloud decommissioned only after** the box is verified + backed up for a few days.

---

## 6. Rollback

Rollback is "keep Surreal Cloud alive until proven", at three gates:

- **Before §3.10 cutover approval:** nothing has moved — Cloud is still authoritative; just
  don't repoint clients.
- **After repointing, before §3.13:** Surreal Cloud is **still running and untouched**. To
  roll back, repoint Surrealist + Sophia back to the Cloud endpoint/creds (one Surrealist
  connection switch + one Railway env revert). Because §3.10 only *read* from Cloud (export),
  Cloud's data is intact.
- **Box failure:** restore from the latest off-box `.surql` export (`surreal import`) onto a
  fresh box, or restore the Hetzner snapshot. Until §3.13, you can also just point back to Cloud.

> Do **not** cancel Surreal Cloud (§3.13) until you're past the rollback window (a few clean days).

---

## 7. Troubleshooting (beginner snags)

- **TLS cert not issuing for `surreal.restormel.dev`.** Cause: DNS not yet resolving to the box,
  or 443 closed. Fix: confirm `dig surreal.restormel.dev @1.1.1.1 +short` returns the box IP
  (§3.6) and the Cloud Firewall allows 443 (§3.2). Traefik retries ACME; if it cached a
  pre-DNS failure, restart the Coolify proxy (this exact gotcha bit the prod apex —
  `coolify-cutover-runbook.md` Stage 2.5).
- **Can't connect / connection refused on 443.** The Cloud Firewall, not ufw, is the gate.
  Check `hcloud firewall describe restormel-surreal-fw`. SSH refused? Your laptop IP changed —
  re-run §3.2's 22 rule with the new `OWNER_IP`.
- **Capability error on HNSW/BM25/KNN** (e.g. "function not allowed"). You're too locked down.
  Widen `--allow-funcs` minimally (§3.8) and redeploy; never `--allow-all`; keep net + scripting
  denied.
- **Sophia gets "authentication failed" or "no database selected".** A **database-level** user
  must pass **both** namespace and database at sign-in (§3.9). Set `SURREAL_NS` *and*
  `SURREAL_DB`; HTTP payload needs `NS` and `DB`.
- **Cross-box (Phase 2) "connection refused" using a service name.** You used a Coolify docker
  service name across servers — that only works within one server's network. Use the **private
  IP `10.0.1.x:8000`** (§4.1).
- **Wrong private IP.** Confirm with `hcloud server describe restormel-surreal` → the private
  net entry. Don't guess; `10.0.1.1` is the **prod box** (Forgejo), not this one.
- **OOM / box sluggish during indexing.** Confirm swap is on (`swapon --show`, §3.4); if HNSW
  builds are heavy, resize to `cx32` (`hcloud server change-type restormel-surreal --type cx32`,
  requires a brief reboot).

---

### Sources (web-verified 2026-06-13)
- [`surreal start` CLI reference](https://surrealdb.com/docs/surrealdb/cli/start) — start flags, capability env vars, `--strict` removed in 3.0
- [`DEFINE USER` statement](https://surrealdb.com/docs/surrealql/statements/define/user) — `ON NAMESPACE`/`ON DATABASE … ROLES`, OWNER/EDITOR/VIEWER
- [Authentication | SurrealDB Docs](https://surrealdb.com/docs/surrealdb/security/authentication) — db-level signin requires NS+DB (`{"NS","DB","user","pass"}`)
- [`surreal import` CLI reference](https://surrealdb.com/docs/reference/cli/surrealdb-cli/commands/import) — `--username/--password/--token/--auth-level`, `--ns/--db`, `--endpoint`
- [Configuration | SurrealDB Docs](https://surrealdb.com/docs/manage/self-hosted/configuration) · [SurrealDB Docker image](https://hub.docker.com/r/surrealdb/surrealdb)
- [hcloud CLI manual](https://github.com/hetznercloud/cli/blob/main/docs/reference/manual/hcloud.md) — `server create`, `network create`/`add-subnet`, `firewall create`/`add-rule`/`apply-to-resource`, `server attach-to-network`
- [Hetzner Cloud: Networks tutorial](https://community.hetzner.com/tutorials/hcloud-networks-basic/) — `add-subnet --network-zone eu-central`, `attach-to-network --ip`
- [Coolify API — create server](https://coolify.io/docs/api-reference/api/operations/create-server) — `POST /servers` fields; `POST /private-keys` for the SSH key; Bearer token
- [Coolify OpenSSH / multi-server](https://coolify.io/docs/knowledge-base/server/openssh) — add a 2nd server, key in `authorized_keys`, Validate; passphraseless key required
- [WireGuard on Ubuntu (Hetzner Community)](https://community.hetzner.com/tutorials/install-and-configure-wireguard-vpn/) — `wg genkey`/`pubkey`, `wg0.conf`, `AllowedIPs`, UDP 51820
- [Add swap on Ubuntu (DigitalOcean)](https://www.digitalocean.com/community/tutorials/how-to-add-swap-space-on-ubuntu-22-04) — `fallocate`/`mkswap`/`swapon`, `/etc/fstab`, `vm.swappiness`
