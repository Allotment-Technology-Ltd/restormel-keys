---
id: REC-INC-014
title: "Incident — Infisical CLI printed secret values to the agent transcript during the allotmentology.tech secret load"
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
related: [REC-TPL-004, REC-GOV-006]
---

# Incident — Infisical CLI printed secret values to the agent transcript

> Filed from REC-TPL-004. Append-only once filed. Severity **medium** — credential
> values were exposed to an agent transcript (not to a public surface, not exfiltrated),
> requiring precautionary rotation of the affected secrets. No production outage; no
> unauthorised third-party access.

- **Detected:** 2026-06-24, during the allotmentology.tech Coolify→K3s migration
  (PR #22 / PR #10). **Reported by:** executing agent (self-reported), at the moment
  of the `infisical secrets set --file` command. **Severity:** medium.

- **What happened:** While loading the 16 app-config keys into the Infisical
  `allotmentology` project (prod, root) from the live Coolify env, the agent ran
  `infisical secrets set --file <mode-600 .env> ... --silent`. Despite `--silent`,
  the Infisical CLI printed a **results table containing the plaintext secret VALUES**
  (SECRET NAME / SECRET VALUE / STATUS) to stdout, which landed in the agent transcript.
  A redaction filter in the same pipeline (a grep intended to strip base64-looking lines)
  did not match the table format and so did not suppress it. Separately, the plain-SQL
  `pg_dump` used for the data migration contains the `user_ai_provider_keys.api_key_stored`
  column **in plaintext** (see the related BYOK finding below); one provider key value
  was visible in a dump-verification grep of the BYOK COPY block.

- **Impact:** Credential **confidentiality** only — values were exposed to the agent
  transcript/session log, an internal channel. Affected app-config secrets (the
  sensitive subset): `BETTER_AUTH_SECRET` (BetterAuth signing secret),
  `SMTP_PASS` (Migadu transactional SMTP password), `RESTORMEL_KEYS_RECORDS_TOKEN`
  (records-feed bearer token). Also exposed in the dump-verification step: at least one
  `user_ai_provider_keys` provider API key (a user-supplied DeepSeek `sk-…` key, stored
  in plaintext in the source DB — see the systemic finding). The other 13 app-config
  values are low-sensitivity (public URLs, auth-provider name, allowed-emails, SMTP host/port/user/from).
  No data integrity or availability impact; the live Coolify app stayed HTTP 200 throughout.

- **Response (actions + timeline, 2026-06-24):**
  1. Temp `.env` extraction file was mode-600 in a session-scratch dir and **shred/deleted**
     immediately after the load; the on-box `pg_dump` on `.150` was **securely deleted**
     (`shred -u`) once the restore was verified.
  2. Secret load verified by **key NAMES only** (18 keys present) — no further value printing.
  3. Flagged the exposed sensitive secrets to the founder for **precautionary rotation**
     (see Follow-ups). Rotation is the disposition; the exposure channel was internal.
  4. Recorded the systemic BYOK-plaintext finding for governance follow-up (RISK item).

- **Root cause:**
  1. **Tooling:** `infisical secrets set` echoes a values table to stdout and does **not**
     honour `--silent` for that table; the agent's redaction filter assumed base64/dotenv
     line shapes and missed the bordered-table format. Prevention assumed the wrong output
     contract for the write path (the read path `secrets get --plain` is safe; the write
     path is not).
  2. **Systemic:** the source DB stores BYOK provider keys
     (`user_ai_provider_keys.api_key_stored`) **in plaintext**, so any dump/inspection of
     that table necessarily exposes live provider credentials.

- **Follow-ups:**
  - **[founder] Rotate the exposed secrets** out of caution: `BETTER_AUTH_SECRET`
    (note: rotating invalidates existing BetterAuth sessions — schedule a low-traffic
    window), `SMTP_PASS` (Migadu), `RESTORMEL_KEYS_RECORDS_TOKEN`. Update the values in
    Infisical `allotmentology` (prod) + the live Coolify env (keep parity until cutover).
  - **[founder/users] Rotate the exposed BYOK provider key(s)** — the DeepSeek `sk-…`
    key seen in the dump; advise the affected user. Tracks to the systemic finding.
  - **[systemic] Encrypt BYOK at rest** — `user_ai_provider_keys.api_key_stored` should be
    ciphertext, not plaintext, per the Restormel BYOK storage baseline (provider secrets
    only as ciphertext; list APIs return masked ids). Raise/triage as a risk-register item
    against allotmentology.tech (this is a pre-existing app design issue surfaced by the
    migration, not caused by it).
  - **[process] For future Infisical writes**, prefer `--silent`-independent suppression:
    redirect stdout to `/dev/null` on `secrets set`, or pipe through a table-aware redactor,
    so the values table cannot reach the transcript.

  **Closed:** open — pending the founder rotations above. Filed 2026-06-24.
