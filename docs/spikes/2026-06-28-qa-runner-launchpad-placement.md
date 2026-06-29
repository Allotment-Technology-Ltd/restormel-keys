---
title: "Spike addendum — QA runner as an allotmentology launchpad tile"
class: technical
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-28
last-reviewed: 2026-06-28
review-interval: P12M
---

# Spike addendum — QA runner as an allotmentology launchpad tile

**Chosen placement:** the manual regression runner lives in the **allotmentology company portal**
(K3s `allotmentology-prod`), surfaced as a **Launchpad tile**. Rationale: it shares fate with the
*portal*, not with Restormel — so it stays up while you break-and-test the product. The portal
changes rarely, making it a stable host. (Fall back to a local run only when you're testing the
portal itself.)

## Why this is now low-risk — the two blockers are cleared

1. **Reuse-by-install works.** The `@restormel/testing-*` packages are **published to public npm**
   (`@restormel/testing-runner@0.1.8` live; `testing-core/report/runs-server/cli` all
   `publishConfig`, non-private). The portal **already** depends on `@restormel/keys ^0.2.7` from
   npmjs — so `pnpm add @restormel/testing-core @restormel/testing-report` Just Works in the Next app.
2. **Portal is on K3s** (`allotmentology-prod` ns, Argo app `applications/workloads/allotmentology-prod.yaml`,
   secrets via ESO→Infisical). So Huly is an **in-cluster east-west call**, not a Coolify→K3s hop, and
   the Huly secret is injected the same ESO way as everything else.

## Architecture (what gets built where)

```
Portal (Next.js 16, allotmentology-prod, K3s)
 ├─ Launchpad tile  ── src/lib/company/launchpad.ts  (add 1 LaunchTile → section "QA")
 ├─ Route group     ── src/app/(app)/qa/*            (the runner UI, gated by portal Better-Auth session)
 │     • loads a test script (md/json in-repo, or a qa_scripts table)
 │     • shows ONE case at a time · Pass / Fail / Skip
 │     • on Fail → form: case + steps prefilled, paste PostHog replay URL
 ├─ API route       ── src/app/api/qa/file-issue/route.ts  → files the Huly issue (see wiring)
 ├─ DB (Drizzle + Neon, already in the portal) ── + tables qa_runs / qa_results
 └─ deps: @restormel/testing-core (run/verdict contracts), @restormel/testing-report (summaries)
```

## Exact reused pieces (and what's genuinely new)

| Piece | Source | Reuse in the launchpad path |
|---|---|---|
| Auth / session | portal **Better Auth** | **Free** — the `(app)/` route group is already gated; the tile is `TileAccess: shared-session` |
| Deploy / host / cert / ingress | portal `allotmentology-prod` Argo app | **Free** — no new app, namespace, cert, or ingress |
| Results DB | portal **Drizzle + Neon** | Add `qa_runs`/`qa_results` (or point `@restormel/testing-runs-server`'s `NeonRunsStore` at the portal DB) |
| Run/verdict contracts + report | `@restormel/testing-core`, `@restormel/testing-report` (npm) | **`pnpm add`** — shared vocabulary + summary formatting |
| Huly issue creation | restormel-ops `…/huly/import.mjs::createIssue()` (`@hcengineering` + `HULY_SERVER_SECRET`) | **Port ~80 lines** into the Next API route (or a cluster-side service — see below) |
| Capture | **PostHog EU** (already live) | **Link-paste** — the portal already bundles PostHog; the replay URL is the SUT's, pasted by the tester |
| **NEW: the runner UI** | — | **Build in React** — the Svelte steppers don't port; but a manual checklist is simple (~a few components) |
| **NEW: Huly reachability** | — | NetworkPolicy allow + secret injection (see wiring) |

> Note vs the in-dashboard option: you reuse **less Restormel code** (the Svelte stepper UI doesn't
> port to Next), but you reuse the **portal's** auth + deploy + DB for free. Net cost is similar.

## Huly wiring (the one real integration task) — two ways

**Path A — direct from the portal (fewer moving parts):**
1. `HULY_SERVER_SECRET` → add to the portal's `applications/allotmentology-prod/10-externalsecret.yaml`
   (one Infisical key, ESO renders it). The portal Next API route uses `@hcengineering` + the secret to
   call Huly's **in-cluster** account/transactor services (`*.huly.svc`).
2. **NetworkPolicy allow** — edit `applications/huly/50-networkpolicy.yaml` to allow ingress from
   `allotmentology-prod` to the Huly account/transactor pods. ⚠️ **This is mandatory and easy to miss:**
   huly's ns is default-deny and only allow-lists the 6 frontend apps — a new caller is **silently
   dropped** (Traefik/in-cluster call just hangs; no error). This exact gotcha bit WS3.
3. Use the Node runtime for the route (not Edge) — `@hcengineering` opens a transactor websocket.

**Path B — cluster-side file-issue endpoint (keeps the secret out of the portal; recommended):**
1. A tiny service in the **huly** ns (or restormel-ops on-cluster) exposes `POST /file-issue`
   `{project, title, body, labels}` → wraps the ops `createIssue()`. `HULY_SERVER_SECRET` stays in the
   huly ns (already allow-listed to reach Huly) — **the portal never holds it**.
2. Portal API route POSTs to that endpoint over a single authenticated in-cluster URL.
3. NetworkPolicy: allow `allotmentology-prod → file-issue-svc` only (smaller blast radius than opening
   the transactor). This mirrors the existing WS3 "on-cluster Huly writer behind an endpoint" pattern.

**Recommendation: Path B.** One small service, secret stays cluster-side, minimal NetworkPolicy
surface — and it's reusable by Cowork/Chrome/local-runs later (the `testing.file_issue` atom from the
main spike, but as HTTP instead of MCP).

