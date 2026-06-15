---
id: REC-PLAN-008
title: "Phase D — gateway migration & routing plan (Zuplo → self-hosted OSS gateway)"
class: planning
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-15
last-reviewed: 2026-06-15
review-interval: P6M
retention: review-only
related: [REC-ADR-006, REC-ADR-005]
---

# Phase D — gateway migration & routing plan

This is the phased build/cutover plan for **D2**: migrating the Restormel Keys **Cloud API edge**
off Zuplo onto a **self-hosted OSS gateway** (Apache APISIX recommended; KrakenD / Tyk as
documented fallbacks), per `docs/decisions/oss-gateway-migration.md` (**REC-ADR-006**). It assumes
that decision; if the gateway choice is unfamiliar, read the ADR first — this document is the
*how*, not the *why*.

**Invariant (REC-ADR-005):** the **verification path stays on the dashboard on Coolify** and never
goes behind the gateway. `/mcp`, `/connect/v1/verify`, retrieval, and the trust scorecard are
served by the dashboard origin; the gateway is only the **API edge** (auth, rate-limit, quota,
header injection) in front of the control plane. Nothing in this plan moves the verification path.

**Status: draft — no cutover.** No phase is authorised by this document alone. Each phase is
independently gated and PR'd. The Zuplo decommission (Phase E) is the last, separately-approved
step. Steps marked **[GATED]** require explicit founder go before they run; steps marked
**[OWNER]** need a human decision or credential the agent cannot supply.

## Operating principles for the build agent

1. **Work in branches and PRs.** One PR per phase (or per logical sub-unit). Never commit to `main`.
   Forgejo is canonical; GitHub is a push-only mirror — never push there.
2. **Zuplo stays live until Phase D passes.** Both gateways run in parallel through Phases A–C. The
   live `zpka_…` path keeps serving customers until validation is green and cutover is approved.
3. **No governance edits ahead of reality.** `suppliers.yaml` (PROC-001), `ropa.yaml`, and
   `risk-register.yaml` are updated **only at decommission** (Phase E), when Zuplo actually stops
   receiving traffic — not on the strength of the plan.
4. **Parity before traffic.** Every policy (key-auth, 100/min rate-limit, 10k/month quota,
   `Authorization` → `Bearer rk_…` rewrite, CORS) is reproduced and tested against current Zuplo
   behaviour before any request is routed through the new edge.
5. **Reversible at every step.** Until Phase D completes, a single config flip returns all traffic
   to Zuplo. Keep that escape hatch until Phase E.
6. **Verification path is untouchable.** If any step would put a verification surface behind the
   gateway, stop — that violates REC-ADR-005.

## Decisions needed from the founder (human inputs)

| # | Decision | Needed by | Default if undecided |
|---|----------|-----------|----------------------|
| 1 | **Confirm gateway choice** — APISIX (recommended) vs KrakenD (fewest moving parts) vs Tyk (closest Zuplo parity) | Phase A | APISIX per REC-ADR-006 |
| 2 | **Consumer/key home** — re-home the per-workspace consumer model into the dashboard (recommended) vs keep it in the gateway | Phase A | Dashboard owns the registry; gateway enforces |
| 3 | **Key-format & deprecation window** — new key prefix + how long `zpka_…` keys stay valid in parallel | Phase B | Dual-support both formats through Phase D; announce a 30-day window |
| 4 | **etcd / datastore topology** — single-node to start vs HA (APISIX path only) | Phase A | Single-node on Coolify; revisit HA on customer pull |
| 5 | **Cutover trigger** — go-criteria + maintenance window for the DNS/route flip | Phase D | Off-peak window, founder-approved, after Phase C green |

## Phase A — stand up the chosen gateway alongside Zuplo (no traffic)

Goal: a working self-hosted gateway in the EU that nobody is routed to yet.

