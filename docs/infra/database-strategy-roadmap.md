# Restormel database strategy roadmap

Status: DRAFT 2026-06-13, written after the Neon free-tier egress outage that took
prod + staging down. Supersedes the "Phase G (off-Neon)" flag in
`coolify-cutover-runbook.md` with a product-level strategy, not just a lift-and-shift.

## Why this exists

The outage exposed that **Neon is doing too many unrelated jobs at once**, and one of
them quietly violates the product's core principle. The trigger was a metered-egress
quota, but the real finding is architectural: we have a *conflation*.

## What Neon holds today (the conflation)

| Role | Tables / mechanism | Whose data is it? | Should it live on our infra? |
|---|---|---|---|
| **Auth** | Neon Auth (hosted Better Auth) → `neon_auth.users_sync`, sessions | Ours (account identities) | Yes — but doesn't have to be *Neon's* hosted auth |
| **Operational** | `workspaces`, `api_keys` (hashed), `provider_integrations` (encrypted creds), billing, config | Ours (account/operational) | **Yes** — this is legitimately ours to hold |
| **Sensitive secrets** | `provider_integrations.credential_ciphertext`, `knowledge_graph_targets.secret_ciphertext`, webhook signing secrets | User-provided secrets, encrypted | Yes, encrypted — but must be in a DB **we** control + disclose |
| **Ingestion resilience** | `knowledge_ingest_jobs` (job state + `progress`/`stages` JSON), the queue/checkpoint/lease machinery | Job control state | Yes (small, ours) |
| **⚠️ User source CONTENT** | `knowledge_source_documents` — full source text imported "so future re-validation can resolve source text without re-ingestion" (see `graph-source-discovery.ts`) | **The user's content** | **NO — this is the violation** |

### The core problem (your finding)

`knowledge_source_documents` durably stores **users' source text on our Neon**. With real
users that means we're holding their documents — **undisclosed in any config, and against
the bring-your-own-store principle**: the whole premise is that the user's knowledge graph
*and its source content* live in **their** SurrealDB, not ours. Today, ingestion copies
their content into our DB for re-validation convenience. That is the thing to fix — it's a
product/privacy issue independent of cost, and it's also a big driver of DB size + load.

## Principles for the target state

1. **BYO is literal.** The user's source content and graph live in the user's store. We
   hold *pointers/metadata*, never durable copies of their content.
2. **Separation of concerns.** Auth, operational data, sensitive secrets, and transient
   ingestion state are distinct responsibilities — not one undifferentiated database.
3. **Data minimization + disclosure.** Hold only what the product needs; disclose exactly
   what we hold and why; make retention explicit.
4. **Cost follows architecture.** Unmetered/self-hosted for anything high-volume;
   scale-to-zero-friendly access patterns for anything metered.
5. **Secrets are first-class.** Encrypted at rest, in a store we control, with a documented
   key-rotation story (we just learned the hard way — see the cutover key rotation).

## Target architecture (where each thing lives)

- **Auth** → self-hosted **Better Auth** against our operational Postgres (off Neon Auth).
  Low-traffic, removes a Neon dependency, gives us control of the sign-in surface.
- **Operational + secrets** → **Postgres we control.** Self-hosted on the Hetzner box
  (Coolify-managed; unmetered; $0 marginal; consistent with everything else we self-host),
  OR a small managed instance if we want managed backups/HA. Small, sensitive, legitimately
  ours. Secrets stay encrypted; rotation documented.
- **Ingestion** → **rearchitect so user content never durably lands on our DB.**
  - Keep only job *metadata*, checkpoints, and lease/heartbeat state (no content) in our PG.
  - Stream source content through processing and write derived units **to the user's store**;
    if transient staging is unavoidable, hold it ephemerally, delete on completion, and
    disclose it. Drop `knowledge_source_documents` as a durable content cache — re-resolve
    from the user's store on demand instead.
  - Bonus: this also removes the largest, chattiest load from the metered DB.
- **Graph / user content** → already BYO (user's SurrealDB). Extend the principle to *all*
  user content, end to end.

## Cost optimization (immediate, while on Launch)

Launch includes 500 GB transfer/project, so **transfer is no longer the constraint**.
The cost lever is **compute (CU-hours)**, and our access pattern defeats scale-to-zero:

- Worker daemons sweep the DB every 5 s (staging) / 30 s (prod) → DB never idles. Raise the
  sweep interval (≥60–120 s, jittered) or move to event/notify-driven draining.
- The live-run SSE endpoint re-queries every 2.5–5 s per open connection; the chip/console
  poll on top. Lengthen cadences and lean on the existing fallback poll.
- Vercel previews auto-create a Neon branch per PR (≈10 right now), each with its own
  compute/storage. **Killing Vercel previews** (already decided) stops the sprawl; delete the
  stale preview branches.
- Net effect: with chatter reduced, the DB scales to zero when idle and a low-traffic
  prototype costs ≈ $0 on Launch. The **$10 spending limit** stays as the guardrail.

## Phased plan

- **Phase 0 — cost triage (DONE / in progress).** Upgraded to Launch + $10 limit (unblocked
  the outage); stopped staging + both ingest workers; stopped the DB-polling health monitor.
  Next: a PR to raise worker sweep interval + SSE cadence defaults so scale-to-zero works;
  delete stale Vercel-preview Neon branches.
- **Phase 1 — kill Vercel previews → Coolify preview.** Already underway (shared
  `preview.restormel.dev`). Removes the Neon preview-branch sprawl.
- **Phase 2 — ingestion rearchitecture (the principle fix).** Stop durably storing user
  source content (`knowledge_source_documents`); keep only content-free job state; resolve
  source text from the user's store on demand. Biggest product win; also the biggest load cut.
- **Phase 3 — operational DB → self-hosted Postgres.** Provision PG on the box (Coolify),
  driver swap (`neon-http` → `pg` Pool), migrate schema + the small operational/secret data,
  repoint apps. Backups via `pg_dump` + Hetzner snapshots.
- **Phase 4 — auth → self-hosted Better Auth.** Replace Neon Auth against the box PG
  (sessions, GitHub OAuth, email). The session-shim + email-delivery work the cutover plan flagged.
- **Phase 5 — decommission Neon.** Or keep a dormant free project as nothing. Update config
  + privacy disclosure to reflect what we now store and where.

## Decisions for Adam

1. **Self-hosted PG vs small managed** for operational/secret data (control + $0 vs managed
   backups/HA). Recommendation: self-hosted on the box now; revisit managed at scale.
2. **How far to push the ingestion rearchitecture** (Phase 2) — full "no durable user
   content" vs a disclosed-and-deleted transient cache. Recommendation: full, it's the principle.
3. **Sequencing** — do Phase 0/1 now (cheap, reversible), schedule 2–4 deliberately (each is a
   real migration with its own verification). Launch + $10 cap means no time pressure.

## Non-goals / watch-items

- Don't re-introduce a chatty access pattern on any metered DB.
- Don't hold user content without explicit disclosure + retention + deletion.
- Keep the BYO SurrealDB path the source of truth for user content end to end.
