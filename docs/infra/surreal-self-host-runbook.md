# Self-host SurrealDB 3.x runbook (dogfooding + Sophia)

> **Scope & motivation.** Replace the **£25/mo Surreal Cloud** instance (Adam's dogfooding
> store + the store that powers the sibling **Sophia** project) with a **self-hosted
> SurrealDB 3.x on a dedicated box**. Target ≈£4–5/mo. This is **infrastructure for
> dogfooding + Sophia — NOT a restormel-keys product dependency**: the restormel product
> never runs a Surreal we own (every product Surreal path is BYO = the user's own endpoint;
> the managed/default store is the Postgres "graph spine"). See the Surreal-track finding in
> `docs/infra/database-strategy-roadmap.md` / memory `database-strategy`. **BYO-Surreal stays
> untouched.**
>
> **Dedicated box, on purpose.** This Surreal needs a **public, TLS+authed endpoint**
> (Surrealist on a laptop and Sophia both connect remotely). Do **not** put it on the prod
> Hetzner box (`77.42.125.150`, 8 GB no-swap) — it would add OOM risk and a public attack
> surface to production. A separate small box isolates both.
>
> Convention: **[OWNER]** = a human does it (Hetzner/Coolify UI, DNS, Surrealist); **[AGENT]**
> = a Claude agent can do it with box/Coolify access. **STOP** gates must be green before proceeding.

---

## 0. Verified 3.x facts (2026-06-13)

**Source is Surreal Cloud on 3.2** (Adam, 2026-06-13) — so the self-hosted box should run the
**same major+minor (3.2.x)** to make migration a trivial same-version export/import (no 2.x→3.x
upgrade dance). Pin the self-hosted image to match the Cloud version exactly. Key points that
shape this runbook (sources at bottom):

- **Storage:** use `rocksdb://<path>` for on-disk production data. (`surrealkv://` is beta;
  `memory` is non-persistent — do not use either here.)
- **Auth is ON by default.** Set a root user/pass explicitly; never pass `--unauthenticated`.
- **Start flags:** `--user`/`--pass` (env `SURREAL_USER`/`SURREAL_PASS`), `--bind`
  (env `SURREAL_BIND`, default `127.0.0.1:8000`), storage as a positional `rocksdb://…`
  (env `SURREAL_PATH`), TLS `--web-crt`/`--web-key` (env `SURREAL_WEB_CRT`/`SURREAL_WEB_KEY`),
  `--log` (env `SURREAL_LOG`), capability flags `--deny-all`/`--allow-funcs`/`--allow-net`/etc.
- **⚠️ 3.0 breaking change:** the **`--strict` startup flag was removed** — strict mode is now
  per-database via `DEFINE DATABASE … STRICT;`. Don't put `--strict` in the start command.
- **Migration is same-version (3.2 → 3.2):** since the Cloud source is already 3.2, this is a
  plain `surreal export` → `surreal import` — **no** 2.x→3.x migration diagnostics or
  breaking-change remediation needed. (Keep the self-hosted version ≥ the Cloud version; never
  import a newer-version dump into an older server.)

---

## 1. [OWNER] Provision the dedicated box + DNS

1. Hetzner Cloud: a **CX22** (2 vCPU / 4 GB, ~€4–5/mo) is ample for a single-node Surreal with
   RocksDB; CX11/CAX11 (2 GB) works if you skip Coolify and run plain Docker (§2 alt).
