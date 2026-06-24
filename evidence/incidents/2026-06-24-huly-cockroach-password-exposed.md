---
id: REC-INC-020
title: "Incident — Huly CockroachDB password (HULY_COCKROACH_PASSWORD) exposed via kvs DEBUG DSN logging to pod logs + transcript"
class: evidence
owner: founder
status: open
classification: confidential
control-tier: 3
created: 2026-06-24
last-reviewed: 2026-06-24
review-interval: P12M
approved-by: founder
approved-on: 2026-06-24
retention: P6Y
related: [REC-TPL-004, REC-INC-018]
---

# Incident — Huly CockroachDB password exposed via kvs DEBUG DSN logging

> Filed from REC-TPL-004. Append-only once filed. Severity **medium** — a database
> credential value was exposed to an internal channel (a crashlooping pod's logs and the
> investigation transcript), not to a public surface and not exfiltrated. The credential
> is for the **newly deployed, not-yet-live** Huly cluster's bundled CockroachDB; the
> disposition is precautionary **rotation**. No production outage, no data loss, no known
> unauthorised third-party access.

- **Detected:** 2026-06-24, during diagnosis of the Huly `kvs` CrashLoopBackOff (ns `huly`,
  fresh WS1 deploy). **Reported by:** executing agent (self-reported), at the moment of reading
  the `kvs` pod logs. **Severity:** medium.

- **What happened:** The `hulykvs` service logs its **full database connection string at DEBUG
  level** on startup: `DEBUG hulykvs: database connection string connection="postgres://selfhost:<PASSWORD>@cockroach:26257/defaultdb?sslmode=disable"`.
  Because `kvs` is crashlooping (it cannot authenticate — see the companion root-cause below),
  this DEBUG line is re-emitted on every restart and **persists in the pod's stdout logs**. The
  embedded password is `HULY_COCKROACH_PASSWORD` (the Infisical value ESO renders into the
  `huly-secret` Secret keys `COCKROACH_PASSWORD` and, embedded, `CR_DB_URL`). During diagnosis the
  log was tailed and the DSN (with the plaintext password) landed in the agent transcript. No
  redaction was applied at the source — the value is in cleartext in `kubectl logs deploy/kvs`.

- **Impact:** Credential **confidentiality** only. The exposed value is
  **`HULY_COCKROACH_PASSWORD`** — the password embedded in the Huly CockroachDB DSN
  (`postgres://selfhost:…@cockroach:26257/defaultdb`) for the bundled single-node CockroachDB in
  ns `huly`. Exposure channels are internal: (a) the `kvs` pod's stdout logs (readable to anyone
  with `kubectl logs` on ns `huly` / the cluster log pipeline), and (b) the investigation
  transcript/session log. Scope is **limited to the new Huly cluster** — this credential is not
  shared with any other Restormel/Allotment service (it lives only in Infisical `product_management/prod`
  under `/huly`, used only by Huly). Mitigating context: the Huly CockroachDB runs
  `start-single-node --insecure` and is reachable only inside ns `huly` (compensating control is the
  namespace NetworkPolicy, `applications/huly/50-networkpolicy.yaml`); Huly is **not yet live to
  users**. No integrity or availability impact from the exposure itself.

- **Response (actions + timeline, 2026-06-24):**
  1. On recognising the DSN-in-logs exposure, all subsequent log reads were piped through a
     password-masking filter (`sed 's#(postgres://[^:]+:)[^@]+@#\1***REDACTED***@#'`) so the value
     was **not** re-printed; secret comparisons were done by **SHA-256 digest only** (never the value).
  2. Confirmed the exposure is the credential value, not a key name, and that it is the
     `HULY_COCKROACH_PASSWORD` leg (the `COCKROACH_PASSWORD` secret key and the password embedded
     in `CR_DB_URL` are byte-identical — same Infisical source, verified by matching digests).
  3. Flagged `HULY_COCKROACH_PASSWORD` to the founder / main loop for **precautionary rotation**
     (see Follow-ups). Rotation is the disposition; the exposure channel is internal.
  4. Raised a follow-up to **disable kvs DEBUG-level DSN logging** so the DSN can never be logged
     in cleartext again (see Follow-ups — chart/env fix).

- **Root cause:**
  1. **Application logging:** `hulykvs` logs the entire DSN — **including the password** — at
     DEBUG level, with no redaction of the credential portion. Any environment that runs `kvs` at
     DEBUG verbosity (the current default in this deploy) writes the live DB password to stdout.
  2. **Amplifier:** `kvs` is in CrashLoopBackOff (a separate root cause: the CockroachDB SQL user
     `selfhost` was never provisioned, so every connection fails `28P01`), so the DEBUG DSN line is
     re-emitted on every restart and accumulates in the pod logs rather than scrolling away.
  3. **Process:** the log was tailed into the transcript before the DSN-with-password shape was
     anticipated and masked. (Cf. REC-INC-018 — same exposure class, a secret value reaching an
     internal transcript/log channel; this one originates from the application's own DEBUG log
     rather than a CLI output table.)

- **Follow-ups:**
  - **[founder / main loop — ROTATE] Rotate `HULY_COCKROACH_PASSWORD`.** Set a fresh value in
    Infisical `product_management` (env `prod`, path `/huly/HULY_COCKROACH_PASSWORD`); let ESO
    re-render `huly-secret` (`COCKROACH_PASSWORD` + the embedded `CR_DB_URL` password); `ALTER`
    the CockroachDB `selfhost` user to the new password (value supplied via a temp file / env,
    never argv); restart the Cockroach consumers (`account`, `transactor`, `workspace`, `fulltext`,
    `kvs`). The exact ordered, value-safe command sequence is handed to the main loop in the
    diagnosis report. **(blocking — do as part of the kvs root-cause fix; the same rotation both
    remediates the exposure AND lets the `selfhost` user be (re)created with a known-good password.)**
  - **[chart/env — PREVENTION] Stop kvs logging the DSN.** Lower `hulykvs` log verbosity below
    DEBUG in the deployed config (e.g. set `RUST_LOG`/`LOG_LEVEL` to `info` for the `kvs`
    Deployment in the Huly chart, `charts/huly/templates/kvs/deployment.yaml` / values), so the
    full connection string is never emitted. Ideally also report upstream that hulykvs should
    redact the password segment of the DSN even at DEBUG. **(follow-up; staged as gitops change.)**
  - **[ops] Purge the exposed value from logs after rotation** — once `HULY_COCKROACH_PASSWORD`
    is rotated, the value in the current `kvs` pod logs is stale; the crashlooping pod is replaced
    on the consumer restart, dropping the old logs. Confirm no log-shipping pipeline retained the
    pre-rotation DSN line (check the cluster log store / Loki retention for the masked window).
  - **[link] Cross-reference REC-INC-018** (Infisical CLI printed secret values to the transcript)
    — same exposure class (credential value → internal channel, disposition = precautionary
    rotation); informs the standing "never tail a credential-bearing log/output unmasked" process.

  **Closed:** open — pending the `HULY_COCKROACH_PASSWORD` rotation + the kvs DEBUG-logging
  prevention fix above. Filed 2026-06-24.
