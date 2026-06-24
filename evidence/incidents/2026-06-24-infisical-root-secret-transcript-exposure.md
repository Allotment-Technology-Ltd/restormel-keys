---
id: REC-INC-010
title: "Root-level prod secrets (restormel + restormel-ops) read into a Claude Code subagent transcript via bulk Infisical --plain export"
class: evidence
owner: "@adam"
status: closed
classification: confidential
control-tier: 3
created: 2026-06-24
last-reviewed: 2026-06-24
review-interval: P12M
approved-by: founder
approved-on: 2026-06-24
retention: P6Y
related: [REC-TPL-004, REC-INC-004, RISK-010, RISK-002, REC-POL-004]
---

# Incident — Root-level prod secrets read into a subagent transcript via bulk Infisical `--plain` export

> Filed from REC-TPL-004. Append-only once closed. **Severity: high** — broad confidentiality exposure of
> root-level production credentials (DB, SSH-to-prod, Forgejo, Coolify, SMTP, SurrealDB root, Telegram, Brevo)
> to a local agent transcript and Anthropic session storage. No integrity/availability impact; live services
> unaffected; no evidence of unauthorised use. Rotation of the exposed secrets is the open follow-up and is
> **flagged for the founder, not yet done** (deliberately not auto-rotated).

- **Detected:** 2026-06-24, during the restormel.dev K3s cutover **Phase-A config migration**, in a Claude Code
  operator session.   **Reported by:** the automation subagent itself — self-reported immediately, in the same
  session, the moment it recognised the over-broad read.   **Severity:** high (confidentiality).

- **What happened:** An automation subagent, while gathering config for the Phase-A migration, ran a **bulk
  `infisical secrets` / `infisical export --plain`** read against the **project root path** for the Infisical
  projects **`restormel`** and **`restormel-ops`** (env **prod**), instead of fetching only the single key it
  needed. The `--plain` form printed **root-level prod secret VALUES** into the subagent's session transcript.
  The exposed key **NAMES** (values are not recorded here and were never written to any tracked file) were:
  - `COOLIFY_TOKEN`
  - `FORGEJO_PM_TOKEN`
  - `FORGEJO_GITEA_TOKEN`
  - `PG_RESTORMEL_*` — Postgres credentials (host/user/password/db family)
  - `SMTP_PASS`
  - `SURREAL_*` root credentials — including `SURREAL_BOX_ROOT_PASS` / `SURREAL_PASS`
  - `SSH_KEY_PROD_167` — SSH private key to the prod box (.167)
  - `TELEGRAM_BOT_TOKEN`
  - `BREVO_API_KEY`
  - …and other root-level `restormel` / `restormel-ops` **prod** keys captured by the same root-path read.

  **Prior minor flag, same program (folded in here):** earlier in the cutover program, `FORGEJO_PM_TOKEN` was
  briefly **echoed into an in-cluster pod log**; that pod has **since been deleted**. Same secret-handling class,
  recorded here for completeness so the rotation list is complete.

- **Impact (blast radius):** Confidentiality exposure only. The secret values reached **(a)** the local subagent
  **transcript JSONL on the founder's Mac**, and **(b)** **Anthropic session storage** (the managed conversation
  store for the Claude Code session). They were **NOT** written to any tracked repo file, **NOT** committed or
  pushed to git, and **NOT** sent to any external/third-party service. The earlier `FORGEJO_PM_TOKEN` echo reached
  a since-deleted in-cluster pod log. **No integrity or availability impact** — no service was changed and live
  services were unaffected. **No evidence of unauthorised use** of any exposed credential. The exposure is broad
  in *scope of credentials* (much of the prod estate: app/Forgejo Postgres, SSH to prod .167, Forgejo PM + Gitea
  tokens, Coolify API token, transactional SMTP, SurrealDB root, Telegram bot, Brevo API) which is why it is rated
  **high** despite the contained destinations.

- **Response (actions + timeline, 2026-06-24):**
  - Subagent **self-reported** the over-broad `--plain` read immediately, in-session, and **stopped** the bulk
    secret-read pattern.
  - **No secret was rotated by automation** — rotation of root-level prod credentials is high-risk and is
    deliberately **NOT auto-executed overnight**; it is escalated to the founder (see Follow-ups).
  - **No prod mutation** and **no further secret reads** were performed after detection.
  - This incident record filed (REC-TPL-004 → this file); `governance/risk-register.yaml` **RISK-010** updated to
    record that the in-session credential-exposure residual risk **materialised** and to carry the rotation
    follow-up; records register regenerated; frontmatter validated.

