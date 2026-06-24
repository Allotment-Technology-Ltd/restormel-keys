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