- **[OWNER]** Confirm gateway choice (decision #1) and consumer-home (decision #2).
- Provision the gateway on Coolify (Hetzner Helsinki): APISIX + etcd containers (or KrakenD/Tyk per
  choice), healthchecks bound correctly, backups, covered by the prod-box disk guard.
- Translate the current Zuplo config into the new gateway's declarative form:
  - routes/upstreams mirroring `zuplo-gateway/config/routes.oas.json` (forward to
    `KEYS_BACKEND_URL` for `/api/*`, `KEYS_SITE_ORIGIN` for `/keys/v1`, `/connect/v1`, `/graph/v1`);
  - plugins mirroring `config/policies.json`: key-auth, `limit-req` (100/min/user),
    `limit-count`/quota (10k/month/user), `proxy-rewrite` to inject `Authorization: Bearer rk_…`,
    and the CORS policy.
- Build the consumer-provisioning replacement for `apps/dashboard/src/lib/server/zuplo-consumer.ts`
  and `/keys/dashboard/api/consumer-key` **behind a flag**, writing to the dashboard-owned consumer
  registry (decision #2). Do **not** wire it into the live key-issue path yet.
- Keep `zuplo-gateway/` and the live Zuplo deployment **untouched**.

**Exit:** the new gateway answers `/api/health` and proxies a manual test request to the dashboard
with correct auth injection, reachable only from an internal/test hostname. Zuplo still serves all
production traffic.

## Phase B — route non-verification traffic (shadow / opt-in)

Goal: prove the new edge on real-shaped, non-verification traffic without risking customers.

- Point a **test/staging hostname** (or a small internal cohort) at the new gateway for the
  **non-verification** control-plane surfaces only: `/api/*` (projects, keys, suite invoke) and the
  read paths under `/keys/v1`, `/graph/v1`. Verification surfaces (`/connect/v1/verify`, retrieve,
  scorecard) are **explicitly excluded** from this routing per REC-ADR-005 — they remain served by
  the dashboard exactly as today (the gateway only *forwards* to the dashboard; this phase does not
  change who *does the verifying*).
- Enable the dashboard-owned consumer provisioning behind the flag for the test cohort; issue
  new-format keys; verify the dashboard accepts forwarded requests carrying the injected backend
  `rk_…` key and rejects raw consumer keys on direct calls.
- **[OWNER]** Set the key-format + deprecation window (decision #3); dual-support `zpka_…` and the
  new format during overlap.
- Production traffic stays on Zuplo.

**Exit:** the test cohort runs end-to-end through the new gateway — auth, rate-limit, quota,
header-injection, CORS all behaving — with the verification path still on the dashboard, unchanged.

## Phase C — validate (parity gate)

Goal: prove the new edge matches Zuplo behaviour closely enough to carry production.

- Run the existing surface validators (`scripts/validate-zuplo-{keys,connect,graph}-v1.mjs`,
  adapted to target the new gateway) plus a parity matrix:
  - missing auth → 401; valid key → 200; revoked/expired key → 401;
  - rate-limit returns 429 with `X-RateLimit-*` headers at the same threshold;
  - monthly quota counts and resets equivalently (`quotaOnStatusCodes` semantics);
  - `Authorization` rewrite delivers exactly `Bearer rk_…` to the dashboard;
  - CORS preflight + allowed origins/headers/methods match.
- Confirm SSE/streaming and any `/mcp`-adjacent forwarding (if relevant) pass through without
  buffering — forward-looking check for a future Streamable-HTTP `/mcp` edge.
- Load-test rate-limit/quota under concurrency; confirm no metadata leaves Hetzner Helsinki.
- **[GATED]** Sign off the parity report. A failed parity check blocks Phase D.

**Exit:** signed parity report; the new gateway is demonstrably equivalent on the non-verification
surfaces and ready to carry production traffic.

## Phase D — cut over (gated)

Goal: make the new gateway the production API edge.

- **[OWNER]** Pick the cutover window and go-criteria (decision #5).
- **[GATED]** Flip the production Cloud-API hostname/route from Zuplo to the new gateway. Switch the
  live key-issue path to the dashboard-owned provisioner; continue honouring `zpka_…` keys for the
  agreed deprecation window (decision #3).
- Verification path is **not touched** by the flip — the dashboard keeps serving it (REC-ADR-005).
- Monitor 4xx/5xx, 429 rates, quota counters, and latency against the pre-cutover baseline
  (PostHog + Beszel + Uptime-Kuma). Keep the **one-flip rollback to Zuplo** armed for the window.

**Exit:** production Cloud-API traffic served by the self-hosted gateway in the EU; error/latency
within baseline; rollback still available but unused. **Zuplo is now idle but not yet removed.**

## Phase E — decommission Zuplo (gated)

Goal: remove Zuplo and close the sovereignty residual.

- **[GATED]** After the deprecation window closes and a quiet period confirms no `zpka_…` traffic,
  stop and delete the Zuplo deployment, consumers, and key buckets.
- Remove the footprint from the repo: `zuplo-gateway/`, `zuplo-consumer.ts` (old path),
  `scripts/validate-zuplo-*`, `docs/runbooks/zuplo-*`, the `zuplo.svg` brand mark and integration
  references. Replace with the new-gateway runbook.
- **Update governance to reflect reality (now, not before):** remove Zuplo as a sub-processor in
  `governance/suppliers.yaml` (retire PROC-001/DAT-007), update `governance/ropa.yaml` to drop the
  US transfer, and close/downgrade the UK→US transfer item in `governance/risk-register.yaml`.
- Decommission any now-unused Zuplo credentials/env (`ZUPLO_API_KEY`, `ZUPLO_ACCOUNT_NAME`,
  `ZUPLO_BUCKET_NAME`).

**Exit:** Zuplo fully removed; Cloud-API edge is UK/EU self-hosted end-to-end; the verification path
remains on the dashboard on Coolify throughout (REC-ADR-005, never moved).

## Sequencing

A (stand up, no traffic) → B (route non-verification test traffic) → C (parity validation, **gate**)
→ D (production cutover, **gated**) → E (decommission Zuplo + governance update, **gated**). Zuplo
runs in parallel through A–C; a single config flip reverts until Phase D completes; nothing in any
phase moves the verification path off the dashboard.