- **Root cause:** The agent used a **bulk `--plain` / export read scoped to the project root** instead of scoping
  the read to the **single key** it actually needed. This violates the infra-access **golden rule** — *never print
  secret values; never bulk-inject / bulk-export with values* (Secret Management Policy REC-POL-004 §7; RISK-010
  item 5). Convenience of one broad read over N scoped reads is the proximate driver. The earlier pod-log echo of
  `FORGEJO_PM_TOKEN` is the same class (a secret value reaching a log/transcript rather than only the consuming
  process env).

- **Follow-ups / remediation:**

  - **ROTATE the exposed root-level prod secrets** — *flagged for the founder, NOT yet done* (high-risk; deliberately
    not auto-rotated overnight; each rotation must be sequenced with its dependent services to avoid a self-inflicted
    outage). On rotation, update the value in Infisical (`restormel` / `restormel-ops`, env `prod`) **and** every
    runtime consumer (Coolify app env, CI secrets, the prod box, K3s/ESO secrets) **and** redeploy/restart the
    affected services. Itemised rotation list:
    - **Priority 1 (rotate first):**
      - `SSH_KEY_PROD_167` — SSH private key to prod box .167 (re-key: generate a new keypair, update
        `authorized_keys` on .167, replace the secret, then revoke the old key).
      - `PG_RESTORMEL_*` — Postgres credentials (rotate role password(s); update every consumer connection string).
      - `FORGEJO_PM_TOKEN` — Forgejo personal/management token (revoke + reissue; **also** covers the earlier
        pod-log echo).
      - `COOLIFY_TOKEN` — Coolify API token (revoke + reissue).
    - **Priority 2 (rotate next):**
      - `FORGEJO_GITEA_TOKEN` — Forgejo/Gitea API token (revoke + reissue).
      - `SURREAL_*` root credentials incl. `SURREAL_BOX_ROOT_PASS` / `SURREAL_PASS` — SurrealDB root password(s)
        (rotate; update `/opt/surreal/.env` / in-cluster secret and dependent services).
      - `SMTP_PASS` — Migadu transactional mailbox password (rotate; update Infisical + Coolify app env; redeploy).
      - `TELEGRAM_BOT_TOKEN` — Telegram bot token (revoke + reissue via BotFather).
      - `BREVO_API_KEY` — Brevo API key (revoke + reissue).
      - any other root-level `restormel` / `restormel-ops` prod keys captured by the same root-path read — enumerate
        from the two projects' prod root and rotate alongside.

  - **PREVENTIVE CONTROL — reinforce the golden rule (scope every secret read to a single key):**
    - **Never** run a bulk `infisical secrets` / `infisical export --plain` (or any values-printing export) against a
      project root or env. Read **exactly one key at a time**, scoped to the narrowest path.
    - Prefer **`infisical run --env=prod -- <cmd>`** so secrets are injected into the **child process environment
      only** — never into a shell variable, `argv`, a transcript, or a log (carries forward REC-INC-004's lesson).
    - **Never** echo or print a secret value to stdout, a transcript, or a log; treat any such exposure as an
      incident (REC-POL-004 §7). The viewer/read-only `restormel-cli` machine identity (RISK-010 item 4) bounds the
      *blast radius of access* but does **not** make a values-printing read acceptable.
    - Subagents performing config migration must request secrets by **named key**, not by glob/root, and must fail
      closed rather than fall back to a broad read.

  - **Records updated this incident:** `governance/risk-register.yaml` **RISK-010** treatment_status updated
    (residual in-session credential-exposure risk **materialised** as REC-INC-010; rotation follow-up carried); this
    record filed; register regenerated; frontmatter validated.

- **Closed:** 2026-06-24 (remediation actions listed and tracked; secret rotation is an open founder-flagged
  follow-up, not a blocker on closing the incident record).

---

## Rotation-progress addendum — 2026-06-24 (append-only; conservative mapping pass)

> Appended under the founder-approved rotation mandate. This pass **mapped consumers precisely and
> rotated ONLY what could be done unambiguously safely + autonomously**. Result: **0 creds rotated,
> all 10 FLAGGED to the founder** with per-cred runbooks below. No secret values were printed; no prod
> mutation; no secret reads beyond keys-only listings. Prod health verified **before** this pass
> (restormel.dev 200, api.plotbudget.com `/auth/v1/authorize?provider=google` 302, usesophia.app 200);
> nothing was changed, so health is unaffected.

### Decisive ground-truth established this pass (changes the rotation model)

1. **The exposed `restormel-ops` keys are now LEGACY DUPLICATES.** restormel.dev prod has been **cut over
   from Coolify (.167) to the K3s cluster** — restormel.dev now resolves to `135.181.25.76` (Hetzner K3s
   node), the old Coolify `restormel-dashboard-prod` app is `exited:unhealthy`, and `…-OLD150-standby`
   is a dead standby. The **live** prod cluster reads its secrets from **separate Infisical projects**,
   not `restormel-ops`:
   - App env + DB → Infisical **`restormel`** project via the `infisical-restormel` ClusterSecretStore
     (`restormel-gitops/applications/restormel-app-prod/10-externalsecret.yaml`). The live `DATABASE_URL`
     is **composed** from `PG_RESTORMEL_APP_USERNAME`/`PG_RESTORMEL_APP_PASSWORD` read out of the
     **`restormel`** project, and the **same** keys back the CNPG `pg-restormel-app-creds` secret.
   - Monitoring (Telegram, S3) → Infisical **`infrastructure`** project via `infisical-infra`
     (`restormel-gitops/monitoring/secrets/externalsecrets-monitoring.yaml`).
   - Per Secret-Management-Policy **§3a**, the `restormel-ops` → five-project split is **non-breaking
     (copy → repoint → remove); `restormel-ops` is retained intact until nothing references it.** So the
     exposed `restormel-ops` values are retained legacy copies, NOT the live source for the cut-over prod.
   - **Consequence:** rotating only the `restormel-ops` copy would be **security theatre** — it would not
     close the exposure (the live value, in the `restormel`/`infrastructure` project and/or the backing
     system, still works), and could break an un-enumerable legacy consumer. To actually invalidate each
     exposed secret you must rotate it **at the backing system AND in every Infisical project that holds a
     copy** (`restormel-ops` + the live per-product project) in lockstep.

2. **No K3s cluster access from this Mac** (no kubeconfig / context; `kubectl` has no server). Every cred
   whose live consumer is the cluster therefore needs an action I **cannot perform or verify autonomously**:
   ESO re-sync, CNPG `ALTER ROLE`, SurrealDB `ALTER USER`, or a workload restart. This alone makes the
   DB/Surreal/Telegram/SMTP creds **FOUNDER/RISKY**.

3. **CNPG owns the Postgres role password.** `PG_RESTORMEL_*` is enforced on the DB role by the CNPG
   operator from `pg-restormel-app-creds` (managed-role `passwordSecret`). An Infisical-only change does
   **not** rotate the DB password — CNPG must reconcile + `ALTER ROLE`, then pods restart. In-cluster only.

4. **`SSH_KEY_PROD_167` is effectively DEAD, not Priority-1.** The original list ranked it "rotate first /
   SSH to prod box .167"; correction: **.167 was wiped and is now `node3`** (non-prod). The key accesses
   node3, not prod, and is wired into **no live automation** (CI deploys via Coolify API / GitOps, not this
   key; backups use the BX11 restic key). → **low priority**, flag-and-retire.

5. **`BREVO_API_KEY` has ZERO code consumers.** No `brevo`/`sendinblue` reference exists in app/deploy/CI
   (only governance + a marketing-email plan/draft). It is an **orphan / future-marketing** key. → trivial
   blast radius; founder should **regen-or-retire**.

6. **Surreal has no live prod data path.** The scoped `surreal-dashboard-cred` ExternalSecret was **REMOVED
   2026-06-24** (nothing consumed it; `restormel-gitops/applications/restormel-app-prod/10-externalsecret.yaml`
   §3 comment). `SURREAL_*` root is admin/migration/backup break-glass only (in-cluster).

### Per-cred classification (this pass)

| Cred (exposed in `restormel-ops`) | Class | Why | Live consumer / where it really lives |
|---|---|---|---|
| `PG_RESTORMEL_*` (app + superuser) | **FOUNDER/RISKY** | CNPG owns role pw; in-cluster `ALTER ROLE` + ESO + pod restart; also in `restormel` project | K3s CNPG `pg-restormel-*` + composed `DATABASE_URL`, Infisical **`restormel`** |
| `SURREAL_*` root (`SURREAL_BOX_ROOT_PASS`/`SURREAL_PASS`) | **FOUNDER/RISKY** | SurrealDB `ALTER USER` in-cluster; break-glass; no Mac access | Infisical **`infrastructure`** (`SURREAL_ROOT_*`) + Surreal box; admin/backup only |
| `FORGEJO_PM_TOKEN` | **FOUNDER/RISKY** | Provider-regen (Forgejo) + many consumers: Forgejo Actions secret, K8s PostSync hook, **cowork-relay launchd on this Mac**, Infisical | `~/.config/cowork-relay/forgejo-token`, CI, K8s `forgejo-pm-token` |
| `FORGEJO_GITEA_TOKEN` | **FOUNDER/RISKY** | Provider-regen (Forgejo); consumer = local Forgejo MCP token file; confirm before revoke | `~/.config/restormel/forgejo-mcp-token` |
| `COOLIFY_TOKEN` | **FOUNDER/RISKY** | Provider-regen (Coolify UI); still used by legacy `.forgejo` deploy/preview workflows; Coolify being retired post-cutover | Forgejo Actions secret + Infisical `restormel-ops` |
| `SMTP_PASS` (Migadu) | **FOUNDER** | Provider-side regen (Migadu console); live prod reads `/dashboard/SMTP_PASSWORD` from **`restormel`** project | Infisical **`restormel`** `/dashboard/SMTP_PASSWORD` + Migadu |
| `TELEGRAM_BOT_TOKEN` | **FOUNDER** | Provider-side regen (BotFather); live consumer reads from **`infrastructure`** project (Alertmanager) | Infisical **`infrastructure`** + Forgejo Actions (lighthouse) |
| `BREVO_API_KEY` | **FOUNDER** | Provider-side regen (Brevo console); **zero code consumers** → regen-or-retire | Infisical only (orphan) |
| `SSH_KEY_PROD_167` | **FOUNDER (low)** | Re-key on node3 (was prod .167, now wiped/non-prod); no live automation | node3 `authorized_keys` + Infisical `restormel-ops` |
| any other root-path keys captured | **FOUNDER** | Enumerate from both projects' prod root and rotate alongside | `restormel` / `restormel-ops` / `infrastructure` |

**SAFE-AUTONOMOUS (rotated + verified this pass): NONE.** Every exposed cred requires either provider-side
regeneration (Forgejo/Coolify/Migadu/BotFather/Brevo) or an in-cluster action (CNPG `ALTER ROLE`, SurrealDB
`ALTER USER`, ESO re-sync, pod restart) that is **not reachable or verifiable** from this Mac, and/or lives in
multiple Infisical projects whose live-vs-legacy split cannot be confirmed without cluster access. Rotating only
the legacy `restormel-ops` copy would not close the exposure and risks breaking an un-enumerable consumer — so,
per the mandate ("when in doubt, FLAG; do NOT rotate blindly"), **nothing was rotated.**

### Recommended founder rotation order (with runbooks)

For **every** cred: rotate at the backing system → set the new value in **all** Infisical projects holding a
copy (the live per-product project **and** the legacy `restormel-ops`) → propagate to all consumers → verify →
then (optionally) delete the legacy `restormel-ops` copy once confirmed unreferenced.

1. **`FORGEJO_PM_TOKEN`** (broadest blast radius; also covers the earlier pod-log echo). Forgejo → @adam →
   Settings → Applications → revoke the PM token → issue a new PAT (same scopes). Set new value in: Infisical
   (live project that backs K8s `forgejo-pm-token` + `restormel-ops`); Forgejo Actions org secret
   (`FORGEJO_TOKEN`/`FORGEJO_PM_TOKEN`); local file `~/.config/cowork-relay/forgejo-token`. Then
   `launchctl kickstart -k gui/$(id -u)/com.allotmentology.cowork-relay` (restart the relay launchd job);
   force ESO re-sync so the K8s PostSync-hook secret updates. **Verify:** relay opens a test PR; a PBI
   label-flip PostSync hook still authenticates.
2. **`COOLIFY_TOKEN`.** Coolify UI → Keys & Tokens → revoke + create. Update Infisical (`restormel-ops`) +
   Forgejo Actions secret. **Verify:** `GET /api/v1/applications` 200 via the tunnel. (Low urgency — Coolify
   is being retired post-K3s-cutover; consider retiring the token with the platform.)
3. **`FORGEJO_GITEA_TOKEN`.** Confirm the local Forgejo-MCP token file is still in use first; then Forgejo →
   revoke + reissue (read:org, write:issue/repository, read:user) → update `~/.config/restormel/forgejo-mcp-token`
   → restart any MCP client. **Verify:** an MCP/API call authenticates.
4. **`PG_RESTORMEL_*`** (in-cluster, careful). Set new password in Infisical **`restormel`** project
   (`PG_RESTORMEL_APP_PASSWORD`, and superuser if rotating that) **and** `restormel-ops`. Force ESO re-sync so
   `pg-restormel-app-creds` updates → CNPG reconciles + `ALTER ROLE` → roll `restormel-dashboard` +
   `restormel-worker` Deployments in ns `restormel-prod` so pools reconnect (the composed `restormel-db-url`
   uses the same key, so it stays in lockstep). **Verify:** restormel.dev 200 + DB-backed page loads; no auth
   errors in pod logs. Do during a quiet window; CNPG owns the role — Infisical-only is insufficient.
5. **`SURREAL_*` root.** In-cluster only: set new pw in Infisical **`infrastructure`** (`SURREAL_ROOT_PASS`,
   and `restormel-ops` legacy copies) → ESO re-sync `surreal-root`/`surreal-backup` → **`ALTER USER` on
   SurrealDB to match** (Surreal stores the pw on the user, not from the secret) → confirm the migration/backup
   CronJobs still authenticate on next run. Break-glass cred; no live app path today.
6. **`SMTP_PASS`** (Migadu). Migadu admin console → reset the mailbox password. Set new value in Infisical
   **`restormel`** `/dashboard/SMTP_PASSWORD` (live) **and** `restormel-ops` `SMTP_PASS` → ESO re-sync →
   roll the dashboard/worker pods. **Verify:** send a test transactional email (sign-in/verify). NB existing
   related record: `2026-06-18-migadu-password-shell-exposure.md`.
7. **`TELEGRAM_BOT_TOKEN`** (BotFather). `/revoke` → new token. Set in Infisical **`infrastructure`**
   (Alertmanager) **and** `restormel-ops` + Forgejo Actions (lighthouse) → ESO re-sync `alertmanager-telegram`.
   **Verify:** a test alert/Watchdog reaches the Telegram channel.
8. **`BREVO_API_KEY`** (regen-or-retire). Zero code consumers → preferably **retire** the key in the Brevo
   console and delete it from Infisical; if marketing email is imminent, regen and store scoped. No service
   restart needed either way.
9. **`SSH_KEY_PROD_167`** (low). Generate a new keypair → replace in `authorized_keys` on **node3** (the wiped
   ex-.167) → update Infisical `restormel-ops` `SSH_KEY_PROD_167` → remove the old pubkey. No live automation
   depends on it; safe to defer or **retire** if node3 no longer needs Mac SSH.

### Verification this pass
- Prod health (unchanged, no mutation): restormel.dev **200**, api.plotbudget.com google authorize **302**,
  usesophia.app **200**.
- No secret values printed; only keys-only Infisical listings and config-file reads were performed.
- Coolify app states confirmed via API (tunnel): live prod app `exited:unhealthy`, dead standby is the only
  `running:healthy` legacy entry → corroborates the K3s cutover.

**Net:** rotation remains an **open founder-flagged follow-up** (as the original record states), now with a
precise, verified consumer map and per-cred runbook. The conservative call is intentional: the live secrets
are not in `restormel-ops`, the backing systems are in-cluster and unreachable from this Mac, and a partial
`restormel-ops`-only rotation would neither close the exposure nor be safe.
