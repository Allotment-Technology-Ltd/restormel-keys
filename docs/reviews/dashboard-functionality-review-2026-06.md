---
title: Dashboard functionality review — June 2026
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-11
last-reviewed: 2026-06-13
review-interval: P12M
---

# Dashboard functionality review — June 2026

**Date:** 2026-06-11 · **Scope:** every authenticated surface under `/keys/dashboard/**`, the
`/keys/admin/**` consoles, the Connect ingest/run pipeline end to end, API key / workspace
management, routing & gateway configuration, readiness, graph explorer, and the public-shaped
Connect v1 API surface as it relates to dashboard UI coverage.
**Method:** full route inventory, code-level tracing of every `+page.server.ts` load and the
services it calls, a dev-server probe of unauthenticated behaviour, endpoint-to-UI consumer
mapping (grep for fetch targets in `.svelte`), and the `vitest` baseline.
**Context:** this follows the Verified Context roadmap completion
(`docs/product/verified-context-pivot-roadmap.md`) and the Stage 1.5 perf review
(`docs/reviews/connect-runtime-reliability-perf.md` — F8/F9 still open, confirmed below).
A login-session regression is being fixed by another agent and is **noted but not
investigated** here.

**Test baseline:** `pnpm --filter dashboard exec vitest run src/lib` → **122 files / 645 tests,
all passing** — *after* building workspace packages. On a fresh checkout the same command fails
41 files / 61 tests purely because `@restormel/connect-core` and `@restormel/graphrag-core`
have no `dist/` (resolution errors, not real failures). See P2-10.

---

## 1. Surface inventory

State legend: **solid** = works end-to-end with reasonable UX · **rough** = works but with
notable gaps · **stub** = placeholder/pointer page · **missing-UI** = capability exists
server-side only · **orphaned** = page/component not linked from anywhere.

### Work hubs

| Route | Purpose | State |
|---|---|---|
| `/keys/dashboard` | Redirects to `/activity` | solid |
| `/keys/dashboard/activity` | Overview: setup wizard, live pulse, entitlements | solid (load is a sequential waterfall, P2-1) |
| `/keys/dashboard/connect` | Connect hub: setup ledger, graph pulse, trust scorecard, quality history | solid — the strongest page in the product |
| `/keys/dashboard/connect/library` | Graph library (switch/activate/test graphs) | solid |
| `/keys/dashboard/connect/models` | Ingest routes per stage ("AI models & keys") | solid |
| `/keys/dashboard/connect/pipeline` (+ `store/domain/sources/profiles/agents` redirects) | Setup wizard | solid |
| `/keys/dashboard/connect/ingest` | Runs list | rough (no auto-refresh, no pagination, unconfirmed delete — P1-4, P2-2) |
| `/keys/dashboard/connect/ingest/[jobId]` | Run console | rough (1.5 s × 4-query polling — known F8) |
| `/keys/dashboard/connect/ingest/new` | Manual run creation (631 lines) | **orphaned** — zero inbound links (P2-3) |
| `/keys/dashboard/connect/graph` | Graph explorer + review queue | solid (validation review only — EBV claim states absent, P1-1) |
| `/keys/dashboard/connect/proof` | Side-by-side graph-vs-baseline comparison, trace export | solid |
| `/keys/dashboard/connect/mcp` | Agent/MCP wiring | solid |
| `/keys/dashboard/testing` | Testing hub | stub — static env-var/snippet cards, no runs/results (P1-8) |

### Configure

