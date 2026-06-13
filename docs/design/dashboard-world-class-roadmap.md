# World-Class Dashboard — Delivery Roadmap

**Thesis** (synthesis of the June 2026 reviews): the Verified Context engine is complete —
every stage of [`verified-context-pivot-roadmap.md`](../product/verified-context-pivot-roadmap.md) is ✅,
the claims ledger has ten **proven** rows, and the spine (evidence binding, span-scoped
entailment, durable runs, temporal validity, agent memory writes) runs end to end. But the
**experience stops one hop short of the engine**: the dashboard cannot sign out, deletes runs
without confirmation, instructs users to use buttons that don't exist, and — most damning for
a product whose pitch is *receipts, not vibes* — shows *that* a claim is "Supported" but never
*by what*. The differentiator is currently provable only over curl
([functionality review §3](../reviews/dashboard-functionality-review-2026-06.md)).

This roadmap reconciles the two reviews into one prioritized programme:

- [`docs/reviews/dashboard-functionality-review-2026-06.md`](../reviews/dashboard-functionality-review-2026-06.md)
  — cited below as **FUNC** (findings `P0-1…P2-12`, the §3 missing-UI table, the §4 ten-gap
  analysis).
- [`docs/reviews/dashboard-ux-review-2026-06.md`](../reviews/dashboard-ux-review-2026-06.md)
  — cited below as **UX** (findings `IA-*`, `A/B/C/D/E/F-P*`, the §3 signature proposals).

Where the reviews found the same thing from different angles, this roadmap merges them into
one stage. The three largest merges:

| Functionality angle | UX angle | Merged into |
|---|---|---|
| FUNC P1-1 "no review queue for unverified claims" + §4 gap 1 "claim workbench" | UX D-P0-1 "spine ends one hop short of the evidence" + C-P1-3 hidden queue + signature 3.1 Evidence Dossier + 3.4 Stamping Desk | **W2.1 (URL contract) → W2.2 (Evidence Dossier) → W4.2 (Stamping Desk)** |
| FUNC §4 gap 5 "live updates instead of polling-or-stale" + P1-4 + P2-2 (F8/F9) | UX B-P0-2 frozen-run invisibility + signature 3.2 Machine Room | **W1.4 (recovery now) → W3.1 (SSE) → W4.1 (Machine Room)** |
| FUNC "dual trust-score formula" implication of §3 scorecard row | UX D-P1-1 two trust scores + signature 3.3 One Trust Ledger | **W2.3 (One Trust Ledger)** |

## Delivery protocol (how we run this)