## PostHog wiring
Trivial. Capture is the **SUT's** PostHog session replay; the tester copies the replay URL into the
Fail form, which stores it on `qa_results` and includes it in the Huly issue body. No new integration —
the portal already has PostHog for its own analytics. *(Optional polish later: if testing happens in a
tab the portal can deep-link, auto-build the replay URL from the distinct-id + timestamp.)*

## Cost estimate

| Task | Est. |
|---|---|
| Launchpad tile + `(app)/qa` route scaffold | ~0.5–1 h |
| Manual runner UI in React (load script · one-at-a-time · Pass/Fail/Skip · fail form) | ~0.5 day |
| Results: Drizzle `qa_runs`/`qa_results` + write/summary (`@restormel/testing-report`) | ~2–3 h |
| Huly file-issue (Path B: small service + port `createIssue` + NetworkPolicy + secret) | ~0.5 day |
| Wire-up, deploy via Argo, smoke | ~2 h |
| **Total** | **~1.5 days** |

**Hardest / riskiest:** the Huly reachability (NetworkPolicy allow-list + the silent-drop gotcha) —
budget a debugging hour there. Everything else is conventional.

## Residual trade-offs (honest)
- **React rebuild:** you don't reuse the Svelte stepper UI (different framework). The plumbing
  (`testing-*` packages, ops Huly logic, PostHog) all reuses; only the ~few UI components are new.
  **Mitigant (found post-spike):** the Claude-Design RES-113 reskin bundle
  (`design_handoff_restormel_onboarding/designs/proto-app.jsx` + `styles.css`) is **already React** —
  a single-file prototype of the dashboard with a `GateRow` (pass/fail/todo status row), a `Ledger`
  checklist, and `Screen`/`Sidebar` layout on the standalone neo-brutalist stylesheet (no Tailwind/build
  deps). So the runner UI is **lift-and-adapt on-brand**, not from-scratch (it's a prototype, not a
  library — lift the CSS + the `GateRow`/`Ledger` patterns).
- **Fate with the portal:** when you test *the portal itself*, the runner is part of the SUT — rare;
  fall back to a local run for those sessions.
- **Script storage:** start with markdown/JSON test scripts in the **portal repo** (versioned, simple);
  move to a `qa_scripts` table only if you want in-app authoring.

## What would still change the call
- If you want the runner usable while the **whole cluster** is down → it can't live here; keep a
  **local** fallback (the `testing-cli` runs offline) for those cases.
- If multiple non-technical testers need it with case libraries/history → revisit Qase, but the portal
  tile + a `qa_runs` history table covers a solo/small-team workflow first.