| Route | Purpose | State |
|---|---|---|
| `/keys/dashboard/integrations` | Provider connections list + create | solid |
| `/keys/dashboard/integrations/[id]` | Connection detail, verify, bindings, OpenRouter import | rough ("Model discovery … not yet wired" stub block; no credential rotation — P2-4) |
| `/keys/dashboard/access` | Gateway keys: create/revoke/copy | rough (labels are localStorage-only — P1-5) |
| `/keys/dashboard/access/audit` | Audit log | rough (fixed 50 rows, no filters/pagination/actor identity — P2-5) |
| `/keys/dashboard/routes` | Cross-project route list | solid |
| `/keys/dashboard/projects` / `[id]` | Project CRUD, env list, per-project keys, CI snippet | solid |
| `/keys/dashboard/projects/[id]/routes` | Route create/list | solid |
| `/keys/dashboard/projects/[id]/routes/[routeId]` | Route builder (3,216 lines): flow map, steps, guard rails | rough — draft/publish dead end (P0-1), no simulate/history UI (P1-2) |
| `/keys/dashboard/projects/[id]/usage` | Per-project usage | stub (placeholder linking to Analytics) |
| `/keys/dashboard/policies` / `[id]` | Guard rails CRUD, test evaluate, bindings | rough — version endpoints have no UI (P1-2) |
| `/keys/dashboard/models` / `[id]` | Model catalog, search, lifecycle | solid |
| `/keys/dashboard/lifecycle` | Lifecycle & migrations | stub (explicit "coming later" page; honest, unlinked from nav) |

### Monitor

| Route | Purpose | State |
|---|---|---|
| `/keys/dashboard/analytics` | Usage charts, cost by model | rough (mock fallback on by default — P2-6) |
| `/keys/dashboard/logs` | Request log list + detail drawer | rough (ID-only filters, no search/live tail/export — P1-6) |
| `/keys/dashboard/healthcheck` | Provider reachability (Pro-gated) | solid for Pro; gate shows illustrative static table |

### More / account

| Route | Purpose | State |
|---|---|---|
| `/keys/dashboard/sandbox` | "Try a request" BYOK playground | rough — disconnected from saved connections/gateway keys/routes (P1-3) |
| `/keys/dashboard/dev-tools` (+ `cli`, `mcp`, `aaif`) | Integration catalogs | solid (MCP catalog missing `connect.memory.write` — P2-7) |
| `/keys/dashboard/copy-for-ci` (+ `copy-for-cli` redirect) | CI secrets snippets | solid |
| `/keys/dashboard/cli/connect` | CLI device-code approval | solid |
| `/keys/dashboard/graph` | Restormel Graph hub | stub (links to docs; "ships in Phase 6") |
| `/keys/dashboard/settings` | Profile, admin links, sign-out | solid |
| `/keys/dashboard/billing` | Plan & invoices | **broken** — self-linking buttons, hardcoded empty invoices (P0-2) |
| `/keys/dashboard/login` / `logout` | Auth | solid (separate known session regression — out of scope) |

### Admin (`/keys/admin/**`; legacy `/keys/dashboard/admin/*` 301s here)

| Route | Purpose | State |
|---|---|---|
| `/keys/admin/users` | Admin grants, operator emails | solid |
| `/keys/admin/founders` | Founders-programme management | solid |
| `/keys/admin/ingest-quality` | Threshold calibration console (evaluate/apply/history) | solid |
| `/keys/admin/ingest-quality/gates` | Gate reference + production sample | solid |
| `/keys/admin/package-registry` | Package insights | solid |

### Other routable surfaces