Identical to the [pivot roadmap protocol](../product/verified-context-pivot-roadmap.md#delivery-protocol-how-we-run-this),
with one addition for parallel batches:

1. **One stage per agent run.** Each stage below carries a ready-to-fire, self-contained
   prompt (bounded scope, acceptance criteria, STOP gates, verification commands) inlining
   every context pointer a cold agent needs — the agent needs nothing beyond the repo.
2. **Parallel batches.** Stages in the same batch (column **Batch** in the sequencing table)
   have disjoint file footprints and may be fired concurrently as separate agent runs. The
   product owner merges PRs within a batch in any order; a batch must be fully merged before
   the next batch fires (cross-batch stages *do* share files). The two wave-4 sweeps (W4.4,
   W4.5) touch everything and run **alone, last**.
3. **Definition of done per stage:** PR with tests + docs, `pnpm --filter dashboard check`
   and the vitest suite green (645 tests at baseline — see FUNC §0; build workspace packages
   first per FUNC P2-10), and screenshots/recordings of every ux-contracts §3 state
   (loading / error / empty / success) for new or changed surfaces.
4. **End every run by naming the next prompt** (and any prerequisite that must clear first).
5. **Findings are raised as questions, not silently actioned.** Scope-changing discoveries
   STOP the run; this roadmap is the single source of truth and is edited when a decision
   lands.
6. **Live-key boundary.** UI stages are built and tested against stubs/fixtures. Flows whose
   *demo* needs live model calls (request tester invocations, entailment re-judging, memory
   writes) are exercised by the key-holder after merge; the agent never holds or commits keys.
   Layer-1 evidence re-checks are deterministic (`verifyEvidenceSpan`) and need **no** keys —
   prefer them in tests and demos.
7. **The claims-ledger rule applies to UI copy (non-negotiable).** Any new dashboard copy
   that asserts verification quality ("every claim is backed by…", "validated against its
   source") must cite a **proven** row of
   [`verified-context-claims-ledger.md`](../product/verified-context-claims-ledger.md) in the PR body.
   The falsifiability test is the design bar for every evidence surface: *a skeptical user
   can click through to the quoted span in the source and check it themselves.* A surface
   that shows a verification badge without a path to its evidence fails review.

## Sequencing

Four waves. **Wave 1 — stop the stranding**: every P0 from both reviews, plus the sign-in
recovery sweep (signed-out users with no sign-in action are stranded users too — UX A-P1-1).
**Wave 2 — make the engine visible**: the claim workbench, one trust number, memory/as-of
surfaces, and the overview that finally tells the verified-context story. **Wave 3 —
world-class operator ergonomics**: live updates (closing F8/F9), palette, logs, request
tester, config diff/export. **Wave 4 — signature polish**: the remaining signature proposals
plus the mechanical consistency/a11y/hygiene sweeps.

Two deliberate deviations from a literal reading of the reviews, with justification:

- **UX D-P0-1 (evidence in claim detail) is wave 2, not wave 1** — it requires the units-API
  extension and the explorer URL contract (W2.1) to be done right, and batching rules let
  W2.1 fire *in the same batch as wave 1* (disjoint files), so nothing is actually delayed.
- **FUNC P0-1 is split**: wave 1 ships the minimal un-stranding (versions list + publish +
  rollback buttons); the Stripe-grade diff/export/recommend experience is W3.5. Shipping the
  unblock first keeps W1.5 one agent run.

| Stage | Title | Resolves (evidence) | Depends on | Batch |
|---|---|---|---|---|
| W1.1 | Re-baseline `ux-contracts.md` (nav model + copy registry) | UX IA-2, IA-8, F-P1-3 (registry side) | — | B1 |
| W1.2 | Account chrome: avatar menu, sign-out, orphan pages re-homed | UX A-P0-1, A-P2-1, IA-8 (billing title); FUNC §1 orphans | — | B1 |
| W1.3 | Runs list: confirmations, honest "stuck" count, runs language | UX C-P0-1, C-P0-2, C-P1-1; FUNC P1-4 (confirm part) | — | B1 |
| W1.4 | Run console recovery: render Restart, stall/reclaim narration | UX B-P0-1, B-P0-2, B-P1-2; FUNC §2 P0 framing | — | B1 |
| W1.5 | Route & policy publish un-stranding (versions tab) | FUNC P0-1 (+ §3 versioning row) | — | B1 |
| W1.6 | Billing that tells the truth (Paddle portal + invoices) | FUNC P0-2, §4 gap 7 | — | B1 |
| W1.7 | Recovery-state sweep: SignInNotice, retry, ops-copy leaks | UX A-P1-1, A-P1-2, A-P1-3 | — | B1 |
| W2.1 | Graph explorer URL contract + review badge | UX IA-6, C-P1-3, C-P2-1; FUNC P1-1(c) | — | B1 |
| W2.2 | The Evidence Dossier (claim-level "why is this trusted") | FUNC P1-1(a,b), §4 gap 1; UX D-P0-1, IA-4, signature 3.1 | W2.1 | B2 |
| W2.3 | One Trust Ledger (single score + paper trail + state tokens) | UX D-P1-1, D-P1-2, D-P1-3, D-P1-4, D-P2-1, D-P2-2, signature 3.3 | W2.1 | B2 |
| W2.4 | Memory-writes inbox + generated MCP catalog | FUNC §3 (memory row), §4 gap 9a, P2-7 | — | B2 |
| W2.5 | As-of time travel in the explorer | FUNC §3 (as-of row), §4 gap 9b | W2.2 | B3 |
| W2.6 | Overview becomes the verified-context home | UX IA-3; FUNC P2-1 | — | B2 |
| W3.1 | Live updates: SSE for runs + list pagination (closes F8/F9) | FUNC §4 gap 5, P1-4 (rest), P2-2 (F8/F9) | W1.3, W1.4 | B3 |
| W3.2 | In-dashboard request tester wired to real config | FUNC P1-3, P1-2 (simulate/explain), §4 gap 3 | W1.5 | B3 |
| W3.3 | Logs as a debugging product | FUNC P1-6, §4 gap 6 | — | B3 |
| W3.4 | Command palette + global search + systematic cross-links | FUNC P1-7, §4 gap 4 | — | B2 |
| W3.5 | Versioned-config intelligence: diff, export, recommend | FUNC P0-1 (diff residue), P1-2 (rest), §4 gap 2 | W1.5 | B3 |
| W3.6 | Incremental re-ingest UX + BYO opt-in placement | UX C-P1-2, E-P1-1, E-P1-2, E-P2-1 | W1.3; see issue #234 | B3 |
| W3.7 | Team-shared key metadata + audit log depth | FUNC P1-5, P2-5, §4 gap 8 | — | B2 |
| W3.8 | Testing hub: real runs, real verdicts | FUNC P1-8 | — | B2 |
| W4.1 | The Machine Room (run console as product demo) | UX signature 3.2, B-P1-1, B-P2-1 | W1.4, W3.1 | B4 |
| W4.2 | The Stamping Desk (keyboard-first triage loop) | UX signature 3.4; FUNC §4 gap 1 (actions at speed) | W2.2, W2.3 | B4 |
| W4.3 | "Prove it" as a global gesture | UX signature 3.5; FUNC §3 (scorecard share row) | W2.1, W2.2, W2.3 | B4 |
| W4.4 | Neo-brutalist consistency sweep (headers, borders, radius) | UX F-P1-1, F-P1-2 (N8) | all UI stages | B5 (alone) |
| W4.5 | Copy + a11y sweep | UX F-P1-3 (app side), F-P2-1, B carry-overs | W1.1, all UI stages | B5 (alone) |
| W4.6 | Shell hardening: error boundaries, auth consistency, mobile read-only | FUNC P2-9, P2-11, P2-12; UX F-P2-2 | — | B4 |
| W4.7 | Hygiene: orphans, prototype route, analytics mock, fresh-clone DX | FUNC P2-3, P2-4, P2-6, P2-8, P2-10; UX IA-7 | — | B4 |
| **R1** | **IA decision record + ux-contracts re-baseline v2** | D1–D10 approved; redirect map; registry nouns | §6 sign-off (done) | R-doc |
| R2 | Route migration, redirects, nav skeleton | D1, D3, D8 (kills); new URLs live | R1 | R-nav |
| R3 | One Home (merged `/home`) | D1, §3.3 wireframe; W2.6 down payment | R2; W2.6 merged | R-page |
| R4 | Sources section + wizard-as-flow | D1, §3 flow-not-place principle | R2 | R-page |
| R5 | Agents + Prove assembly, Foundation rehoming | D5 (audit→Prove); D6 (separate Logs/Usage) | R2 | R-page |
| R6 | Shell v2: live-run chip, dossier rail, mobile tier | D10 (mobile); absorbs W4.6 mobile half | R2 | R-shell |
| R7 | Workspace infrastructure project (decision-gated: D4) | D4 approved; K3 required | K3 merged | R-infra |

Calibration: each stage is sized like the pivot roadmap's stages — one agent run producing
one reviewable PR. The two biggest (W2.2, W3.1) carry explicit scope fences to stay that size.

---

## Wave 1 — Stop the stranding

### Stage W1.1 — Re-baseline `docs/design/ux-contracts.md`

*Resolves UX IA-2, IA-8, F-P1-3 (registry side). Files: `docs/design/ux-contracts.md` only.*

```
ROLE
Technical writer-engineer updating the dashboard's UX contract so every later stage in
docs/design/dashboard-world-class-roadmap.md can be graded against a true document. Docs only —
no code changes.

TARGET
ux-contracts §1 (navigation model) and §2 (copy registry) describe the SHIPPED product:
Work / Configure / Monitor / More sidebar groups, the Connect hub and its tabs, the
/keys/admin shell, and one canonical name per surface. §3 (state conventions) and §4
(section pattern) are still correct — do not weaken them.

FIRST
- docs/reviews/dashboard-ux-review-2026-06.md §1 (the actual IA tree + gaps IA-1…IA-8)
  and F-P1-3 (the naming-drift roll-up).
- apps/dashboard/src/lib/nav-config.ts (sidebar groups, PATH_TO_TITLE) and
  src/lib/dashboard-hub-nav.ts (Connect hub tabs) — these are ground truth.
- docs/design/ux-contracts.md in full.

ACCEPTANCE CRITERIA
- §1 rewritten to the shipped tree (per the review's IA map), including the Connect hub,
  /keys/admin, and the account-menu requirement (kept — W1.2 implements it).
- §2 registry decides ONE name for each contested surface and records it: the
  models/keys page (tab "Ingest routes" vs registry "Models & keys" vs topbar
  "Connect · Models" — UX IA-8), "Ingest run" (never "job"), "Connections"/"Provider
  integration", "Usage". Decisions are tie-broken toward what users already see most.
- Every roadmap stage that renames copy (W1.3, W4.5) can cite a registry line; add a note
  that copy PRs cite the registry the way marketing PRs cite the claims ledger.
- A changelog block at the bottom of ux-contracts.md records this re-baseline and links
  the two June 2026 reviews.

PROCESS
Docs-only PR. Quote the before/after §1 tree in the PR body.
Use effort: medium.
```

### Stage W1.2 — Account chrome: avatar menu, sign-out, orphan pages re-homed

*Resolves UX A-P0-1, A-P2-1, IA-8 (billing title); FUNC §1 orphaned settings/billing.
Files: `apps/dashboard/src/routes/keys/dashboard/+layout.svelte`,
`apps/dashboard/src/lib/nav-config.ts` (+ one new component).*

```
ROLE
Senior SvelteKit engineer closing the single worst stranding in the product: a signed-in
user cannot sign out, open settings, or see their plan (ux-contracts §2 mandates the
account menu; UX review finding A-P0-1).

TARGET
A topbar avatar menu (right of the help links) with exactly three items: "Profile &
settings" → /keys/dashboard/settings, "Subscription" → /keys/dashboard/billing, "Sign
out" → /keys/dashboard/logout (with data-sveltekit-reload). /settings and /billing stop
being orphans; /billing gets a topbar title.

FIRST
- docs/reviews/dashboard-ux-review-2026-06.md A-P0-1 and IA-1 (evidence: the topbar at
  +layout.svelte:268-299 renders title + two help links only; nav-config.ts:48-81 has no
  settings/billing/logout entries; the only /logout link is the expired-session banner
  at +layout.svelte:306).
- docs/design/ux-contracts.md §2 (account-menu contract) and the
  .claude/skills/restormel-neu-brutalist-ui skill (menu styling: hard borders, mono
  labels — not a soft SaaS dropdown).
- The settings and billing pages exist and load (settings/+page.svelte, billing/+page.svelte).

ACCEPTANCE CRITERIA
- Avatar menu component (keyboard accessible: opens on Enter/Space, arrow navigation,
  Escape closes, focus returns to trigger; aria-expanded + menu roles).
- Sign out works end-to-end: menu → /logout → session ended → login (manual screencap
  in PR). data-sveltekit-reload set so the server hooks see the cleared session.
- PATH_TO_TITLE gains a /billing entry (UX IA-8: today the topbar is blank there).
- Welcome-panel checklist step 1 "Sign in with GitHub" becomes a real link to
  /keys/dashboard/login (UX A-P2-1, +layout.svelte:317).
- No other nav-config changes (W1.1 owns naming; W3.4 owns search).
- ux-contracts §3 states: the menu degrades gracefully when the plan/entitlement fetch
  fails (show menu items regardless — never block sign-out on a failed fetch).
- Component test for the menu (open/close/focus) + existing dashboard tests green.

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib
(build @restormel/* packages first — FUNC P2-10). PR with screenshots: menu closed/open,
keyboard focus ring, billing topbar title.
Use effort: high.
```

### Stage W1.3 — Runs list: confirmations, honest "stuck" count, runs language

*Resolves UX C-P0-1, C-P0-2, C-P1-1; FUNC P1-4 (confirmation + staleness perception).
Files: `apps/dashboard/src/routes/keys/dashboard/connect/ingest/+page.svelte`
(+ its server load, new).*

```
ROLE
Senior engineer removing a one-click data-loss path that sits next to the Refresh button
during every run (UX C-P0-1/C-P0-2 — the only destructive controls in the dashboard with
no confirmation), and bringing the runs surface up to the copy registry.

TARGET
Per-run Delete and "Clear stuck & failed" require explicit confirmation stating blast
radius; the "stuck" count stops counting healthy in-flight runs; the page speaks
"Ingest runs" per the registry; data loads server-side with the shared skeleton.

FIRST
- docs/reviews/dashboard-ux-review-2026-06.md C-P0-1 (deleteJob fires DELETE on click,
  ingest/+page.svelte:89-106; bulkClean cancels RUNNING jobs unconfirmed, :123-146),
  C-P0-2 (stuckCount counts every running/pending job, :31 — a freshly started healthy
  run immediately shows a red "Clear stuck & failed (1)" button), C-P1-1 (copy/idiom:
  "Ingest jobs" title :150-158, raw enum badges :219, onMount client fetch :33-57).
- docs/design/ux-contracts.md §3 ("Destructive actions: Require explicit user confirmation").
- The durable-runs lease/heartbeat plumbing (pivot Stage 1.6, PR #229 —
  apps/dashboard/src/lib/server/connect/ingest-full-runner.ts) — the data layer knows
  what "genuinely stale" means; the UI must use it, not guess from status alone.

ACCEPTANCE CRITERIA
- confirm() (or a brutal modal) on per-run delete AND bulk clean; bulk copy states the
  blast radius: "Cancel N running runs and delete M finished runs? Run history and
  quality reports for them are removed."
- stuckCount counts only genuinely stale runs: no heartbeat for longer than the lease
  window (read it from the jobs payload — if the list endpoint doesn't expose
  heartbeat/lease age, add it). Healthy running/pending runs younger than the threshold
  never trigger the danger button. Button relabelled "Clean up old runs".
- Page title/lede/aria say "Ingest runs"; status badges use ingestStatusLabel; <title>
  updated. (Per the W1.1 registry — cite the registry line in the PR.)
- Data moves to +page.server.ts load with the shared skeleton; signed-out state keeps a
  Sign in action (do not regress UX A-P1-1 here).
- Unit tests: stale-count boundary (healthy running → not stuck; heartbeat-expired →
  stuck), and a component-level test that delete does not fire without confirmation.
- Scope fence: NO pagination, NO polling — that is W3.1. Keep this run small and safe.

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
PR screenshots: confirm dialog with blast-radius copy, runs list with a healthy running
run and no danger button.
Use effort: high.
```

### Stage W1.4 — Run console recovery: render Restart, stall/reclaim narration

*Resolves UX B-P0-1, B-P0-2, B-P1-2. Files:
`apps/dashboard/src/lib/components/connect/pipeline/ConnectIngestRunConsole.svelte`
(reference: `ConnectGraphRepairProgress.svelte`).*

```
ROLE
Senior engineer fixing a textbook stranding: the run console computes canRestart,
runAgainLabel and defines restartJob() — and renders NONE of them, while the preview-run
banner explicitly instructs "Use Restart run…" (UX B-P0-1). Also: a frozen run is
indistinguishable from a healthy one despite durable-runs shipping the full
lease/heartbeat/reclaim machinery (UX B-P0-2).

TARGET
A failed/finished run shows a primary Restart action; the progress panel narrates worker
liveness ("Last activity 12s ago"), stalls (amber, with the durable-runs contract in
plain words), and reclaim/resume events. Errors and load states use the contract
components with recovery actions.

FIRST
- docs/reviews/dashboard-ux-review-2026-06.md B-P0-1 (canRestart :114-117, runAgainLabel
  :119-122, restartJob() :168-197 — none rendered; .run-actions CSS exists at :608;
  preview banner :366-372; bare error <p> :439-441), B-P0-2 (progress panel :453-482 has
  no liveness; the graph-repair panel already solves this —
  ConnectGraphRepairProgress.svelte:61-64,148: isStale after inactivity, role="status"
  stall notice), B-P1-2 (bare "Loading run console…" :283-284, "Job not found." :285-286,
  loadLive error swap :205-212).
- The durable-runs semantics (pivot Stage 1.6, PR #229): lease/heartbeat columns,
  reclaim marks the job with a 'reclaimed after stall' event, resume reuses checkpoints.
  The status log already carries resume events — surface, don't invent.
- docs/design/ux-contracts.md §3 (every error needs a recovery action).

ACCEPTANCE CRITERIA
- Restart button rendered in run-head when canRestart, labelled runAgainLabel, plus a
  "View runs" outline link. job.error wrapped in BrutalErrorBanner with Restart +
  "Check pipeline setup" actions in the banner's actions snippet.
- Liveness line in the progress panel: "Last activity Xs ago" (mono), fed by the
  heartbeat/last-event timestamp the status endpoint already returns (extend the payload
  if it doesn't — keep the endpoint shape additive).
- Stall state after ~90s without activity: amber role="status" block — "No worker
  heartbeat for 2m. Stalled runs are reclaimed automatically and resume from the last
  checkpoint — nothing is lost." On a detected resume: "Resumed from checkpoint after a
  stall" ledger line. Copy must be TRUE per the Stage 1.6 implementation — verify against
  ingest-full-runner.ts before writing it.
- BrutalLoadingState for initial load; "Job not found" → EmptyState with "View all runs"
  CTA; transient status-poll failures show a retrying notice instead of swapping the
  whole console to an error paragraph.
- Animations added here respect prefers-reduced-motion (the wizard scroll guard at
  ConnectPipelineWizard.svelte:71-75 is the pattern).
- Component tests: restart renders when canRestart; stall block appears past threshold;
  poll-failure keeps the console mounted. Existing tests green.
- Scope fence: keep the 1.5s polling as-is (W3.1 replaces it); no completion-ledger
  redesign (W4.1 — Machine Room).

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
PR screenshots: failed run with Restart banner, stall state, resumed notice.
Use effort: xhigh — this is the product's most-watched ten minutes.
```

### Stage W1.5 — Route & policy publish un-stranding (versions tab)

*Resolves FUNC P0-1 (+ §3 versioning row). Files:
`apps/dashboard/src/routes/keys/dashboard/projects/[id]/routes/[routeId]/+page.svelte`,
`apps/dashboard/src/routes/keys/dashboard/policies/[id]/+page.svelte` (+ shared versions
component).*

```
ROLE
Senior engineer closing FUNC P0-1: the route builder tells users to "Publish from version
history" — a screen that does not exist anywhere in the dashboard. Edited routes silently
never receive discovery traffic. The identical gap exists for policies.

TARGET
A "Versions" tab on the route builder and the policy detail page: list versions from the
existing /history endpoints, publish the current draft, roll back to a prior version.
The dead banner CTA becomes a real Publish button.

FIRST
- docs/reviews/dashboard-functionality-review-2026-06.md P0-1 (banner at
  routes/[routeId]/+page.svelte:1618-1621; live endpoints:
  api/projects/[id]/routes/[routeId]/history, /publish, /rollback; policy analogues
  policies/[id]/history, /diff, /publish, /rollback — zero .svelte consumers).
- The existing tab structure of the route builder (3,216 lines — add a tab, do NOT
  refactor the file in this run) and policies/[id]/+page.svelte's
  Status/Definition/Test/Bindings sections.
- docs/design/ux-contracts.md §3 (loading/error/empty states for the versions list; publish and
  rollback are state-changing — confirm rollback, since it replaces live config).

ACCEPTANCE CRITERIA
- Route builder: Versions tab listing version history (who/when/which is published);
  "Publish draft" button calling /publish; "Roll back" per prior version calling
  /rollback with a confirm() stating what goes live. The :1618 banner's CTA becomes the
  Publish button (same action, in place).
- Policies: same Versions section using the policy endpoints; the policy detail page
  gains it as a fifth section.
- Empty state (never published) explains what publishing does for discovery traffic;
  error states have retry; success confirms which version is now live.
- After publish/rollback the builder's draft-vs-published banner state updates without a
  manual reload (invalidate the load).
- Tests: a versions-list component test (render states + publish/rollback calls mocked);
  server tests only if endpoint behavior must change (it should not — this is pure UI).
- Scope fence: NO diff view, NO export — that is W3.5. List + publish + rollback only.

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
PR: before (dead banner) / after (versions tab) screenshots.
Use effort: high.
```

### Stage W1.6 — Billing that tells the truth

*Resolves FUNC P0-2, §4 gap 7. Files:
`apps/dashboard/src/routes/keys/dashboard/billing/+page.svelte`, `billing/+page.server.ts`,
server-side Paddle portal-session endpoint (new).*

```
ROLE
Senior engineer fixing the page where a PAYING customer currently has no path to update
payment details, cancel, or see an invoice (FUNC P0-2): both CTAs link to the billing
page itself, and invoices are hardcoded [].

TARGET
"Manage subscription" opens a real Paddle customer-portal session generated server-side;
the invoices list is fetched from Paddle. If portal-session generation is not feasible
with the current Paddle integration, the page stops lying: dead buttons removed, honest
copy + Paddle email-receipt guidance shipped instead — and the gap is raised as a
question per the delivery protocol.

FIRST
- docs/reviews/dashboard-functionality-review-2026-06.md P0-2 (self-links at
  billing/+page.svelte:37 and :55; invoices: [] unconditional at +page.server.ts:8 while
  the empty state promises invoices "will appear here").
- The existing Paddle plumbing: the checkout webhook under
  src/routes/keys/dashboard/api/billing/webhook — establish what customer/subscription
  identifiers are already persisted, because the portal session needs them.
- Paddle's customer-portal session API (server-side; secret key stays server-side —
  treat this as a restormel-high-risk-security surface: no Paddle secrets in client code
  or logs).

ACCEPTANCE CRITERIA
- Pro users: "Manage subscription" → server endpoint creates a Paddle portal session →
  redirect. Free users: CTA goes to the existing checkout path (not a self-link).
- Invoices listed from Paddle for the customer (date, amount, status, link), with
  ux-contracts §3 states: loading skeleton, error + retry, honest empty state.
- STOP gate: if the stored Paddle identifiers are insufficient to create portal sessions
  for existing subscribers, STOP and present options (backfill vs support-link fallback)
  before building either.
- No entitlement logic changes; the plan display continues to come from the existing
  entitlements load.
- Tests: portal-session endpoint unit test (auth required, maps workspace → customer id,
  never leaks the secret), invoices mapper test. Dashboard suite green.

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
Run the restormel-high-risk-security checklist before PR (new authed endpoint touching a
billing provider). PR: screenshots of Pro and free states.
Use effort: high.
```

### Stage W1.7 — Recovery-state sweep: SignInNotice, retry, ops-copy leaks

*Resolves UX A-P1-1, A-P1-2, A-P1-3. Files: eight Connect route pages + a new shared
component; `activity/+page.svelte` (one line); `connect/+page.svelte` (banner gating).*

```
ROLE
Senior engineer finishing what PR #190 started: the wizard got a Sign in button on its
signed-out state; eight sibling surfaces still strand signed-out users with message-only
notices, and three panel catch blocks say "Refresh to try again" with nothing to press.

TARGET
One shared <SignInNotice> used everywhere; the three catch blocks reuse the trust
scorecard's working retry pattern; internal-ops copy stops leaking to customers.

FIRST
- docs/reviews/dashboard-ux-review-2026-06.md A-P1-1 (the eight: connect/+page.svelte:46,
  connect/proof/+page.svelte:23, connect/graph/+page.svelte:63, connect/mcp/+page.svelte:18,
  connect/library/+page.svelte:22, connect/models/+page.svelte:276,
  connect/ingest/+page.svelte:40, connect/ingest/new/+page.svelte:85), A-P1-2 (bare
  role="alert" catch blocks: connect/+page.svelte:123-125, mcp:22-24, proof:35-37; the
  good pattern: ConnectTrustScorecard.svelte:175-186 — BrutalErrorBanner + invalidateAll),
  A-P1-3 ("Check Vercel logs" at activity/+page.svelte:148; the
  RESTORMEL_CREDENTIALS_ENCRYPTION_KEY env banner at connect/+page.svelte:82-91).
- ConnectPipelineWizard.svelte:168-171 (the PR #190 reference implementation).
- docs/design/ux-contracts.md §3 (recovery actions mandatory on every error/empty state).

ACCEPTANCE CRITERIA
- <SignInNotice> component (message + btn btn-primary → /keys/dashboard/login) swapped
  into all eight surfaces. (If W4.7 deletes ingest/new before this merges, seven.)
- The three catch blocks render BrutalErrorBanner with a working "Try again"
  (invalidateAll) via the banner's actions snippet.
- activity error copy: generic message + retry; no "Vercel".
- The encryption-key banner is gated to self-host/dev (env-driven flag) and becomes
  role="alert" when it actually blocks saving keys; cloud users see nothing.
- Component test for SignInNotice; spot test that a failed hub panel shows a retry
  button. Suite green.

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
PR: one screenshot per pattern (notice, retry banner, gated env banner).
Use effort: medium.
```

### Stage W2.1 — Graph explorer URL contract + review badge *(fires in Batch 1)*

*Resolves UX IA-6, C-P1-3, C-P2-1; FUNC P1-1(c). Files:
`apps/dashboard/src/lib/components/connect/ConnectGraphExplorer.svelte` (param init only),
`connect/graph/+page.svelte`, `src/lib/dashboard-hub-nav.ts` (badge).*

```
ROLE
Senior engineer fixing the dead deep-link contract every quality CTA in the product
depends on: four surfaces link to /connect/graph?filter=review, but the explorer reads
only `workspace` and `focus` — it works today by coincidence (UX IA-6). There is also no
way to deep-link a SPECIFIC claim, which blocks the Evidence Dossier (W2.2), the proof
drawer, and "Prove it" (W4.3).

TARGET
The explorer honors `filter` (queue scope + verdict/verification filters) and `unit`
(select + scroll to a specific claim) URL params; the Graph hub tab shows a review-count
badge; arriving via a quality CTA shows a dismissible context line.

FIRST
- docs/reviews/dashboard-ux-review-2026-06.md IA-6 (inbound links:
  ConnectTrustScorecard.svelte:164, ConnectIngestRunConsole.svelte:345,406,
  graph-health-summary.ts:54; the explorer parses only workspace/focus at
  ConnectGraphExplorer.svelte:632,660), C-P1-3 (queue internals: queueScope,
  verdictFilter, pagination at :1024-1030,2297-2330 — init these from the URL),
  C-P2-1 (context line copy).
- docs/reviews/dashboard-functionality-review-2026-06.md P1-1(c) (the scorecard chips
  must deep-link to a verification-state-filtered queue — reserve filter values for
  verification states now: e.g. filter=review|unverified|contradicted|abstained, even
  though the data lands in W2.2).
- The hub stats already loaded for the Connect tabs (review-count badge feeds from them —
  no new query; note pivot Stage 1.8's one-stats-resolution-per-request invariant).

ACCEPTANCE CRITERIA
- ?filter= initializes queue scope/filters; ?unit=<id> selects that claim and opens its
  detail panel; both params are written back on user changes (shareable URLs,
  back/forward safe via replaceState).
- The four inbound CTAs keep working and now do so by contract, not coincidence; update
  any whose filter value should be more specific.
- Graph hub tab badge: count of review-state claims from existing hub stats; hidden at
  zero; aria-label spells it out ("Graph — 12 claims need review").
- Context line on CTA arrival: "Showing N flagged ideas from your trust scorecard"
  (dismissible, role="status").
- Unit tests for param parsing/writing (the explorer is 4,877 lines — extract the URL
  state logic into a testable module rather than testing the monolith).
- Scope fence: no new data in the units API (W2.2), no panel redesign.

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
PR: a clickthrough recording scorecard → filtered queue → specific unit URL.
Use effort: high.
```

---

## Wave 2 — Make the engine visible

### Stage W2.2 — The Evidence Dossier (claim-level "why is this trusted") — ✅ merged (#263)

*Resolves FUNC P1-1(a,b) + §4 gap 1; UX D-P0-1, IA-4, signature 3.1. Files:
`apps/dashboard/src/routes/keys/dashboard/api/connect/graph/units/+server.ts`,
`ConnectGraphExplorer.svelte` (detail panel + queue facet),
`src/lib/components/connect/graph-comparison/ProvenanceDrawer.svelte` (links).*

> **Shipped (post-Wave-R note, 2026-06-12):** merged before Wave R; the explorer now mounts at
> `/claims` (R5), so ProvenanceDrawer claims deep-link to `/claims?unit=<id>` (via `CLAIMS_HREF`),
> not the old `/connect/graph?unit=`. The units API endpoint did not move
> (`api/connect/graph/units/+server.ts`). The original prompt text below is preserved as the build
> record; read `/connect/graph` references in it as `/claims`.

```
ROLE
Senior engineer building the single most differentiating surface this product can own
(FUNC §4 gap 1): the claim detail panel becomes an Evidence Dossier answering "why is
this claim trusted" — with the actual evidence, not just a badge. Today the user can see
THAT a claim is "Supported", never BY WHAT (UX D-P0-1); the scorecard sells
"re-checkable source spans" the UI cannot show.

TARGET
(1) The units API carries verification_state, evidence (quote + offsets + binding status
+ source ref + validated_at), and the latest judgment (model id, prompt version,
confidence, at). (2) The explorer queue gains an Evidence facet filtering by
verification_state (supported/inferred/unverified/contradicted/excluded). (3) The detail
panel becomes the dossier: verdict stamp, evidence excerpt card, chain-of-custody line,
"Re-check now", claim-versions ledger. (4) Per-claim actions: re-verify, accept, exclude.

FIRST
- docs/reviews/dashboard-functionality-review-2026-06.md P1-1 in full (the gap and the
  three-part fix) and §3 (the missing-UI table rows for review queue + verification rules).
- docs/reviews/dashboard-ux-review-2026-06.md D-P0-1 (server data exists:
  evidence-persist.ts:23-51 binds each stored unit's evidence quote; claim-versions
  migrations version them; the Unit type and detail panel at
  ConnectGraphExplorer.svelte:2357-2403 carry none of it) and §3.1 (the dossier design:
  rubber-stamp verdict with validated-at in the stamp ring, offset-shadow evidence
  excerpt card with the span highlighted in context + "open source ↗", mono
  chain-of-custody line SOURCE → SPAN → CLAIM → JUDGE (model id) → STATE, "Re-check now",
  claim versions as a <details> ledger).
- Server truth: apps/dashboard/src/lib/server/connect/evidence-persist.ts, the EBV ADR
  (docs/decisions/evidence-bound-verification.md), verifyEvidenceSpan (deterministic
  Layer-1 re-check — connect-core evidence-binding), the soft-exclude machinery (reuse
  for exclude; never hard-delete), and the existing judgment persistence (Layer 2).
- W2.1's URL contract (?unit= deep links land here; the Evidence facet maps to ?filter=).
- docs/product/verified-context-claims-ledger.md — rows 2, 9, 10 are the proven claims this UI
  visualizes; the falsifiability test ("a skeptical user can click through to the quoted
  span in the source and check it themselves") is THE acceptance bar for this panel.

ACCEPTANCE CRITERIA
- Units API: additive response fields (verification_state, evidence[], judge, versions
  summary); no breaking change to existing consumers; server test for the new shape.
- Evidence facet: filter by verification state; counts per state; scorecard chips
  (W2.1's reserved filter values) land on the right facet.
- Dossier panel per §3.1: stamp (uppercase mono, 2px ink frame, slight rotation; coral
  CONTRADICTED, ink-on-yellow SUPPORTED — restormel-neu-brutalist-ui tokens, no new hex),
  evidence excerpt with the bound quote highlighted and "open source ↗" to the source
  document, chain-of-custody line with hoverable hops (judge hop names model id + prompt
  version; include the verification-rule name where one applied — FUNC §3
  verification-rules row), claim-versions <details> when versions exist ("superseded
  2 May — text changed in source").
- "Re-check now": runs the DETERMINISTIC Layer-1 re-check (verifyEvidenceSpan — no model
  keys needed) and updates binding status inline; if re-judging (Layer 2) is offered it
  is a separate, clearly-labelled action that may cost model calls (live-key boundary:
  stub-tested; demoed by the key-holder).
- Actions: accept (→ supported only if Layer-1 bound — never allow accepting an unbound
  claim into supported; the ledger row 2 invariant must hold in the UI), exclude
  (reversible soft-exclude), re-verify. Each action optimistic with rollback on failure,
  confirm on exclude.
- ProvenanceDrawer claims link to /connect/graph?unit=<id>.
- A claim with NO bound evidence shows an honest empty evidence block ("No evidence span
  could be bound — this claim can never be marked supported") — not a blank.
- ux-contracts §3 states on the panel and facet; unit tests for the facet filter mapping,
  the accept-guard (unbound → cannot support), and the API shape.
- STOP gate: if evidence data for pre-EBV graphs is missing/unbackfilled, surface
  "predates evidence binding — re-ingest to bind" rather than fabricating; if that state
  is widespread, STOP and propose backfill sequencing.
- Scope fence: NO keyboard triage loop, NO session tally (W4.2 — Stamping Desk).

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
PR: dossier screenshots for each verification state incl. the no-evidence state; cite
ledger rows 2/9/10 for any copy asserting what verification means.
Use effort: xhigh.
```

### Stage W2.3 — One Trust Ledger (single score + paper trail + state tokens)

*Resolves UX D-P1-1, D-P1-2, D-P1-3, D-P1-4, D-P2-1, D-P2-2, signature 3.3. Files:
`ConnectTrustScorecard.svelte`, `ConnectQualityHistory.svelte`,
`src/lib/server/connect/graph-health-summary.ts`, `connect/+page.svelte`,
`packages/keys-tokens` (state tokens).*

> **Re-scope note (R1, 2026-06-12 — see `docs/design/keys-northstar-redesign-2026-06.md` §4.1):**
> W2.3 **survives, re-targeted.** The One Trust Ledger component mounts as the **Home masthead**
> (`/home` §3.3 wireframe), not as a Connect hub panel. Build the component-first (the single-source
> rule and token work are identical), then let R3 mount it. If W2.3 fires before R3 it may mount on
> the current `/connect` hub temporarily; R3 then moves the mount without rebuilding the component.
> The no-second-formula test survives unchanged. Coverage-gap rows that linked to
> `pipeline?step=store` will be updated in R4 to link to `/sources/ingest?step=store`.

> **Shipped (post-Wave-R re-baseline, 2026-06-12):** ✅ merged (#270), then carried onto R3. The
> single-source trust ledger is live as the `/home` masthead (`ConnectTrustScorecard.svelte`
> capped in `routes/keys/dashboard/home/+page.svelte`). Two citations above drifted with Wave R:
> `graph-health-summary.ts` moved from `lib/server/connect/` to **`lib/connect/graph-health-summary.ts`**
> (now a pure client-importable module), and the `connect/+page.svelte` mount is gone — the ledger
> lives at `/home` and the quality-history headline is assembled in
> `lib/server/connect/connect-hub-load.ts` (there is no standalone `ConnectQualityHistory.svelte`
> anymore). Coverage-gap fix links now target `/sources/ingest?step=store`. The keys-tokens state
> work shipped as spec'd.

```
ROLE
Senior engineer fixing the most ironic finding in either review: the product whose pitch
is TRUST shows two conflicting trust numbers on one page — the setup ledger's kg-audit
pulse and the scorecard's factor-breakdown score, different formulas, different
freshness (UX D-P1-1).

TARGET
One number. The trust-scorecard service becomes the single source; the hub merges pulse +
scorecard + quality-history headline into ONE cap+body ledger (UX signature 3.3); every
other surface QUOTES it. Plus: real state tokens replacing the undefined "tint" tokens
riding hex fallbacks (D-P1-4 — a latent invisible-text bug).

FIRST
- docs/reviews/dashboard-ux-review-2026-06.md D-P1-1 (pulse: graph-health-summary.ts:20,105
  via buildAuditSummary; scorecard: trust-scorecard-service.ts:132), §3.3 (the design:
  neon cap = 4-rem stamped score + G2 bar chip + last-verified + 20-verdict sparkline;
  white body = factor rails where every row is a receipt — "−6.2 pts · Evidence binding ·
  41 unbound → [Show the 41]" deep-linking via W2.1's filter params), D-P1-2 (dead-ends:
  "run validation" with no control :88, coverage-gaps with no link :131-134, one generic
  triage link :163-165), D-P1-3 (history rows link nowhere; aria-label jargon; no trend
  visual), D-P1-4 (undefined --color-*-tint tokens used as both background AND
  border/text — ConnectTrustScorecard.svelte:262, ConnectQualityHistory.svelte:189,265),
  D-P2-1 (color-only severity rail), D-P2-2 (recovery buttons outside
  BrutalErrorBanner's actions snippet).
- restormel-keys-vs-platform skill BEFORE touching packages/keys-tokens (token changes
  may belong in the platform mirror — check).
- Pivot Stage 1.8 invariant: resolveConnectGraphStats at most once per hub request — the
  merged ledger must not add stats calls.

ACCEPTANCE CRITERIA
- The hub renders ONE trust ledger (cap+body per §3.3); the setup-ledger pulse quotes the
  scorecard service's number (or drops its own); the run console's post-run score is
  labelled "this run's audit" if it must differ. Formula footnoted once.
- Factor rails deep-link per-factor to the filtered queue (?filter= values from W2.1;
  evidence-state factors light up fully once W2.2 merges — coordinate values now).
- "Last verified: Never" links to the explorer's revalidate tool; coverage-gap rows link
  to pipeline?step=store.
- Quality-history: sparkline header (trust/G2 over the last 20 verdicts); each entry
  links to its source (run console for ingest_run; commit/CI link for ci_action when the
  payload carries one); reasons stay as expandable detail; aria-label loses the jargon
  ("Quality history"). Severity rail gains a glyph (■/□/▲).
- New tokens in @restormel/keys-tokens: --state-ok-bg/-fg, --state-warn-bg/-fg,
  --state-fail-bg/-fg; ALL tint-fallback usages in these components replaced (grep for
  --color-green-tint/--color-red-tint/--color-yellow-tint and clear them here; W4.4
  sweeps any stragglers elsewhere).
- Error/empty/loading per ux-contracts §3; recovery actions move INTO
  BrutalErrorBanner's actions snippet (D-P2-2).
- Tests: a service-level test that hub pulse and scorecard expose the same score for the
  same store state; token presence test if the package has one; component tests updated.
- Claims-ledger rule: any copy on the ledger asserting verification semantics cites
  proven rows (e.g. row 8 for the G2 bar phrasing) in the PR.

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib (plus
the keys-tokens package's build/test). PR: before (two numbers) / after (one ledger)
screenshots.
Use effort: xhigh.
```

### Stage W2.4 — Memory-writes inbox + generated MCP catalog — ✅ merged (#258)

*Resolves FUNC §3 (memory row), §4 gap 9a, P2-7. Files: new
`connect/memory` route + components; `dev-tools/mcp/+page.svelte`;
`packages/mcp` (catalog export only).*

> **Shipped (post-Wave-R note, 2026-06-12):** merged before Wave R. The two route citations above
> were relocated by Wave R: the memory inbox is now at **`/claims/memory`** (R2/R5;
> `routes/keys/dashboard/claims/memory/+page.svelte`, inbox rows link to `/claims?unit=<id>`), and
> the generated MCP catalog now lives at **`/agents/catalogs`** (R5) — the old `/dev-tools/mcp`
> 308-redirects there. The `packages/mcp` catalog-export work is unchanged.

```
ROLE
Senior engineer making pivot Stage 3.4 (agent memory writes) visible: agents can write
observations through the quality gate via POST /connect/v1/memory and the
connect.memory.write MCP tool — and the dashboard shows none of it. An invisible write
path into the user's graph is a trust problem, not just a feature gap.

TARGET
A "Memory" surface under the Connect hub: what agents wrote (claims with provenance
"agent_observation" + the submitting key's identity), their verification outcome
(accepted / rejected-with-reasons / pending review), and revoke/supersede actions.
Plus: the dev-tools MCP catalog stops being hand-maintained (it currently ends at
connect.verify and omits connect.memory.write — FUNC P2-7).

FIRST
- docs/reviews/dashboard-functionality-review-2026-06.md §3 (memory row: "no memory
  inbox/list, no provenance view of agent-written claims") and §4 gap 9.
- The Stage 3.4 implementation: the /connect/v1/memory route handler, its validation/
  remediation reuse, and packages/mcp/src/connect-memory-write.ts (what identity and
  provenance fields are persisted — the inbox renders what exists; if a needed field
  isn't persisted, STOP and propose the addition).
- The soft-exclude machinery (revoke = reversible exclude; supersede follows the
  claim-versions chain from pivot 3.2) and W2.1's ?unit= links (inbox rows link to the
  dossier).
- packages/mcp suite-tool-names / tool registry (export a typed catalog the dashboard
  page imports or fetches — single source of truth).

ACCEPTANCE CRITERIA
- Inbox lists agent-written claims newest-first: claim text, submitting key identity,
  timestamp, verification state chip, link to /connect/graph?unit=<id>.
- Rejected observations show their rejection reasons (the API already returns reasons to
  the caller — persist/surface them; fail-closed but transparent, per the Stage 3.4
  contract).
- Revoke (confirm + reversible) and supersede actions; revoked claims disappear from
  retrieval per existing soft-exclude semantics — state that in the success copy only if
  true (verify against the orchestrator; claims-ledger row 4 phrasing).
- Hub navigation entry (tab or hub card — follow the W1.1 registry for the noun);
  ux-contracts §3 states; empty state explains how to wire connect.memory.write (link
  the MCP quickstart guide).
- dev-tools/mcp catalog rendered from the MCP package's tool registry (name,
  description, params) — connect.memory.write appears; a test asserts the page lists
  every registered tool so it can never go stale again.
- Tests: inbox load/empty/error states; revoke action (mocked); catalog completeness.

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib &&
pnpm --filter @restormel/mcp test. PR: inbox screenshots incl. a rejected observation
with reasons.
Use effort: high.
```

### Stage W2.5 — As-of time travel in the explorer

*Resolves FUNC §3 (as-of row), §4 gap 9b. Files: `ConnectGraphExplorer.svelte` (toolbar +
query path), `api/connect/graph/units/+server.ts` (as_of passthrough). Depends on W2.2.*

> **Re-scope note (post-Wave-R re-baseline, 2026-06-12):** un-shipped; files are still accurate —
> the explorer component (`lib/components/connect/ConnectGraphExplorer.svelte`) and the units API
> (`api/connect/graph/units/+server.ts`) did NOT move with Wave R. Only the page **route** changed:
> the explorer now mounts at **`/claims`** (was `/connect/graph`). Read "the graph explorer" /
> "explorer toolbar" below as `/claims`, and the `?as_of=` URL param lives on `/claims` (shareable
> historical views resolve there; old `/connect/graph?as_of=` 308-redirects with the query
> preserved). W2.2 (the dependency) is merged (#263).

```
ROLE
Senior engineer surfacing pivot Stage 3.3: temporal validity and as-of retrieval shipped
(PR #236) — and `asOf`/`as_of` appears in ZERO .svelte files. Time-travel is entirely
invisible.

TARGET
A "View as of <date>" control in the graph explorer: the units query honors as_of, the UI
banners that it is showing a historical view, superseded claims are visible behind an
explicit audit flag, and the dossier (W2.2) shows each claim's validity window.

FIRST
- docs/reviews/dashboard-functionality-review-2026-06.md §3 (as-of row) and §4 gap 9
  ("as-of explorer toggle ≈ 3–4 days on the retrieve path").
- The Stage 3.3 implementation: as_of on connect v1 retrieve, valid_from/valid_to/
  superseded_by fields, the supersession-boundary test cases — the UI must respect the
  same boundary semantics (a claim valid until T is shown at T-ε, not at T).
- W2.2's units API additions (extend with the temporal fields + as_of param in the same
  additive style) and W2.1's URL contract (as_of belongs in the URL too — shareable
  historical views).

ACCEPTANCE CRITERIA
- Date/time picker in the explorer toolbar; ?as_of= URL param; a persistent, dismissable
  historical-view banner ("Viewing graph as of 3 May 2026 — counts and states reflect
  that instant") while active; one click back to "now".
- Superseded claims appear only with the explicit "include superseded" audit toggle,
  visually distinct (stamped SUPERSEDED), linking to their successor via the
  claim-versions chain.
- Dossier shows valid_from/valid_to and the supersession chain hop when present.
- Review-queue actions (accept/exclude) are DISABLED in historical view — you cannot
  edit the past; tooltip + aria-disabled explain why.
- Tests: as_of param plumbing, the boundary case (claim superseded exactly at the chosen
  instant), actions-disabled guard.
- STOP gate: if the units endpoint cannot express as_of without breaking the W2.2 shape,
  STOP and propose the contract change first.

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
PR: recording of toggling as-of and a superseded claim's dossier.
Use effort: high.
```

### Stage W2.6 — Overview becomes the verified-context home — ✅ merged (#257)

*Resolves UX IA-3; FUNC P2-1. Files: `activity/+page.svelte`, `activity/+page.server.ts`.*

> **Shipped + superseded by R3 (post-Wave-R note, 2026-06-12):** merged before Wave R as the down
> payment on One Home (the trust strip + parallelised load on the old `/activity` Overview). R3
> (#277) then completed the merge: `/activity` and `/connect` both MERGE-INTO **`/home`**, so
> `activity/+page.svelte` is gone and `activity/+page.server.ts` is now a 308 redirect to `/home`.
> The verified-context masthead and its single-source trust strip live at
> `routes/keys/dashboard/home/+page.svelte` (R3). No further W2.6 work outstanding.

```
ROLE
Senior engineer resolving the two-competing-homes problem (UX IA-3): login lands on an
Overview whose checklist is 100% Keys-routing and never mentions the graph, trust, or
verification — while the Connect hub calls itself "Your workspace home". The product's
headline is invisible on its landing page.

TARGET
Overview leads with the verified-context journey: a trust strip quoting the One Trust
Ledger (W2.3 — quote, never recompute), the verification journey in the checklist
(connect a store → ingest → review claims → wire an agent), and the routing checklist
demoted to its supporting role. Plus FUNC P2-1: the load stops being a sequential
waterfall.

FIRST
- docs/reviews/dashboard-ux-review-2026-06.md IA-3 (checklist at activity/+page.svelte:81-89;
  hub self-title at connect/+page.svelte:33) — decide ONE "home" voice: Overview is the
  cross-product landing; the Connect hub is the Connect workspace. Update the hub's
  self-description accordingly (coordinate with the W1.1 registry).
- docs/reviews/dashboard-functionality-review-2026-06.md P2-1 (activity/+page.server.ts:39-101
  awaits workspace→keys→integrations→bindings→routes(N+1)→logs(500)→aggregates in
  series; the Connect hub's streaming pattern is the model).
- The trust-scorecard service (W2.3's single source) for the trust strip.

ACCEPTANCE CRITERIA
- Trust strip on Overview: score + supported% + review count, linking to the hub ledger
  and the filtered queue (W2.1 params). It QUOTES the scorecard service — a test asserts
  no second formula.
- Checklist covers both journeys with real completion detection for the Connect steps
  (store connected / first run / first review / agent wired — derive from existing hub
  stats, no new queries per the Stage 1.8 invariant).
- Load parallelised (Promise.all groups) and the slow aggregates streamed (SvelteKit
  streaming like the hub); page paints the shell + checklist before logs/aggregates land.
- ux-contracts §3 states preserved per panel; signed-out behavior unchanged (W4.6 owns
  the redirect decision).
- Any verification phrasing cites proven claims-ledger rows in the PR.
- Tests: checklist completion mapping; the load returns streamed promises (shape test).

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
PR: before/after screenshots + a note on load timing (even rough local numbers).
Use effort: high.
```

---

## Wave 3 — World-class operator ergonomics

### Stage W3.1 — Live updates: SSE for runs + list pagination (closes F8/F9)

*Resolves FUNC §4 gap 5, P1-4 (remainder), P2-2 — where open findings F8/F9 from
`docs/reviews/connect-runtime-reliability-perf.md` land. Files:
new `api/connect/ingest/events` SSE endpoint, `ConnectIngestRunConsole.svelte` (transport
swap), `connect/ingest/+page.svelte` (live + pagination),
`api/connect/ingest/jobs/+server.ts` (cursor passthrough).*

> **Re-scope note (post-Wave-R re-baseline, 2026-06-12):** un-shipped; refresh citations:
> - The runs **list** moved from `connect/ingest/+page.svelte` to **`routes/keys/dashboard/runs/+page.svelte`**
>   (R2), and the run **console** mounts at **`/runs/[id]/+page.svelte`** (the `ConnectIngestRunConsole.svelte`
>   component path is unchanged). The "live + pagination" target is `runs/+page.svelte` now.
> - The SSE endpoint and `api/connect/ingest/jobs/+server.ts` did NOT move (the `/api/connect/*`
>   tree is intact). The new `api/connect/ingest/events` SSE endpoint is still to be built.
> - **SSE precedent moved:** the proof-chat stream is now at **`routes/keys/dashboard/prove/api/stream/+server.ts`**
>   (was `connect/proof/api/stream`).
> - **Poll diet already partly landed:** the console poll is now **2.5s jittered** (not 1.5s) with
>   conditional COUNT — see `ConnectIngestRunConsole.svelte` (`pollMs = active ? 2500 : 4000`). Read
>   the "polls every 1.5s" framing below as the historical pre-fix baseline; W3.1's remaining job is
>   the SSE channel + cursor pagination, with the existing jittered poll as the documented fallback.
> - **Chip-transport consumer now exists:** `stores/live-run-poll.ts` (R6) is the **designated SSE
>   swap point** — it ships a 30s ambient poll of `/api/connect/ingest/jobs` behind the topbar
>   `LiveRunChip` with the exact store contract W3.1's SSE must preserve. W3.1 replaces its fetch
>   loop with the event subscription (the module's header documents this).

```
ROLE
Senior engineer replacing polling-or-stale with one live channel. Today the run console
polls every 1.5s with 4 queries per tick (F8) while the runs list and hub never update at
all; runs older than the latest 20 are unreachable (the BFF ignores the data layer's
keyset cursor). The proof chat already proves SSE works in this stack.

TARGET
One SSE channel for job status + log lines consumed by the run console and the runs
list; keyset pagination ("Load more") and a live status column on the runs list. The F8
fix list ships as the fallback path for clients/platforms where SSE drops.

FIRST
- docs/reviews/connect-runtime-reliability-perf.md F8 (poll weight: pollMs=1500 at
  ConnectIngestRunConsole.svelte:108; each poll = session resolve + job row + log rows +
  COUNT(*) at api/connect/ingest/jobs/[jobId]/status/+server.ts:18-38; the fix list:
  conditional count, jittered 2.5–3s, workspace cache) and F9 (runs sharing the
  interactive instance — note that durable runs (pivot 1.6) and the cron-drain design
  exist; this stage does NOT move execution, it only streams state).
- docs/reviews/dashboard-functionality-review-2026-06.md §4 gap 5 (the SSE precedent:
  connect/proof/api/stream/+server.ts) and P1-4 (cursor support exists at neon.ts:5809,
  default 20, keyset — the BFF at api/connect/ingest/jobs/+server.ts:26-33 ignores it).
- W1.4's stall/reclaim narration (the SSE events must carry heartbeat/reclaim/resume so
  the narration goes live rather than poll-detected).

ACCEPTANCE CRITERIA
- SSE endpoint streaming job status transitions, progress, heartbeat age, and new log
  lines for a workspace's active runs; auth identical to the polled endpoints; heartbeat
  comments keep proxies from idling the stream.
- Run console consumes SSE; the 1.5s poll remains ONLY as automatic fallback (jittered
  2.5–3s + conditional COUNT + workspace cache — the F8 fixes — engaged on SSE failure,
  with a visible "live updates degraded to polling" mono note).
- Runs list: live status while any run is active; "Load more" via cursor params; the
  honest stale-count from W1.3 updates live.
- STOP gate: if the deployment platform cannot hold SSE connections reliably for
  10-minute runs (verify against the current hosting + the Coolify migration memory),
  STOP and propose: ship the F8 polling fixes alone now, SSE behind a flag for the
  Coolify target.
- Tests: SSE message framing unit tests; fallback engagement test; cursor passthrough
  test. Suite green.
- PR quotes before/after queries-per-minute for one active run (code-traced is fine).

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
Use effort: xhigh — transport correctness + graceful degradation are the whole point.
```

### Stage W3.2 — In-dashboard request tester wired to real config

*Resolves FUNC P1-3, P1-2 (simulate/explain-chain), §4 gap 3 — "the single biggest
activation lever". Files: `sandbox/+page.svelte` (workspace mode), route builder Flow/More
tab (mount `src/lib/components/dashboard/RouteResolutionPreview.svelte`).*

> **Re-scope note (post-Wave-R re-baseline, 2026-06-12):** un-shipped; **citations verified intact.**
> Wave R reshaped the Connect-hub surfaces only — it did NOT touch `/sandbox`, the route builder
> (`projects/[id]/routes/[routeId]/+page.svelte`), `RouteResolutionPreview.svelte` (still
> un-mounted at `lib/components/dashboard/`), the `runtime/invoke` endpoint, or `/logs`. The
> "deep-link the resulting request-log row" target is still `/logs`. No geography change needed.

```
ROLE
Senior engineer closing the activation loop: the core promised journey — configure route
→ send one test request → see it resolve and appear in Logs — currently cannot be
completed inside the dashboard at all; users must drop to curl (FUNC P1-3). A finished
component for half of this (RouteResolutionPreview — simulate + explain-chain) is
imported by NOTHING (FUNC P1-2).

TARGET
(1) RouteResolutionPreview mounted in the route builder (Flow tab side panel or More
tab). (2) The sandbox gains a "Use my workspace" mode: pick project + route → see the
resolve decision (explain-chain), provider chain, then optionally fire a real request
via the existing runtime invoke endpoint and deep-link the resulting request-log row.

FIRST
- docs/reviews/dashboard-functionality-review-2026-06.md P1-2 (the orphaned component
  calls …/routes/[routeId]/simulate and /explain-chain; the builder's More tab holds
  only a Logs link at routes/[routeId]/+page.svelte:2342-2348) and P1-3 (sandbox is a
  pure client-side BYOK playground; the invoke path exists at
  api/projects/[id]/routes/[routeId]/runtime/invoke; §4 gap 3 sketches the panel: route →
  prompt → resolve decision, provider chain, latency, cost, log row).
- The restormel-keys-routing skill (resolve/simulate semantics, routingContext vs
  dashboard resolve) before wiring.
- LIVE-KEY BOUNDARY: simulate/explain-chain are config-only (no provider calls) — fully
  testable keyless. The invoke path spends the USER's provider credentials at runtime —
  it must show cost/latency expectations and require an explicit "Send real request"
  confirm; agent tests stub it.

ACCEPTANCE CRITERIA
- RouteResolutionPreview mounted and reachable in the builder; stale props/API drift
  fixed (it has been orphaned — verify against current endpoint shapes and add the test
  it never had).
- Sandbox workspace mode: project/route pickers (existing loads), prompt box, "Explain"
  (simulate + explain-chain, keyless) and "Send real request" (invoke, confirmed) —
  result shows status, latency, cost fields the runtime returns, and a link to the
  request-log row (FUNC P1-7's run↔log cross-link pattern starts here).
- BYOK mode remains the default tab for signed-out/keyless users; ux-contracts §3 states
  on every panel; errors carry recovery actions.
- Tests: resolve-preview rendering with mocked simulate/explain payloads; invoke confirm
  guard (no request without confirmation).
- Scope fence: recommend/export/route-coverage stay in W3.5.

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
PR: recording of route → explain → send → log row (live send by key-holder post-merge
is acceptable; stub recording in the PR).
Use effort: xhigh.
```

### Stage W3.3 — Logs as a debugging product

*Resolves FUNC P1-6, §4 gap 6. Files: `logs/+page.svelte`, `logs/+page.server.ts`,
logs API params.*

> **Re-scope note (post-Wave-R re-baseline, 2026-06-12):** un-shipped; `/logs` was NOT moved by
> Wave R (D6 kept Logs and Usage separate, not folded into a section) — file citations intact. The
> "log row → route builder" deep-link still targets `projects/[id]/routes/[routeId]`. The live-tail
> dependency on W3.1's SSE is unchanged; until W3.1 ships, the modest poll fallback rides the same
> 2.5s-jittered diet now standard in the run console.

```
ROLE
Senior engineer turning the request log into the debugging surface an LLM-gateway
product lives or dies by. Today: filter dropdowns render raw UUID prefixes ("a3f81c92…"),
no text search, no time range, no export, hard 200-row cap (FUNC P1-6).

TARGET
Named filters, time-range picker, free-text search, cursor pagination, CSV/JSON export,
live tail, and systematic deep links (log row → route builder; route builder → its 24h
log slice).

FIRST
- docs/reviews/dashboard-functionality-review-2026-06.md P1-6 (UUID prefixes at
  logs/+page.svelte:122,131; the API already accepts since/until; name-resolution joins
  exist — routes/+page.server.ts is the precedent) and §4 gap 6.
- W3.1's SSE channel if merged (live tail rides it); otherwise a modest poll-based tail
  behind the same UI with a note to upgrade.

ACCEPTANCE CRITERIA
- Project/route filters show NAMES (resolved server-side); time-range presets (15m/1h/
  24h/7d/custom) mapped to since/until; free-text search over the fields the data layer
  can match (add the param server-side; state in the PR what is and isn't searched).
- Cursor pagination ("Load more"); CSV/JSON export of the CURRENT filter set
  (server-generated, capped + stated cap).
- Live tail toggle (newest-first stream or poll; pauses on scroll-up like the run
  console's log idiom); aria-live polite.
- Log row links to its route's builder; the builder's "More" tab links back to a
  pre-filtered 24h slice for that route.
- ux-contracts §3 states; empty state differentiates "no requests yet" from "no matches
  for this filter" with a clear-filters action.
- Tests: filter→query param mapping; export endpoint shape/cap; name resolution.

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
PR: screenshots of named filters, tail, export.
Use effort: xhigh.
```

### Stage W3.4 — Command palette + global search + systematic cross-links — ✅ merged (#256)

*Resolves FUNC P1-7, §4 gap 4. Files: new `/api/search` endpoint, new palette component
in `+layout.svelte`, cross-link touches on entity pages.*

> **Shipped (post-Wave-R note, 2026-06-12):** merged before Wave R. The `/api/search` endpoint is
> live (`routes/keys/dashboard/api/search/`) and the topbar palette button is in `+layout.svelte`.
> Navigation commands and result URLs were carried onto the new IA by R2 (they resolve through
> `nav-config.ts`'s HOME/SOURCES/RUNS/CLAIMS/PROVE/AGENTS hrefs); any palette destinations that
> still point at `/connect/*` are covered by the 308 redirect table but should be re-pointed
> opportunistically.

```
ROLE
Senior engineer giving operators the primary nav Linear/Vercel/Stripe operators expect:
no ⌘K palette exists, no global search, and entity cross-linking is thin (FUNC P1-7).

TARGET
A ⌘K command palette over a single /api/search endpoint covering projects, routes,
policies, gateway keys (by prefix), models, ingest runs (by label), and graph units (by
text) — plus navigation commands ("Go to Logs", "New ingest run") and the start of
systematic run ↔ graph ↔ scorecard ↔ logs ↔ route links.

FIRST
- docs/reviews/dashboard-functionality-review-2026-06.md P1-7 and §4 gap 4 (the entity
  list and the cross-link examples: log rows ↔ route builder, scorecard ↔ producing run,
  route ↔ 24h logs — W3.2/W3.3 land two of these; this stage adds scorecard → producing
  run and run → graph/scorecard).
- The docs-site search at /keys/docs/search for prior art in this repo; the brutalist
  skill for palette styling (hard frame, mono rows, stamped section labels — not a
  translucent Spotlight clone).

ACCEPTANCE CRITERIA
- /api/search: authed, workspace-scoped, returns typed result groups with route URLs;
  per-type result caps; graph-unit text search reuses the existing units search path
  (do not invent a new index in this stage — state current latency honestly).
- Palette: ⌘K/Ctrl-K (and a topbar button for discoverability), fuzzy match on titles,
  keyboard-only operable (arrows/enter/escape, focus trap, aria-combobox pattern),
  recent items, navigation commands registry.
- Cross-links shipped: quality-history/scorecard entries → producing run console
  (coordinates with W2.3 — if merged, verify; if not, add here); run console → its graph
  + scorecard anchors.
- Search endpoint unit tests (scoping! — a workspace must never see another's entities;
  add the negative test) + palette component tests (open, navigate, select).
- ux-contracts §3: empty query state lists commands; no-results state suggests scope;
  endpoint failure degrades to navigation commands, not a dead palette.

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
Security note: the search endpoint is a new authed surface aggregating entity names —
run the restormel-high-risk-security baseline pass before PR.
Use effort: xhigh.
```

### Stage W3.5 — Versioned-config intelligence: diff, export, recommend

*Resolves FUNC P0-1 (diff residue), P1-2 (rest), §4 gap 2. Files: route builder Versions
tab (from W1.5), `policies/[id]/+page.svelte`, step-add dialog.*

> **Re-scope note (post-Wave-R re-baseline, 2026-06-12):** un-shipped; **citations verified intact.**
> The route builder (`projects/[id]/routes/[routeId]`) and `policies/[id]/+page.svelte` were NOT
> moved by Wave R — `/projects`, `/policies`, and `/routes` (Rules + Ingestion tabs) stayed
> top-level. No geography change needed. Note `/routes/ingestion` (R5, ex-`/connect/models`) is a
> sibling surface, not this stage's target.

> **Review-fix note (PR #286, 2026-06-12):** review Majors resolved. **M1** — the structural diff
> now includes step `orderIndex` ("Position") and route `entryStepId` ("Entry step"), so a pure
> fallback-chain reorder is a real diff, not "No changes". **M2** — the publish confirm now shows
> *this* publish's blast radius: the route builder passes the pending draft to `VersionsPanel`, which
> diffs it against the latest published snapshot (draft-vs-live). The policy page lacks a client draft
> model, so it keeps the explicitly-labelled most-recent-published-change summary (asymmetry noted in
> ux-contracts §3). **M3** — the `route-coverage` endpoint is now consumed by `RouteCoverageIndicator`
> on the routes list (`/projects/{id}/routes`): a small honest indicator (zero-enabled-step routes +
> per-environment workload×stage matrix) with loading/empty/error states, linking to the routes it
> summarizes. The `route_step_edges` are still un-versioned (W1.5 server scope) — a filed follow-up.

```
ROLE
Senior engineer finishing the Stripe-grade config story W1.5 unblocked: versions can now
be listed/published/rolled back; world-class means seeing WHAT changed before you do
either (FUNC §4 gap 2), exporting route-as-code, and getting recommendations in the
step-add flow.

TARGET
Diff view between any two versions for routes and policies; "Export" (route-as-code)
beside it; the recommend endpoint wired into the route builder's step-add dialog;
route-coverage surfaced on the route list/detail.

FIRST
- docs/reviews/dashboard-functionality-review-2026-06.md P0-1 (the policy /diff endpoint
  already exists; routes may need a diff endpoint or client-side structural diff over
  /history payloads — prefer reusing the policy endpoint's contract shape) and P1-2
  (recommend, export, route-coverage, validate-binding all live and tested server-side
  with zero consumers).
- W1.5's Versions tab implementation (extend, don't rebuild) and the
  restormel-keys-routing skill (what a route version semantically contains — diff at
  the step/guard-rail level, not raw JSON, wherever feasible).

ACCEPTANCE CRITERIA
- Versions tab: "Compare" between any two versions → structured diff (steps added/
  removed/changed, guard-rail bindings, metadata) with raw-JSON fallback view; the
  publish confirm now embeds the diff summary ("Publishing changes 3 steps…").
- Policies: same diff UI on the existing /diff endpoint.
- Export: route-as-code download/copy from the builder (the existing export endpoint's
  format; document which formats in the PR).
- Step-add dialog: recommendations from the recommend endpoint (with a "why" line per
  recommendation if the payload carries one); selectable but never auto-applied.
- Route list/detail: route-coverage indicator where the endpoint provides it.
- ux-contracts §3 states on diff/export panels; tests for the diff renderer (added/
  removed/changed cases) and recommend wiring (mocked).

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
PR: screenshot of a real diff + the publish-with-diff confirm.
Use effort: xhigh.
```

### Stage W3.6 — Incremental re-ingest UX + BYO opt-in placement

*Resolves UX C-P1-2, E-P1-1, E-P1-2, E-P2-1. Files:
`ConnectGraphStorePanel.svelte`, hub run-chip / `connect/ingest/+page.svelte` header,
wizard launch step preselection. **Coordinate with issue #234.***

> **Re-scope note (R1, 2026-06-12 — see `docs/design/keys-northstar-redesign-2026-06.md` §4.1):**
> W3.6 **survives; chip mount updated.** The changed-source chip mounts on **Home + Runs** (not
> on the Connect hub run-chip + runs header, which dissolve in R2/R3). Concretely:
> - If W3.6 fires **before** R2/R3: mount the chip on the existing hub run-chip AND the
>   `/connect/ingest` header as originally scoped; R3 relocates the chip to `/home` and R2
>   relocates it to `/runs` without rebuilding the component.
> - If W3.6 fires **after** R2: mount directly on `/home` (Home masthead runs rail) and
>   `/runs` (runs list header). The `?step` redirect for the launch CTA updates from
>   `/connect/pipeline?step=launch` to `/sources/ingest?step=launch` (R4's step mapping).
> The BYO opt-in placement and a11y work (E-P1-1/E-P1-2/E-P2-1) are unaffected by geography.

> **Re-scope note (post-Wave-R re-baseline, 2026-06-12):** R2/R3/R4 are all merged, so the
> "**after R2**" branch above is the live reality — build directly against it. Concretely:
> - Changed-source chip mounts in **`routes/keys/dashboard/home/+page.svelte`** (a W3.6 mount-point
>   comment already marks the RUNS RAIL cell) and **`routes/keys/dashboard/runs/+page.svelte`**
>   (runs list header). The old hub run-chip is gone.
> - Launch CTA target is **`/sources/ingest?step=launch`** (`INGEST_FLOW_HREF` in `nav-config.ts`;
>   `pipelineWizardHref('launch')` in `lib/connect/pipeline-config.ts`).
> - The BYO opt-in lives on the **store step**: `ConnectGraphStorePanel.svelte` (path unchanged,
>   `lib/components/connect/pipeline/`) is now rendered by `ConnectPipelineWizard.svelte` inside the
>   `/sources/ingest` flow (R4 demoted the store to an aside; the store step route is
>   `/sources/ingest/store`).
> - **issue #234 still open** — the guard in this stage is unchanged (do not launder a stalled
>   'unchanged' state).

```
ROLE
Senior engineer making pivot Stages 3.2/3.2b visible to the operator who needs them
most: the returning operator. Incremental re-ingest shipped; nothing in the UI ever says
"2 sources changed since the last run", and the BYO claim-versions opt-in that enables
it is hidden behind "Enter fields manually" where the primary quick-connect path never
sees it.

TARGET
(1) Changed-source surfacing: hub run-chip and Runs-list header show "N sources changed
since last run → Re-ingest", linking to the wizard's launch step with the changed set
preselected. (2) The BYO opt-in becomes its own card in the store step's CONNECTED-state
summary (both paths), with a dedicated save affordance and a real accessible name.

FIRST
- docs/reviews/dashboard-ux-review-2026-06.md C-P1-2 (the operational-phase wizard
  exists — phase: "operational", repeat-run kicker; the promise at
  ConnectGraphStorePanel.svelte:670-675), E-P1-1 (toggle buried at :619,650-693 behind
  showAdvanced), E-P1-2 (accessible name is the STATE "On"/"Off", not the purpose —
  fix with aria-labelledby on the heading + aria-describedby on the explanation),
  E-P2-1 (saving the toggle resubmits the whole store form).
- The Stage 3.2 changed-source detection (source-documents fingerprinting) — establish
  what "changed since last run" the server can answer today; if it cannot answer it
  cheaply, STOP and propose the minimal endpoint before building UI on a lie.
- **Open bug, issue #234**: a mid-source stall can leave partial extraction marked
  'unchanged'. The re-ingest CTA must not launder that state: if a prior run for a
  source ended in a stall/reclaim without completing that source, surface it as "needs
  re-ingest (previous run interrupted)" — never "unchanged". If the data to detect this
  isn't exposed, STOP and raise it (it likely rides the #234 fix).

ACCEPTANCE CRITERIA
- Changed-source chip with count; CTA lands on launch with the changed sources
  preselected and copy stating what incremental re-ingest will and won't touch
  (claims-ledger-honest: unchanged units keep state, changed re-validate, removed
  superseded — only if 3.2's tests still prove it; cite in PR).
- BYO opt-in card in the connected-state summary (quick-connect AND manual paths), with
  the full consent copy visible; dedicated "Save preference" that does not re-validate
  endpoint fields; degradation behavior (table-creation failure → full ingest with
  warning) stated on the card.
- a11y: toggle named by purpose, described by explanation; state as sr-only suffix.
- ux-contracts §3 states; tests: changed-count rendering, preselection plumbing, the
  opt-in save path, the accessible-name fix (axe or manual role assertion).

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
PR: screenshots of the changed-source chip and the relocated opt-in card; explicitly
state how the #234 interaction was handled.
Use effort: high.
```

### Stage W3.7 — Team-shared key metadata + audit log depth

*Resolves FUNC P1-5, P2-5, §4 gap 8. Files: `access/+page.svelte`, key API + migration
(label column), `access/audit/+page.server.ts` + page.*

> **Re-scope note (post-Wave-R re-baseline, 2026-06-12):** un-shipped; one citation moved. The
> **audit log relocated** `/access/audit` → **`/prove/audit`** (R5, D5 — audit is a proof
> artefact); the audit-depth work (time-range + actor/action filters, cursor pagination) now
> targets **`routes/keys/dashboard/prove/audit/+page.server.ts` + `+page.svelte`** (still a fixed
> 50-row `listAuditEvents` load — the gap is real). `/access/audit` is a 308 redirect. The
> **key-management half** (`access/+page.svelte`, server-persisted labels + migration) was NOT
> moved — `/access` stayed top-level. K1 (gateway-key metadata contract) still folds into this
> stage; K1 is Staged (un-shipped).

```
ROLE
Senior engineer fixing a credentials surface whose labels are a client-side illusion:
gateway-key labels live only in localStorage keyed by prefix — they vanish on another
browser and are invisible to teammates (FUNC P1-5). The audit log is fixed at 50 rows,
unfiltered, actor-as-type-only (P2-5) — inadequate for "the context layer your auditors
can read".

TARGET
Server-persisted key labels with created-at and last-used columns in the key list;
audit log with time-range + actor/action filters and pagination.

FIRST
- docs/reviews/dashboard-functionality-review-2026-06.md P1-5 (localStorage rk_key_labels
  at access/+page.svelte:37-43,83-86; the create API accepts a body — add a label
  column; last-used derivable from request-log aggregation) and P2-5
  (access/audit/+page.server.ts:16 fixed 50).
- The migrations idiom (apps/dashboard/migrations/, deploy-time per pivot Stage 1.7 —
  numbered file, rollback note) and ux-contracts §2 security/key copy.

ACCEPTANCE CRITERIA
- Migration adds label (and last_used_at if chosen over join-time aggregation — decide
  and justify in the PR); create/edit label in the UI; existing localStorage labels
  offered a one-time import ("We found 3 labels saved in this browser — save them to
  the workspace?") then the localStorage path is removed.
- Key list shows label, created, last-used; copy stays within the registry's security
  language (never display full key material post-create).
- Audit log: time-range + actor + action filters, cursor pagination, actor identity
  (email/key-prefix, not just type) where the event row carries it.
- ux-contracts §3 states; tests: label CRUD endpoint, import mapping, audit filter →
  query mapping.

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
Security pass (restormel-high-risk-security) — key-management surface touched.
Use effort: high.
```

### Stage W3.8 — Testing hub: real runs, real verdicts — ✅ merged (#255)

*Resolves FUNC P1-8. Files: `testing/+page.svelte` (+ server load), verdict-ingest
endpoint following the eval-verdicts pattern.*

> **Shipped (post-Wave-R note, 2026-06-12):** merged before Wave R. `/testing` was NOT moved by
> Wave R (it stayed a top-level hub, separate from the Connect sections — `TESTING_HUB_HREF` in
> `nav-config.ts`), so the citations remain accurate.

```
ROLE
Senior engineer turning the Testing hub from a pointer page (env-var snippets + doc
links) into a hub: the Testing suite produces release packs and CI verdicts, and the
quality-history plumbing (pivot Stage 2.4) already demonstrates exactly how to ingest CI
verdicts into the dashboard (FUNC P1-8).

TARGET
Testing run summaries POSTable via a verdict-ingest endpoint (gateway-key auth,
analogous to /connect/v1/eval/verdicts), rendered as a runs timeline with pass/fail,
trend, and release-pack download links.

FIRST
- docs/reviews/dashboard-functionality-review-2026-06.md P1-8 and the Stage 2.4
  implementation (the verdicts ingest endpoint, its @restormel/contracts schema, the
  ConnectQualityHistory rendering pattern) — copy the pattern, share contracts types
  where the shapes genuinely overlap, do NOT fork a near-duplicate schema silently: if
  the testing verdict needs different fields, version its own contract type.
- What the Testing suite actually emits today (release packs, CI action outputs) —
  the ingest contract must match reality; if the suite needs a change to emit summaries,
  STOP and propose the smallest emitter change (it may belong in the testing action
  package).

ACCEPTANCE CRITERIA
- POST endpoint (gateway-key auth, rate-limited, schema-validated, versioned contract);
  GET for the timeline.
- Testing hub renders: latest verdict banner, runs timeline (pass/fail chips + reasons
  expandable), release-pack download where the payload carries an artifact ref; the
  env-var/snippet cards remain below as setup help.
- Empty state explains how to wire the CI action to POST verdicts (snippet included),
  per the quality-history empty-state precedent.
- ux-contracts §3 states; tests: endpoint auth/validation, timeline rendering states.

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib
(+ contracts package test if a type is added).
Use effort: high.
```

---

## Wave 4 — Signature polish

### Stage W4.1 — The Machine Room (run console as product demo)

*Resolves UX signature 3.2, B-P1-1, B-P2-1. Files: `ConnectIngestRunConsole.svelte`,
`ConnectPipelineReviewLaunch.svelte` (estimate label). Depends on W1.4 + W3.1.*

> **Re-scope note (post-Wave-R re-baseline, 2026-06-12):** un-shipped; both component files are
> unchanged paths (`lib/components/connect/pipeline/`). The run console now **mounts at
> `/runs/[id]`** (`routes/keys/dashboard/runs/[id]/+page.svelte`) — that is the "most-watched ten
> minutes" surface this stage polishes. The completion-ledger trust numbers QUOTE the same
> scorecard service now surfaced on the `/home` masthead (W2.3 merged). SSE source (W3.1) is still
> un-shipped — see W3.1's note; until then the live odometers ride the 2.5s-jittered poll.

```
ROLE
Senior product engineer turning the 10-minute first-run wait into the product demo
(UX §3.2): W1.4 made recovery honest, W3.1 made it live — this stage makes it FELT.

TARGET
Heartbeat strip, per-stage odometers, designed STALLED/RECLAIMED moments, and ONE
completion ledger replacing today's stack of competing blocks.

FIRST
- docs/reviews/dashboard-ux-review-2026-06.md §3.2 in full (heartbeat tick-line
  "▮▮▮▮▯… LAST WORKER SIGNAL 4s AGO" above the CRT log; stage odometers — extracted 412 /
  validated 367 / quarantined 9 counting up live; amber STALLED stamp printing the
  durable-runs contract in plain words; green "RECLAIMED · resumed from checkpoint after
  2m 10s" ledger line; failure = error stamp + failed stage + one primary "Restart from
  checkpoint" button), B-P1-1 (completion can stack success banner :339-364 + scorecard
  :375-397 + "What to do next" :399-437 — merge into one ledger: verdict cap [trust
  score + supported %] above a single next-actions body), B-P2-1 (label the launch
  estimate "floor estimate" or derive from recent run durations in quality history).
- W3.1's SSE events (the odometers/heartbeat consume them; no new polling) and W1.4's
  stall copy (upgrade in place, keep it truthful to ingest-full-runner.ts).
- restormel-neu-brutalist-ui (stamps, ledger lines, CRT idiom; mechanical, not cute).

ACCEPTANCE CRITERIA
- Heartbeat strip + odometers live-update from the SSE payload; all animation respects
  prefers-reduced-motion (static "last signal Xs ago" text fallback).
- STALLED/RECLAIMED/failure moments per §3.2; every state keeps a recovery action
  (ux-contracts §3); copy claims about checkpoints/reclaim remain true to the Stage 1.6
  implementation.
- One completion ledger; the duplicate blocks are deleted, not hidden.
- Trust/supported numbers on the completion ledger QUOTE the scorecard service (W2.3's
  single-source rule; "this run's audit" labelling where it differs).
- Component tests: odometer accumulation from a mocked event stream; completion ledger
  renders once; reduced-motion branch.

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
PR: a screen recording of a stubbed run start→stall→reclaim→complete.
Use effort: xhigh.
```

### Stage W4.2 — The Stamping Desk (keyboard-first triage loop)

*Resolves UX signature 3.4; FUNC §4 gap 1 (actions at speed). Files:
`ConnectGraphExplorer.svelte` queue/detail (on top of W2.2). Depends on W2.2 + W2.3.*

> **Re-scope note (post-Wave-R re-baseline, 2026-06-12):** un-shipped; `ConnectGraphExplorer.svelte`
> path is unchanged but it now **mounts at `/claims`** (`routes/keys/dashboard/claims/+page.svelte`,
> R5) — that is where the keyboard-first triage desk lands. Dependencies W2.2 (#263) and W2.3
> (#270) are both merged; the dossier + accept-guard + single-source scorecard the desk builds on
> all exist. The session trust-delta quotes the scorecard service now mounted on `/home`.

```
ROLE
Senior product engineer building the retention loop for the returning operator: triage
as a mechanical, keyboard-first desk (UX §3.4) — the part of the product nobody else's
RAG console has.

TARGET
J/K moves through queue claims (the dossier updates in place), S stamps Supported, X
stamps Rejected, E opens evidence, N writes a note; each stamp fires the mechanical
press and prints a session-tally ledger line: "REVIEWED 14 · SUPPORTED 11 · REJECTED 3 ·
trust +2.1 this session".

FIRST
- docs/reviews/dashboard-ux-review-2026-06.md §3.4 and the W2.2 dossier (actions +
  guards already exist — notably the accept-guard: an unbound claim can NEVER be stamped
  into supported; the desk must surface that as a disabled stamp with the reason, not a
  silent no-op).
- W2.3's scorecard service (the session trust delta recomputes from it — quote, never
  fork the formula; if per-session delta needs a cheap recompute endpoint, STOP and
  propose it).
- Keyboard a11y prior art in the repo + the explorer's existing coaching expander
  (keep it reachable from the loop).

ACCEPTANCE CRITERIA
- Shortcuts active only when the queue has focus context; a visible "?"-style shortcut
  legend; fully operable without a pointer; shortcuts never hijack typing in inputs
  (N's note field included).
- Every stamp is optimistic with rollback + undo (single-level is fine); destructive
  reject keeps its guard consistent with W2.2 semantics.
- Session tally rail with the trust delta; tally resets per visit; aria-live polite
  announcements for stamp results ("Supported. 12 remaining.").
- The 100ms mechanical press respects prefers-reduced-motion.
- Tests: keymap dispatch unit tests (extracted module), accept-guard surfaced state,
  tally arithmetic.

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
PR: recording of a 5-claim keyboard-only triage session.
Use effort: xhigh.
```

### Stage W4.3 — "Prove it" as a global gesture

*Resolves UX signature 3.5; FUNC §3 (scorecard share row). Files: cross-cutting link
audit + one shared affordance class; optional public scorecard share view (gated).
Depends on W2.1 + W2.2 + W2.3.*

> **Re-scope note (post-Wave-R re-baseline, 2026-06-12):** un-shipped; refresh the named wirings to
> the new IA. Trust assertions now live on **`/home`** (the masthead scorecard, W2.3 merged) and
> the claim receipts on **`/claims`** (the explorer/dossier, W2.2 merged). Proof-drawer claims
> deep-link to **`/claims?unit=<id>`** (already shipped via `CLAIMS_HREF` in `ProvenanceDrawer.svelte`).
> The **public scorecard share view** now has a home: **`/prove/share`** (R5 created the tab as a
> "public scorecard placeholder, gated on W4.3's STOP decision" — see `dashboard-hub-nav.ts`
> `PROVE_HUB_TABS`); this stage's STOP-gated share view fills it. W2.1's filter-param deep links
> resolve on `/claims`.

```
ROLE
Senior product engineer installing the brand habit (UX §3.5): ANY number or badge that
asserts trust is a link to its evidence. Users learn within minutes that in Restormel,
every claim opens its receipt.

TARGET
An audit-and-wire pass over every trust assertion in the dashboard, a shared visual
affordance (dotted underline + ↗ mono, distinct from nav links), and — STOP-gated — a
public share view of the public-shaped scorecard.

FIRST
- docs/reviews/dashboard-ux-review-2026-06.md §3.5 (the named wirings: scorecard factors
  → filtered queue [W2.3 ✓ — verify]; "92% supported" on the launch forecast → last
  run's verdict detail; proof-drawer claims → graph?unit= [W2.2 ✓ — verify];
  quality-history REGRESSION → the diffed claims; the MCP answer's verified-claim
  envelope → a public scorecard URL).
- docs/reviews/dashboard-functionality-review-2026-06.md §3 (scorecard row: "no
  public/share view of the public-shaped scorecard").
- docs/product/verified-context-claims-ledger.md — this stage is the claims-ledger rule
  expressed as interaction design; the PR must demonstrate the falsifiability test on at
  least three surfaces (badge → claim → quoted span → source).

ACCEPTANCE CRITERIA
- A grep-able shared class/component for prove-it links; applied to every audited
  assertion (list the full audit table in the PR: surface → assertion → destination).
- REGRESSION history entries link to the claims the diff flagged (the Stage 2.2 verdict
  payload carries claim identities — surface them; if a payload predates that, degrade
  to the run link).
- Launch forecast percentages link to their producing verdict.
- Public scorecard share view: STOP gate — present the proposed exposure (what fields,
  what auth/expiry model, what the URL leaks) and run restormel-high-risk-security
  BEFORE building; if the owner defers, ship the in-app gesture and file the share view
  as a named follow-up.
- No trust assertion remains link-less; add a lightweight lint/test that the shared
  affordance is used wherever the scorecard service's numbers render (best-effort
  heuristic is acceptable — document it).

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
PR: the audit table + three falsifiability clickthrough recordings.
Use effort: high.
```

### Stage W4.4 — Neo-brutalist consistency sweep *(runs alone)*

*Resolves UX F-P1-1, F-P1-2 (N8). Files: ~10 route pages' local `.page-title` blocks,
Connect components/routes (66 `1px solid` borders), shared `BrutalPageHeader`.*

> **Re-scope note (post-Wave-R re-baseline, 2026-06-12):** this sweep is **deliberately sequenced
> AFTER Wave R** (Operating notes / redesign §4.1) precisely because the Connect routes moved —
> sweeping pre-move geography would waste the pass. The FIRST block below quotes the **frozen UX
> review** (file:line evidence against pre-Wave-R geography) — do NOT chase those exact paths.
> Instead, run the mechanical pass over the **current section pages**: `/home`, `/sources`,
> `/sources/ingest/*`, `/runs`, `/runs/[id]`, `/claims`, `/claims/memory`, `/prove/*`, `/agents/*`,
> `/routes/ingestion`, plus the still-top-level `/access`, `/logs`, `/policies`, `/projects`,
> `/analytics`, `/integrations`, `/testing`. The old `connect/+page.svelte` / `library/+page.svelte`
> heroes are gone (those URLs 308-redirect); the components they used (`ConnectGraphExplorer`,
> `ConnectTrustScorecard`, etc.) kept their `lib/components/connect/` paths and are now rendered by
> the new pages. The `BrutalPageHeader` adoption, 2px-border floor, and tint-token cleanup rules
> are unchanged — apply them to the new surfaces. Re-grep `1px solid` and the tint tokens against
> the current tree (the counts in the review are pre-Wave-R).

```
ROLE
Engineer executing the mechanical design-system pass the UX review specified. This stage
runs ALONE (batch B5) — it touches files across every earlier stage's footprint.

TARGET
One header dialect (BrutalPageHeader everywhere), the 2px micro-border floor enforced,
soft radii removed from Connect operator surfaces.

FIRST
- docs/reviews/dashboard-ux-review-2026-06.md F-P1-1 (display-hero H1s on Connect pages
  vs quiet local .page-title on Keys pages — connect/+page.svelte:144-153,
  library/+page.svelte:45-54 vs access/+page.svelte:143; BrutalPageHeader used exactly
  once, in ConnectGraphExplorer) and F-P1-2 (66 `1px solid` borders against the 2px
  floor; soft --rm-radius cards the skill bans: hub outcomes connect/+page.svelte:173-181,
  runs rows, library notice).
- .claude/skills/restormel-neu-brutalist-ui/SKILL.md and docs/design/design-system-index.md —
  the floor, the banned patterns, the token names. Mechanical rule from the review:
  `1px solid var(--rm-border)` → `var(--border-thin)`; radius → 0 on Connect operator
  surfaces. Re-grep for tint-token stragglers W2.3 may have missed and clear them.

ACCEPTANCE CRITERIA
- BrutalPageHeader shipped as the shared component; ~10 local .page-title style blocks
  deleted; ux-contracts §4 updated if the dashboard pattern line changes (coordinate
  with the W1.1 doc).
- Post-sweep greps quoted in the PR: `1px solid` count on Connect surfaces (target 0
  outside justified exceptions — list any), tint-token usages 0.
- Marketing/docs surfaces untouched (this is the dashboard sweep; the
  restormel-keys-vs-platform boundary respected for token changes).
- Visual regression risk handled by screenshots per major surface in the PR; svelte-check
  + full vitest suite green.

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
Use effort: high — mechanical but wide; discipline over creativity.
```

### Stage W4.5 — Copy + a11y sweep *(runs alone)*

*Resolves UX F-P1-3 (app side), F-P2-1, wizard carry-overs; D-P2-1 if outstanding. Files:
cross-cutting; graded against the W1.1 registry.*

> **Re-scope note (post-Wave-R re-baseline, 2026-06-12):** runs **AFTER Wave R** (same reason as
> W4.4). Grade copy against the **R1 ux-contracts v2** registry (`docs/design/ux-contracts.md` §1/§2/§A,
> PR #273) — it already names the new sections (HOME/SOURCES/RUNS/CLAIMS/PROVE/AGENTS) and resolved
> the models/keys naming drift (the page is now `/routes/ingestion`, tab "Ingestion"). The
> F-P1-3 drift items in the FIRST block quote pre-Wave-R surfaces; the `integrations/+page.svelte`
> ("Connect a Provider"/"Connections") and `analytics/+page.svelte` ("Usage") pages are still
> top-level and unchanged, but verify each H1/`<title>` against the new `PATH_TO_TITLE` in
> `nav-config.ts` before editing. Component citations (`ConnectPipelineWizard.svelte`,
> `ConnectSetupLedger.svelte`, `ConnectIngestRunConsole.svelte`) kept their paths.

```
ROLE
Engineer executing the copy-registry and a11y paper-cut pass, graded against the
re-baselined ux-contracts (W1.1). Runs ALONE (batch B5).

TARGET
Same words everywhere; the named a11y paper cuts closed.

FIRST
- docs/reviews/dashboard-ux-review-2026-06.md F-P1-3 (the drift roll-up: "Connect a
  Provider" H1 under nav "Connections" — integrations/+page.svelte:176; "Usage &
  Analytics" H1 vs nav "Usage" — analytics/+page.svelte:123; the models/keys page's
  three names — apply whatever W1.1 decided) and F-P2-1 (disabled wizard CTAs rely on
  title only — pair with aria-describedby text at ConnectPipelineWizard.svelte:294-332;
  validation pill for UNVALIDATED uses the -ok class — ConnectSetupLedger.svelte:252;
  run-status pulse and .run-starting animations missing prefers-reduced-motion guards —
  ConnectIngestRunConsole.svelte:716-746 has the pattern; "START RUN →" as the only
  all-caps CTA — decide with the registry; document the collapsed-log live-region
  behavior).
- docs/design/ux-contracts.md §2 (post-W1.1) — every rename cites its registry line.

ACCEPTANCE CRITERIA
- All F-P1-3 drift resolved to registry terms; PATH_TO_TITLE, hub tabs, H1s, <title>s
  agree per surface.
- F-P2-1 items each closed or explicitly documented-as-designed (the collapsed live
  region); axe (or equivalent) pass on the wizard, run console, and explorer with no
  new violations.
- Unvalidated state styled as unknown (neutral), not success.
- Reduced-motion guards on every animation introduced since the wizard review; grep
  documented in the PR.
- Tests updated where copy assertions change; suite green.

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
Use effort: medium.
```

### Stage W4.6 — Shell hardening: error boundaries, auth consistency, mobile read-only

*Resolves FUNC P2-9, P2-11, P2-12; UX F-P2-2. Files: new `+error.svelte` boundaries,
`+layout.server.ts:60-71`, `+layout.svelte:158-173`.*

> **Re-scope note (R1, 2026-06-12 — see `docs/design/keys-northstar-redesign-2026-06.md` §4.1):**
> W4.6 **split.** The stage is now two halves:
> - **Half A (fire any time, unaffected by Wave R):** Error boundaries (`+error.svelte`) and auth
>   redirect consistency (P2-9, P2-11, P2-12). These are IA-agnostic and remain in W4.6.
>   "Back to Overview" in the error boundary copy should use "Back to Home" once R3 lands
>   (update in R3 or W4.6 — first one in wins).
> - **Half B (mobile read-only tier): folds into R6.** The mobile read-only tier is a shell-level
>   concern best shipped with the rest of the R6 shell upgrade (live-run chip + dossier rail).
>   R6 will open `/home`, `/runs/[id]`, and `/claims` read-only (D10 approved: Home, run console,
>   Claims read-only). W4.6's mobile half (UX F-P2-2) is absorbed by R6 and need not fire
>   separately. If W4.6 fires before R6, implement the error boundary + auth half only; leave the
>   mobile gate for R6.

> **Re-scope note (post-Wave-R re-baseline, 2026-06-12):** **Half B shipped via R6 (#280).** The
> mobile read-only tier is live: `isMobileAllowedPath` (`lib/dashboard-mobile-tier.ts`) opens
> `/home`, `/runs/[id]`, and `/claims`, and `+layout.svelte` applies `.shell-mobile-readonly`. R6
> follow-up **#281** is in flight to make `/claims` genuinely read-only on that tier (the last
> mile of F-P2-2). **Half A is still un-shipped** and remains W4.6's scope: dashboard-scoped
> `+error.svelte` boundaries and the one-unauthenticated-behavior redirect matrix (P2-9, P2-11,
> P2-12). One copy fix: the error-boundary "Back to Overview" link should say **"Back to Home"**
> and target `/home` (R3 retired Overview) — `HOME_HREF` in `nav-config.ts`.

```
ROLE
Senior engineer hardening the shell around everything the programme built.

TARGET
A dashboard-scoped error boundary; ONE unauthenticated behavior for all routes; the
mobile gate opens for read-only operator surfaces.

FIRST
- docs/reviews/dashboard-functionality-review-2026-06.md P2-9 (zero +error.svelte
  anywhere; bare unstyled 404), P2-11 (only /projects|/healthcheck|/billing|/settings|
  /sandbox|/cli|/admin redirect to login at +layout.server.ts:60-71; everything else
  renders the welcome panel in place — the review recommends redirect with ?redirect=
  for all), P2-12 + UX F-P2-2 (the hard mobile gate at +layout.svelte:158-173; the run
  console and runs list are the two screens worth opening first; UX adds the scorecard).

ACCEPTANCE CRITERIA
- /keys/dashboard/+error.svelte (and /keys/admin equivalent): brutal-styled, shows
  status + safe message, "Back to Overview" + "Report" links; a thrown load error
  anywhere under the dashboard renders it (test via a route that throws in dev).
- Unauthenticated: all dashboard routes redirect to login with ?redirect= back-target;
  the welcome-panel-in-place behavior removed; signed-out deep links round-trip to
  their target after login (test).
- Mobile: read-only run console, runs list, and trust ledger render through the gate
  (responsive enough to read, actions may hide); everything else keeps the gate with
  honest copy. prefers-reduced-motion and touch targets respected on what opens.
- ux-contracts updated (§1/§3) to record the chosen auth behavior; tests for the
  redirect matrix.

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
PR: phone-width screenshots of the three opened surfaces; redirect matrix table.
Use effort: high.
```

### Stage W4.7 — Hygiene: orphans, prototype route, analytics mock, fresh-clone DX

*Resolves FUNC P2-3, P2-4, P2-6, P2-8, P2-10, P1-2 (orphaned components); UX IA-7.*

> **Re-scope note (post-Wave-R re-baseline, 2026-06-12):** Wave R already cleared several items —
> re-scope the residual:
> - **`/connect/ingest/new` (P2-3, IA-7): DONE.** R2/D8 deleted the 631-line standalone job form;
>   the URL 308-redirects to `/sources/ingest?step=launch` (legacy map). No action left.
> - **`/prototype/brutalist-dashboard` (P2-8): GONE** — no `prototype` route exists in the current
>   tree. Verify nothing re-introduced it; otherwise close this item.
> - **Orphaned components (P1-2 tail):** re-scoped — `QuickActions.svelte` is now **mounted** (route
>   builder `projects/[id]/routes/[routeId]/+page.svelte`), so it is no longer orphaned. Still
>   orphaned and needing a mount-or-delete decision: **`FirstRunOnboarding.svelte`** and
>   **`SetupChecklist.svelte`** (both in `lib/components/dashboard/`).
> - **Analytics mock (P2-6):** `/analytics` unchanged path — target intact.
> - **Connection detail (P2-4):** `/integrations/[id]` unchanged path — target intact (also K6's
>   rotation surface).
> - **Fresh-clone DX (P2-10):** unaffected by Wave R.

```
ROLE
Engineer clearing the debt list so it stops accreting.

TARGET
Orphaned surfaces deleted or re-linked; the analytics mock honest; fresh clones test
green; connection credentials rotatable.

FIRST / ACCEPTANCE CRITERIA (one item each)
- /connect/ingest/new (631 lines, zero inbound links — FUNC P2-3, UX IA-7): DECIDE with
  a question to the owner if unclear — default to delete (the wizard owns run creation);
  if kept, link it as "Advanced run" from the Runs list and dedupe gating with the
  wizard.
- /prototype/brutalist-dashboard (FUNC P2-8): delete, or gate behind dev; it currently
  ships hardcoded fake metrics publicly (noindex'd).
- Orphaned components QuickActions / FirstRunOnboarding / SetupChecklist (FUNC P1-2
  tail): mount or delete each — state the decision per component in the PR.
- Analytics mock fallback (FUNC P2-6): default OFF in production
  (RESTORMEL_ANALYTICS_USE_MOCK_FALLBACK), keep the "Sample data" badge for explicit
  demo mode; error state per ux-contracts §3 when real data fails.
- Connection detail (FUNC P2-4): replace the "not yet wired" stub copy with an honest
  empty state; add re-enter-credential in place (rotation without losing bindings) —
  this touches encrypted credentials: restormel-high-risk-security pass required.
- Fresh-clone DX (FUNC P2-10): pretest hook building @restormel/* workspace packages
  (or vite aliases to package sources) so `vitest run src/lib` passes on a fresh
  checkout; verify by simulating (remove dist/, run).

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib
(fresh-checkout simulation quoted in the PR).
Use effort: high (breadth, not depth). STOP gates: the ingest/new decision and anything
touching credential storage.
```

---

## Wave R — North-star IA redesign

*Source: [`docs/design/keys-northstar-redesign-2026-06.md`](keys-northstar-redesign-2026-06.md) §5.
All ten product decisions D1–D10 approved 2026-06-12. Full stage prompts in the design doc.
This section records re-scope notes and living programme state.*

**Sequencing:** R1 → R2 → {R3, R4, R5} → R6; R7 is decision-gated (D4) and independent.
R1 (this re-baseline) is the only docs stage. R2–R7 are code stages; R2 is the highest-breadth
(route map change), R3–R5 rebuild pages, R6 upgrades the shell.

**W/K re-sequencing:** W4.4/W4.5 sweeps fire AFTER Wave R (they sweep every file; sweeping
pre-move geography wastes the pass — the decision from §4.1 of the redesign doc). W4.6's mobile
half folds into R6.

**Wave R status — all merged ✅ (2026-06-12).** R1–R7 shipped; the new IA geography is live and
is the baseline this roadmap now cites. The Connect hub is dissolved: every `/connect/*` URL
308-redirects via `apps/dashboard/src/lib/legacy-route-redirects.ts` (table source of truth) and
the catch-all at `connect/[...legacy]/+page.server.ts`; in-app links point at the new top-level
sections.

| Stage | Title | PR | Outcome (where it landed) |
|---|---|---|---|
| R1 | IA decision record + ux-contracts re-baseline v2 | #273 | `docs/design/keys-northstar-redesign-2026-06.md` (D1–D10) + `ux-contracts.md` v2 |
| R2 | Route migration, redirects, nav skeleton | #276 | New top-level routes + `legacy-route-redirects.ts` (308s) + `nav-config.ts` HOME/SOURCES/RUNS/CLAIMS/PROVE/AGENTS |
| R3 | One Home (merged `/home`) | #277 | `/home` masthead: capped `ConnectTrustScorecard` + `home/TrustSparkline.svelte`, `ConnectVerifiedReadiness` (K4 ledger), INBOX, RUNS RAIL, AGENT TRAFFIC; `/activity` + `/connect` MERGE-INTO `/home` |
| R4 | Sources section + wizard-as-flow | #279 | `/sources` (Packs) + `/sources/ingest` flow (provider→sources→domain→launch; store demoted to aside); `pipeline-config.ts` step model |
| R5 | Agents + Prove assembly, Foundation rehoming | #278 | `/agents/{wiring,catalogs}`, `/prove/{proof,traces,audit,share}`, `/routes/ingestion`; `/connect/mcp`→Agents, `/dev-tools/*`→Catalogs, `/connect/proof/*`→Prove, `/access/audit`→`/prove/audit`, `/connect/models`→`/routes/ingestion` |
| R6 | Shell v2: live-run chip, dossier rail, mobile tier | #280 | `LiveRunChip` in `+layout.svelte` (30s poll via `stores/live-run-poll.ts` — the W3.1 SSE swap point), `DossierRail` + `RunQuickPeek` (first consumer on `/runs`), mobile read-only tier (`dashboard-mobile-tier.ts`, `.shell-mobile-readonly`) |
| R7 | Workspace infrastructure project (D4) | #274 | Auto-provisioned Workspace infrastructure routing project |

**R6 follow-up in flight:** PR #281 (`fix(dashboard): R6 follow-up — make /claims genuinely
read-only on the mobile tier`) tightens mobile read-only completeness — OPEN at re-baseline time.

> **Roadmap changelog (R1, 2026-06-12):**
> - Re-scope notes added to W2.3, W3.6, W4.6 per redesign §4.1 (above in their stage sections).
> - Wave K section added below (K stages were in the KEYS review; now in the living roadmap).
> - Wave R sequencing table rows added above.
> - `ux-contracts.md` §1 + §2 + §A updated (see R1 changelog entry there).
> - Source: `docs/design/keys-northstar-redesign-2026-06.md`

> **Roadmap changelog (post-Wave-R re-baseline, 2026-06-12):**
> - **Trigger:** Wave R (R1–R7) complete and merged (#273 #276 #277 #279 #278 #280 #274); the
>   re-baseline cadence in Operating notes requires refreshing drifted citations after a batch.
> - **Refreshed:** every un-shipped stage prompt's route/file/component citations to the new IA
>   geography — un-shipped W2.5, W3.1, W3.2, W3.3, W3.5, W3.6, W3.7, W4.1–W4.7, and the Wave K
>   table/K-stage notes. Routes moved (`/connect/*` → top-level sections); **components and
>   `/api/connect/*` endpoints did NOT move** — `ConnectIngestRunConsole.svelte`,
>   `ConnectGraphExplorer.svelte`, `ConnectTrustScorecard.svelte`, `ProvenanceDrawer.svelte`,
>   `api/connect/graph/units/+server.ts`, `api/connect/ingest/jobs/+server.ts` keep their paths,
>   so component-level citations stayed valid and were left intact.
> - **Marked merged:** W2.2 (#263), W2.3 (#270), W2.4 (#258), W2.6 (#257), W3.4 (#256),
>   W3.8 (#255), K2 (#261), K3 (#272), K4 (#275); W3.4's cross-link wiring and W2.3's
>   single-source rule now exist in code; W3.1's chip-transport consumer exists in
>   `stores/live-run-poll.ts` (the designated SSE swap point).
> - **Re-scope notes added** under stages whose mount target moved with Wave R (see each stage).
> - **Review docs stay frozen as evidence** — only this living roadmap was edited.
> - Source: this PR.

---

## Wave K — Keys⇄Connect seam

*Source: [`docs/reviews/keys-core-journey-review-2026-06.md`](../reviews/keys-core-journey-review-2026-06.md) §4.
Full stage prompts live in that review doc (frozen evidence); this section is the living
programme entry with re-scope notes applied by R1.*

Stage prompts are in the review doc. Dependency order: **K2 → K3 → K4 → K5 → K6**; K1 amends W3.7. K2/K3 may fire in the same batch (disjoint files); K4 needs K3; K5 is independent of K4; K6 needs K1 + K2.

| Stage | Title | Resolves | Depends on | Status |
|---|---|---|---|---|
| K1 | Gateway-key metadata contract | K-P1-1 (labels + last_used); N+1 fix | — (folds into W3.7) | Staged |
| K2 | Real provider verification + capability honesty | K-P0-1, K-P1-3 | — | ✅ merged (#261) |
| K3 | Connect run preflight: bindings, fix-forward errors | K-P0-2, K-P2-1 | K2 (soft) | ✅ merged (#272) |
| K4 | "Ready to verify": Connect readiness hub | K-P1-5/6/7, §3 coherence thesis | K3, W1.5 merged | ✅ merged (#275) — now `/home` masthead, see re-scope note |
| K5 | Run attribution: which route served this run | K-P1-4, BP-11/12 | — | Staged |
| K6 | Rotation: credentials and gateway keys | K-P1-2, FUNC P2-4 | K1, K2 | Staged |

### Stage K4 — "Ready to verify": the Connect readiness hub

*See `docs/reviews/keys-core-journey-review-2026-06.md` §4 for the full stage prompt.*

> **Re-scope note (R1, 2026-06-12 — see `docs/design/keys-northstar-redesign-2026-06.md` §4.1):**
> K4 **survives, elevated.** The readiness ledger becomes the **Home masthead's left panel**
> (`/home` §3.3 wireframe, "READY TO VERIFY" quadrant) instead of "a panel on the Connect hub".
> The three original mounts from the review (hub panel, project-page card, Overview checklist chip)
> are superseded by **one mount: Home masthead**.
>
> **Shipped state (post-Wave-R re-baseline, 2026-06-12):** K4 merged (#275) and rebased onto R3.
> The ledger is live as the masthead left quadrant — `ConnectVerifiedReadiness.svelte` mounted in
> `routes/keys/dashboard/home/+page.svelte` (READY TO VERIFY cell), fed by
> `lib/server/connect/verified-readiness.ts` (rows `{id, status, evidence, fixHref}`). The
> project-page card and Overview checklist chip were correctly **not** built. The `?step=store`
> fix link now targets `/sources/ingest?step=store` (R4's flow geography).
>
> Original conditional guidance (now resolved by R3+R4 landing; retained for the audit trail):
> - The server module (rows `{id, status, evidence, fixHref}`) is unchanged — build it as spec'd.
> - If K4 fires **before** R3: mount on the current `/connect` hub as a ledger panel (the interim
>   mount); R3 relocates to `/home` without rebuilding the component.
> - If K4 fires **after** R3: mount directly on `/home` (the masthead left quadrant).
> - The project-page card mount and the Overview checklist chip mount in the original spec are
>   superseded — do not build them; they were always workarounds for the two-homes problem that R3
>   resolves with one Home. The single mount at Home is cleaner and cheaper.
> - The `?step=store` fix link updates to `/sources/ingest?step=store` once R4 lands; use the
>   current `/connect/pipeline?step=store` path until R4 merges (the redirect handles it).

---

## Operating notes

- **One stage per agent run; batches per the table.** Within a batch, PRs merge in any
  order; a batch fully merges before the next fires. W4.4/W4.5 run alone, last — they
  sweep every earlier stage's files.
- **Re-baseline cadence.** Re-baseline this document after: (1) the **B1 batch** merges
  (W2.1's URL contract and W1.1's registry change what every later prompt cites);
  (2) **W2.2 + W2.3** merge (the dossier and single-score rule are referenced by W2.5,
  W2.6, W3.4, W4.1–W4.3 — confirm the shipped shapes before firing those); (3) **W3.1**
  merges or STOPs (its SSE-vs-polling outcome decides W4.1's data source and W3.3's live
  tail). At each re-baseline, refresh file:line citations that drifted — the review docs
  stay frozen as evidence; this roadmap is the living document.
- **The claims-ledger rule is standing** (protocol item 7): UI copy asserting verification
  quality cites proven rows of
  [`verified-context-claims-ledger.md`](../product/verified-context-claims-ledger.md); evidence
  surfaces meet the falsifiability test. If the weekly efficacy run flips a row to
  **broken**, dependent dashboard copy is treated as broken too (same rule as marketing).
- **Where F8/F9 land:** both resolve in **W3.1** (SSE + the F8 fallback fix list:
  conditional COUNT, jittered 2.5–3s polling, workspace cache). If W3.1's STOP gate fires
  on platform SSE limits, ship the F8 polling fixes immediately as the degraded outcome
  and re-plan SSE for the Coolify target (per the infra-migration memory). F9 (runs
  sharing the interactive instance) is mitigated by durable runs (pivot 1.6) and the
  cron-drain design; the full worker split is an infra-stage decision outside this
  roadmap — flag it when the Coolify Stage 2 work begins.
  *(Post-Wave-R note, 2026-06-12: the F8 poll diet has already partly landed — the run
  console now polls at 2.5s jittered with conditional COUNT (`ConnectIngestRunConsole.svelte`),
  and the R6 live-run chip uses a 30s ambient poll (`stores/live-run-poll.ts`, the SSE swap
  point). W3.1's remaining work is the SSE channel + keyset pagination; the SSE precedent now
  lives at `prove/api/stream/+server.ts`.)*
- **Open production items (owner-held, not agent stages):**
  - **CI secrets for the weekly efficacy run** — `connect-efficacy-weekly.yml` needs the
    cross-model provider keys provisioned as CI secrets; until then claims-ledger row 6's
    "continuously enforced" status is at risk (rule 3: a non-running gate cannot keep a
    row proven indefinitely).
  - **MCP catalog submissions** — prepared in-repo (pivot Stage 4.2, PR #232), awaiting
    the product owner's external submissions.
  - **Issue #234** — incremental re-ingest mid-source stall can mark partial extraction
    'unchanged'. Engine-side fix; **W3.6 depends on its semantics** and carries an
    explicit guard so the re-ingest UI never launders the stale 'unchanged' state.
- **Backlog noted, deliberately not staged:** workspace webhooks management UI (FUNC §3 —
  API + docs exist; stage it when webhooks get product pull), multi-user workspaces (FUNC
  §4 gap 8's "eventually"), the public scorecard share view if W4.3's STOP gate defers it,
  and `/keys/dashboard/lifecycle` / `/graph` stub pages (honest placeholders; staged when
  their products are).
- **Dogfood loop:** every stage that touches run/verification surfaces keeps its copy
  truthful to the engine by citing the implementing file (the run console's stall copy
  cites `ingest-full-runner.ts`; the dossier's guards cite `evidence-persist.ts` and the
  EBV ADR). When engine semantics change, grep this roadmap and the shipped copy together.
