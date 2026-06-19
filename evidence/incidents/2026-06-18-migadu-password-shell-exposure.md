---
id: REC-INC-004
title: "Migadu mailbox password exposed in setup shell (rotated)"
class: evidence
owner: founder
status: closed
classification: confidential
control-tier: 3
created: 2026-06-19
last-reviewed: 2026-06-19
review-interval: P12M
approved-by: founder
approved-on: 2026-06-19
retention: P6Y
related: [REC-TPL-004]
---

# Incident — Migadu mailbox password exposed in setup shell (rotated)

- **Detected:** 2026-06-18, during interactive setup of the two-stream email system (REC-PLAN-017) in a Claude Code operator session.   **Reported by:** operator/founder.   **Severity:** medium.
- **What happened:** The Migadu mailbox password used as the transactional SMTP credential (`SMTP_PASS`, for `notify@` / the `send.restormel.dev` stream) transited the local shell / process environment on the operator's Mac during setup — it was fetched from Infisical/Coolify into shell context and passed to one-off steps (a test send and a secret-store write). It was **not** committed to the repository and **not** printed to the session transcript, but passing a secret through the shell/argv is below the "never echo/handle secrets in shells" bar in the security baseline.
- **Impact:** One credential — the Migadu mailbox password for the Restormel transactional email stream. **No repository or transcript exposure.** **No evidence of misuse** `[PLACEHOLDER — founder: confirm no anomalous sends in Migadu activity logs for the exposure window]`. Scope limited to this single mailbox password; no other secrets affected.
- **Response:** Rotated the Migadu mailbox password; updated `SMTP_PASS` in Infisical (`restormel-ops`/`prod`) and the Coolify dashboard app env; redeployed the dashboard. (Completed before this record was filed.)
- **Root cause:** A secret was injected via shell variables / command arguments during interactive setup, rather than being made available only at runtime to the consuming process. Interactive convenience over the runtime-only-injection pattern.
- **Follow-ups:**
  - Prefer `infisical run --env=prod -- <cmd>` so secrets are injected into the child process environment only — never into a shell variable or `argv`.
  - Never pass secrets as command-line arguments (visible in `ps`/history); fetch single secrets to a transient file consumed by the process, or use `infisical run`.
  - Confirmed: the dashboard send path reads `SMTP_PASS` from the process env (Infisical/Coolify), never hardcoded; no secret in repo or `.env` (placeholders only).
  - **Closed:** 2026-06-19.