| Route | Purpose | State |
|---|---|---|
| `/prototype/brutalist-dashboard` | Design prototype with hardcoded fake metrics | **orphaned/leftover** — publicly routable (noindex'd) (P2-8) |

---

## 2. Findings

### P0 — broken or user-stranding

**P0-1 · Route draft/publish flow is a dead end: the UI instructs an action that does not exist.**
When a route's working version differs from its published version, the builder shows:
> "Publish from version history when this route should receive discovery traffic."
(`apps/dashboard/src/routes/keys/dashboard/projects/[id]/routes/[routeId]/+page.svelte:1618-1621`).
There is **no version-history UI anywhere in the dashboard**. The server endpoints exist and
work — `api/projects/[id]/routes/[routeId]/history`, `/publish`, `/rollback`
(`apps/dashboard/src/routes/keys/dashboard/api/projects/[id]/routes/[routeId]/publish/+server.ts`
et al.) — but their only documented consumers are the docs pages
(`src/routes/keys/docs/cloud-api/+page.svelte`). A user who edits a route is told to publish
from a screen that doesn't exist; their route silently never receives discovery traffic.
**Fix:** add a "Versions" tab to the route builder (list versions from `/history`, publish
current draft, roll back) and change the banner CTA to a button that calls `/publish` directly.
The identical gap exists for policies (`/policies/[id]/history`, `/diff`, `/publish`,
`/rollback` — zero `.svelte` consumers; `policies/[id]/+page.svelte` has only Status/Definition/
Test/Bindings sections).

**P0-2 · Billing page cannot manage a subscription: both CTAs link to the page itself, and
invoices are hardcoded empty.**
`apps/dashboard/src/routes/keys/dashboard/billing/+page.svelte:37` — Pro users' "Manage
subscription" → `href="/keys/dashboard/billing"` (the same page); line 55 — "Open Paddle
billing portal" → same self-link. The load function returns `invoices: []` unconditionally
(`billing/+page.server.ts:8`), while the empty state promises "they will appear here when you
subscribe to Pro." A paying customer has no path to update payment details, cancel, or see an
invoice. **Fix:** generate a Paddle customer-portal session server-side and link to it; fetch
real invoices from Paddle (the checkout webhook plumbing already exists under
`api/billing/webhook`); until then, remove the dead buttons and link to Paddle's email-receipt
guidance so the page doesn't lie.

### P1 — major gaps vs world-class

**P1-1 · The verification spine's per-claim states are invisible and inactionable (the review
queue for unverified claims does not exist).**
EBV Layers 1–2 (Stages 1.0c/1.0d) write per-unit `verification_state`
(supported / inferred / unverified / contradicted / excluded) and claim versions/judgments,
and Layer 2 abstains into review states. The only UI surface is the **aggregate** chip row on
the trust scorecard (`src/lib/components/connect/ConnectTrustScorecard.svelte:28-32`). The graph
explorer's review queue is built solely on the *legacy validation* verdicts
(`ok/weak/unsupported/unvalidated` — `ConnectGraphExplorer.svelte`, `queueScope`,
`graph/+page.svelte:17`); `verification_state` does not appear in the units API payload
consumed by the explorer (no occurrence in `api/connect/graph/units/+server.ts` response or
the explorer component). An operator who sees "12% unverified" on the scorecard has **no way
to list, inspect, or resolve those claims**. The scorecard's "Triage flagged ideas →" link
passes `?filter=review`, which nothing reads (explorer reads only `workspace` and `focus`
params — `ConnectGraphExplorer.svelte:632,660`); it lands on the default view by coincidence.
**Fix:** (a) include `verification_state`, evidence span and latest judgment in the units API;
(b) add an "Evidence" facet to the explorer queue (filter by verification state, show the
span + verifier verdict per unit, allow re-verify / accept / exclude actions); (c) make the
scorecard chips deep-link to that filtered queue.

**P1-2 · Resolve/simulate/explain-chain exist as APIs and even as a finished component — but
no user can reach them.**
`src/lib/components/dashboard/RouteResolutionPreview.svelte` (calls
`…/routes/[routeId]/simulate` and `/explain-chain`) is **imported by nothing** (repo-wide grep:
zero importers). The endpoints `simulate`, `explain-chain`, `recommend`, `export`,
`route-coverage`, `validate-binding` are all live and tested server-side. The route builder's
"More" tab contains only a link to Logs
(`projects/[id]/routes/[routeId]/+page.svelte:2342-2348`). World-class routing products
(Vercel's routing debugger, Stripe's webhook tester) make "what would happen for this request?"
a first-class panel. **Fix:** mount `RouteResolutionPreview` in the route builder (Flow tab
side panel or More tab), wire `recommend` into the step-add dialog, and surface `export`
(route-as-code) next to it. Also: `QuickActions`, `FirstRunOnboarding`, `SetupChecklist`
in `src/lib/components/dashboard/` are likewise orphaned — mount or delete.