2. DNS: add an A record for a dedicated host, e.g. **`surreal.restormel.dev`** → the new box IP.
   (DNS is on Vercel — add it there. This is a *new* host; it doesn't affect the prod apex.)
3. Firewall (Hetzner Cloud Firewall): allow inbound **443** (TLS) and **22** (SSH, ideally
   IP-restricted) only. Do **not** expose 8000 publicly — TLS terminates at the proxy (§3).

---

## 2. Deploy SurrealDB 3.2.x

Pin the image to match your Cloud version (3.2.x; never `:latest`); confirm the exact patch tag on Docker Hub.

### Option A — Coolify (recommended if you want a UI + Traefik TLS + scheduled backups)
Install Coolify on the box, then add a **Docker Compose** resource with the compose below.
Coolify's Traefik handles the TLS cert for `surreal.restormel.dev` (§3) — bind Surreal to the
internal network only.

### Option B — plain Docker + Caddy (lean, fits a 2 GB box)
Run the compose directly; Caddy auto-provisions the TLS cert.

```yaml
# docker-compose.yml
services:
  surreal:
    image: surrealdb/surrealdb:v3.2.0   # MATCH your Surreal Cloud version (3.2.x) — verify the exact patch on Docker Hub. Never :latest.
    restart: always
    command:
      - start
      - --bind=0.0.0.0:8000
      - --log=info
      # capabilities: deny everything, then allow only what the app needs.
      # SurrealQL functions (BM25 analyzer, vector ops) need funcs allowed; KEEP net/scripting denied.
      - --deny-all
      - --allow-funcs
      - rocksdb:/data/surreal.db
    environment:
      SURREAL_USER: ${SURREAL_ROOT_USER}      # set in the box's env / Coolify secrets
      SURREAL_PASS: ${SURREAL_ROOT_PASS}      # openssl rand -base64 32 | tr -d '/+='
    volumes:
      - surreal-data:/data                    # the durability surface — back this up (§6)
    # Do NOT publish 8000 to the host in the Coolify/Traefik path; the proxy reaches it
    # over the internal network. For the Caddy path, keep it internal too (Caddy proxies it).
volumes:
  surreal-data:
```

> **Capabilities note:** start with `--deny-all --allow-funcs` and **test the app's SurrealQL**
> (HNSW vector index, BM25 full-text, KNN `<|k,ef|>`, record-link traversal — all used by
> `packages/graphrag-core/src/surreal-retrieval-enhancements.ts`). If a needed built-in is
> blocked, widen the allow-list minimally (e.g. `--allow-funcs=...`); do **not** `--allow-all`,
> and keep network + scripting denied.

> **STOP** — confirm the container is healthy (`docker logs`, a `surreal sql` connect with the
> root creds) before exposing it publicly.

---

## 3. TLS + public endpoint

- **Coolify path:** point Traefik at the `surreal` service for `surreal.restormel.dev`,
  TLS via Let's Encrypt (Coolify default). Surreal stays on the internal network.
- **Caddy path:** a one-line Caddyfile —
  ```
  surreal.restormel.dev {
      reverse_proxy surreal:8000
  }
  ```
  Caddy auto-provisions + renews the cert.
- SurrealDB speaks HTTP **and** WebSocket on 8000; both proxy cleanly. Clients then use
  `https://surreal.restormel.dev` (HTTP `/sql`) or `wss://surreal.restormel.dev` (RPC).
- Alternatively skip the proxy and give Surreal the cert directly via `--web-crt/--web-key`,
  but a proxy is simpler for auto-renewal.

---

## 4. [OWNER+AGENT] Migrate data from Surreal Cloud (3.2) → self-hosted 3.2

Same-version move — **no migration diagnostics / breaking-change remediation needed** (source
and target are both 3.2). Plain export → import:

1. **Export** from the Cloud instance → a `.surql` file (Surrealist export, or the CLI):
   ```bash
   surreal export --endpoint <surreal-cloud-endpoint> \
     --username … --password … --namespace <ns> --database <db> dump.surql
   ```
2. **Import** into the new box (per namespace/database):
   ```bash
   surreal import --endpoint https://surreal.restormel.dev \
     --username "$SURREAL_ROOT_USER" --password "$SURREAL_ROOT_PASS" \
     --namespace <ns> --database <db> dump.surql
   ```
   Repeat per ns/db if the Cloud holds more than one.
3. **[OWNER] Verify** row counts + a couple of representative graph queries on the new box match
   the Cloud source **before** repointing anything.

> **STOP** — do not repoint Surrealist/Sophia until the import is verified.

---

## 5. Repoint clients

- **Surrealist (Adam's laptop):** add a new connection → `https://surreal.restormel.dev` (or
  `wss://…`), root creds, same ns/db. Keep the Cloud connection until you've used the new one
  for a few days.
- **Sophia:** update Sophia's Surreal connection config/env (the equivalent of its
  `SURREAL_*` / graph-store URL) to the new endpoint + creds. *(Sophia is a separate repo —
  this step happens there; grep Sophia for `surreal`/`SURREAL_`/`ws://`/`wss://` to find it.)*
- **restormel-keys:** **no change** — the product doesn't use this instance. (If you ever point
  the MCP `RESTORMEL_GRAPH_STORE_URL` at it for personal dogfooding, that's fine; it's your store.)

---

## 6. Backups & resilience

- **Daily logical export off-box:** a scheduled `surreal export … dump-$(date).surql` shipped to
  Hetzner object storage / a storage box (Coolify scheduled task, or a cron + systemd timer).
- **Volume snapshots:** enable Hetzner daily snapshots on the box/volume holding `surreal-data`.
- **Restart policy:** `restart: always` (in the compose). RocksDB is crash-consistent — a hard
  kill loses only the in-flight write, not the database.
- Single node is proportionate for dogfooding + Sophia; revisit HA only if Sophia takes real load.

---

## 7. Security / hardening checklist

- [ ] Strong generated root password (`openssl rand -base64 32 | tr -d '/+='`), stored as a
      secret (Coolify env / box env), **never** committed.
- [ ] **Public access is TLS-only** via the proxy; port 8000 is **not** published to the host /
      internet. Firewall allows 443 + (restricted) 22 only.
- [ ] **Auth on** (no `--unauthenticated`); capabilities `--deny-all --allow-funcs` (net +
      scripting denied) — widen only as testing requires.
- [ ] Consider a non-root namespace/database user for the clients (Surrealist/Sophia) instead of
      using the root account day-to-day.
- [ ] Decommission the Surreal Cloud instance only **after** the new box is verified + backed up
      for a few days (it's the rollback during transition).

---

### Sources
- [Configuration | SurrealDB Docs](https://surrealdb.com/docs/manage/self-hosted/configuration)
- [`surreal start` CLI reference](https://surrealdb.com/docs/surrealdb/cli/start)
- [Deployment | SurrealDB Docs](https://surrealdb.com/docs/build/deployment)
- [SurrealDB Docker image](https://hub.docker.com/r/surrealdb/surrealdb)