**P1-3 · "Try a request" can't try a request through the user's actual gateway.**
The sandbox (`/keys/dashboard/sandbox`) is a pure client-side BYOK playground: paste a raw
`sk-…` key, validate it, preview embed components. It never touches saved Connections, Gateway
keys, routes, or the resolve API (no reference to integrations/gateway in
`sandbox/+page.svelte`). So the core promised journey — *configure route → send one test
request → see it resolve and appear in Logs* — cannot be completed inside the dashboard at
all; users must drop to curl. **Fix:** add a "use my workspace" mode that picks a project/
route, calls resolve (and optionally the runtime invoke endpoint that already exists at
`api/projects/[id]/routes/[routeId]/runtime/invoke`), and links the resulting request-log row.

**P1-4 · Runs list is static and destructive actions are one-click.**
`connect/ingest/+page.svelte`: the list is fetched once on mount with no polling/refresh while
runs are active (line 57) — a running job's status goes stale, which directly feeds the
"frozen run" perception the Stage 1.5 review addressed server-side. `deleteJob`
(lines 89-106, 244-252) permanently deletes a run **with no confirmation** — inconsistent with
every other destructive action in the app (`access`, `projects`, `policies` all `confirm()`).
"Clear stuck & failed" bulk-deletes running jobs in one click (line 123-146). The BFF list
endpoint ignores the cursor/limit support that exists in the data layer
(`api/connect/ingest/jobs/+server.ts:26-33` vs `neon.ts:5809` — default 20, keyset cursor
implemented), so **runs older than the latest 20 are unreachable in the UI** with no
pagination control. **Fix:** poll the list while any job is active (reuse run-console cadence
guidance), add confirm/undo to delete, forward cursor params and add a "Load more".

**P1-5 · Gateway-key labels are a client-side illusion.**
Key labels are stored only in `localStorage` keyed by prefix
(`access/+page.svelte:37-43,83-86`, `rk_key_labels`). They vanish on another browser/device
and are invisible to teammates — for a credentials surface this defeats the purpose of
labelling. There is also no created-at / last-used display in the list. **Fix:** persist label
on the key row (the API accepts a body on create; add `label` column), render created/last-used
columns (last-used can come from request-log aggregation).

**P1-6 · Logs filters are unusable at any scale, and the page is read-only.**
The project/route filter dropdowns render raw UUID prefixes — `{p.slice(0, 8)}…`
(`logs/+page.svelte:122,131`) — users cannot know which project "a3f81c92…" is. No free-text
search, no time-range picker, no live tail, no export, hard cap of 200 rows. For an
LLM-gateway product, the request log *is* the debugging surface. **Fix:** resolve names in the
load (the data layer already joins routes elsewhere — `routes/+page.server.ts`), add a
time-range param (the API already accepts `since/until`), and add cursor pagination + CSV/JSON
export.

**P1-7 · No global search or command palette; cross-linking between related entities is thin.**
There is no ⌘K palette, no global search across projects/routes/keys/policies/graphs/runs
(repo-wide: no palette component exists; the docs site has search at `/keys/docs/search`, the
dashboard has nothing). Entity cross-links are sparse: log rows don't link to their route's
builder; the scorecard doesn't link to the producing run; a route doesn't link to its 24 h
log slice. Linear/Vercel/Stripe treat the palette as the primary nav for operators.
**Fix:** a palette over a single `/api/search` endpoint (projects, routes, policies, keys by
prefix, models, runs by label, graph units by text), plus systematic "view related" links
(run ↔ graph ↔ scorecard ↔ logs ↔ route).

**P1-8 · The Testing hub is a pointer page, not a hub.**
`testing/+page.svelte` shows the auto-provisioned project ID, env-var snippets, and doc links —
no run history, no last verdict, no trend, even though the suite produces release packs and
the quality-history plumbing (Stage 2.4) demonstrates exactly how to ingest CI verdicts into
the dashboard. **Fix:** accept Testing run summaries via the existing verdict-ingest pattern
(`connect/v1/eval/verdicts` analogue) and render a runs timeline with pass/fail + release-pack
download.

### P2 — polish / debt

**P2-1 · Overview load is a sequential waterfall.** `activity/+page.server.ts:39-101` awaits
workspace→keys→integrations→bindings→routes(N+1 per project)→logs(500 rows)→aggregates in
series and returns nothing until all complete (no streaming, unlike the Connect hub). Parallelise
and stream the pulse.

**P2-2 · Run-console polling weight (known F8/F9 — still open, confirmed).** `pollMs = 1500`
(`ConnectIngestRunConsole.svelte:108`); each poll = session resolve + job row + log rows +
`COUNT(*)` (`api/connect/ingest/jobs/[jobId]/status/+server.ts:18-38`). The F8 fix list from
the perf review (conditional count, jittered 2.5-3 s, workspace cache) remains the right move;
F9 (runs sharing the interactive instance) is unchanged.

**P2-3 · Orphaned 631-line page.** `connect/ingest/new/+page.svelte` has zero inbound links
(all "New run" CTAs go to the pipeline wizard). Either re-link it as an "advanced run" path or
delete it before it drifts from the wizard's behaviour.

**P2-4 · Connection detail stubs and no rotation.** `integrations/[id]/+page.svelte:269-271`
ships "Full discovery is not yet wired" / "coming soon" copy; rotating a credential requires
delete + recreate (losing bindings). Add re-enter-credential in place.

**P2-5 · Audit log is fixed at 50 events, no filter, actor shown as type only**
(`access/audit/+page.server.ts:16`, `+page.svelte`). Fine for MVP, inadequate for the
compliance posture the product markets ("the context layer your auditors can read").

**P2-6 · Analytics mock fallback defaults ON in production.**
`RESTORMEL_ANALYTICS_USE_MOCK_FALLBACK !== "false"` (`analytics/+page.server.ts:25-27`) swaps
in fabricated cost-by-model rows (`MOCK_COST_BY_MODEL`, line 18) and a sine-wave request series
on failure. It *is* labelled "Sample data" (`UsageChartsSection.svelte:81`), but default-on
fakery in a paid analytics surface erodes trust; flip the default and keep the badge for
explicit demo mode.

**P2-7 · Dev-tools MCP catalog is stale.** The tool list ends at `connect.verify`
(`dev-tools/mcp/+page.svelte:73`); `connect.memory.write` (Stage 3.4, shipped this week,
`packages/mcp/src/connect-memory-write.ts`) is absent. Generate this catalog from the MCP
package's tool registry instead of hand-maintaining it.

**P2-8 · Leftover prototype route.** `/prototype/brutalist-dashboard` renders hardcoded fake
metrics and is publicly routable (noindex'd). Delete or gate behind dev.

**P2-9 · No `+error.svelte` anywhere.** Any thrown load error or 404 under the dashboard falls
back to SvelteKit's unstyled default page with no nav back (verified: `find … -name
"+error.svelte"` → none; `/keys/dashboard/nonexistent` → bare 404). Add a dashboard-scoped
error boundary with "back to Overview".

**P2-10 · Fresh-clone DX: dashboard unit tests fail without building workspace packages
first.** 41 files fail on `Failed to resolve entry for package "@restormel/connect-core"` /
`graphrag-core` until `pnpm --filter '@restormel/*' build` runs. Add a `pretest` build hook or
vite aliases to package sources.

**P2-11 · Unauthenticated behaviour is inconsistent.** Only
`/projects|/healthcheck|/billing|/settings|/sandbox|/cli|/admin` redirect to login
(`+layout.server.ts:60-71`); everything else renders the generic welcome panel in place of the
page (dev-probe: `/access`, `/routes`, `/logs`, `/connect/*` → 200 with "Sign in" copy).
Pick one behaviour (redirect with `?redirect=` is the better one) for all of them.

**P2-12 · Mobile is a hard gate, not a degraded experience** (`+layout.svelte:158-173`).
Acceptable short-term, but checking a run's status from a phone is a real operator need —
the run console and runs list are the two screens worth making responsive first.

---

## 3. Server-side capabilities with no UI

The verification spine shipped fast; most of it is invisible to a dashboard user. Endpoint →
UI consumer audit (grep of fetch targets across all `.svelte`):

| Capability (stage) | Endpoint(s) | Dashboard UI |
|---|---|---|
| Verified claim verification | `POST /connect/v1/verify` | **none** (MCP/REST only; Proof page does comparison, not claim verification) |
| Verified retrieval | `POST /connect/v1/retrieve` | **none** — no retrieval playground; Proof's chat is a separate suggest/stream path |
| **As-of (time-travel) retrieval** (3.3) | `as_of` on retrieve | **none** — `asOf`/`as_of` appears in zero `.svelte` files; temporal validity is entirely invisible |
| **Agent memory write** (3.4) | `POST /connect/v1/memory` + `connect.memory.write` MCP | **none** — no memory inbox/list, no provenance view of agent-written claims, not even listed in the dev-tools MCP catalog |
| Trust scorecard JSON (1.2) | `GET /connect/v1/graph/scorecard` | hub panel exists ✅ — but no public/share view of the "public-shaped" scorecard, no per-graph history |
| Quality verdicts (2.4) | `POST/GET /connect/v1/eval/verdicts` | read-only timeline on hub ✅ (POST is CI-only by design) |
| Verification rules | `GET /connect/v1/verification-rules` (+ `/built-in`) | **none** — operators can't see which rules their pack applies |
| Trace export | `GET /connect/v1/traces/[traceId]/export` | partial — `ExportTraceLink` in Proof only; no trace browser for `GET /connect/v1/traces` |
| **Review queue for unverified/abstained claims** (1.0d) | data exists in claim states | **none** — see P1-1; the explorer queue covers legacy validation only |
| Workspace webhooks | `GET/POST/DELETE api/webhooks` (+ `connect/v1/webhooks`) | **none** — webhooks can only be managed via raw API; docs page exists (`/keys/docs/integrations/webhooks-audit`) |
| Route/policy versioning | `history` / `diff` / `publish` / `rollback` | **none** — see P0-1 |
| Route intelligence | `simulate`, `explain-chain`, `recommend`, `export`, `route-coverage` | **none rendered** — component built but orphaned (P1-2) |
| Runtime invoke jobs | `routes/[routeId]/runtime/invoke` + `/jobs` | **none** — no UI to invoke or watch runtime jobs |
| Readiness runs | `api/connect/graph/readiness/runs` | wizard exists ✅ (`ConnectGraphReadinessWizard`) |

The pattern: **Stages 1.1–3.4 shipped as API + MCP first and the hub got aggregate panels, but
nothing that lets an operator *act* on individual verified/unverified claims, write paths, or
time-travel.** The product's differentiator is currently provable only over curl.

---

## 4. World-class gap analysis — 10 highest-leverage gaps

Benchmarks: Vercel (deploy console, instant feedback), Linear (palette/keyboard, optimistic
UI), Stripe (logs/test tooling, versioned config with diffs).

1. **Claim-level verification workbench** (P1-1). The single most differentiating surface this
   product could own: a queue of unverified/contradicted/abstained claims with evidence spans,
   verifier judgments, accept/re-verify/exclude actions, and as-of history per claim. Today the
   EBV spine is aggregate-only. *Scope: units API extension + explorer facet + actions ≈ 1–2
   weeks; reuses existing judgment/persist services.*

2. **Close the config loop: publish/diff/rollback UI for routes and policies** (P0-1). Stripe
   treats config versions as first-class (view, diff, revert). All endpoints exist; this is
   pure UI. *Scope: versions tab + diff view ≈ 3–5 days.*

3. **An in-dashboard request tester wired to real config** (P1-3 + P1-2). One panel: pick
   route → paste prompt → see resolve decision (explain-chain), provider chain, latency, cost,
   and the resulting log row. Converts "configured" into "proven working" in one minute —
   the single biggest activation lever. *Scope: mount existing orphaned component + invoke
   path ≈ 1 week.*

4. **Command palette + global search** (P1-7). Operators with >3 projects currently click
   through 3 levels for everything. *Scope: search endpoint + palette component ≈ 1 week.*

5. **Live updates instead of polling-or-stale.** The run console polls heavily (F8) while the
   runs list and hub don't update at all; the proof chat already proves SSE works in this stack
   (`connect/proof/api/stream/+server.ts`). One SSE channel for job status/log lines would cut
   poll load and make runs feel alive. Pairs with the F9 worker split. *Scope: SSE endpoint +
   console/list consumers ≈ 1 week, after (or with) the durable-runs worker.*

6. **Logs as a debugging product** (P1-6): named filters, time ranges, text search, live tail,
   export, deep links from/to routes and keys. *Scope: ≈ 1 week incl. data-layer params that
   mostly exist.*

7. **Billing that can actually be managed** (P0-2): Paddle portal session + real invoices +
   usage-vs-limit meter with proximity warnings (entitlements data already loaded on Overview).
   *Scope: 2–3 days.*

8. **Team-shared resource metadata**: server-side key labels, created/last-used, "created by"
   (P1-5) — and eventually multi-user workspaces; everything is currently single-operator with
   localStorage personalisation that doesn't survive a browser. *Scope: labels ≈ 2 days;
   last-used ≈ 2 days.*

9. **Memory & temporal surfaces for the verified-context story**: a memory-writes inbox
   (what agents wrote, with provenance, revoke/supersede) and an as-of toggle in the graph
   explorer ("view graph as of <date>"). Without these, Stages 3.3/3.4 are invisible features.
   *Scope: inbox ≈ 1 week; as-of explorer toggle ≈ 3–4 days on the retrieve path.*

10. **Consistent safety affordances**: confirmations on every destructive action (run delete
    has none), undo where cheap (key revoke grace, run delete soft-delete), optimistic UI with
    rollback on the frequent toggles (step enable, policy bind — currently full `invalidateAll`
    round-trips). *Scope: incremental, start with run delete + bulk clean ≈ 1–2 days.*

---

## 5. What was verified by execution

- `pnpm install` + workspace package builds + `vitest run src/lib` → 645/645 green.
- Dev server boots; unauthenticated probe of 10 routes confirmed redirect vs welcome-panel
  inconsistency (P2-11), prototype route exposure (P2-8), and bare-404 behaviour (P2-9).
- All other findings are code-traced with file:line citations above; authenticated end-to-end
  runs were out of reach (no seeded auth/database in the worktree), so run-console behaviour
  beyond code inspection inherits the Stage 1.5 review's runtime caveats.

## 6. Suggested sequencing

1. **Stop the stranding** (P0-1 routes+policies publish UI, P0-2 billing) — days, high trust
   impact.
2. **Make the differentiator visible** (gap 1 claim workbench, gap 9 memory/as-of) — the
   verified-context pivot is currently un-demoable from the UI.
3. **Activation loop** (gap 3 request tester, gap 6 logs) — proves the gateway works without
   leaving the dashboard.
4. **Feel** (gaps 4, 5, 10 — palette, live updates, safety/optimism) — the "world-class"
   texture, cheap once 1–3 exist.
