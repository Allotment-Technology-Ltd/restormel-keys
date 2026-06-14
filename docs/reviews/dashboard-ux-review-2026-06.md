---
title: Dashboard UX review — June 2026
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-11
last-reviewed: 2026-06-13
review-interval: P12M
---

# Dashboard UX review — June 2026

**Scope.** Every authenticated surface under `/keys/dashboard/**`, the `/keys/admin` consoles, and
the full ingest experience (setup wizard, run console, progress, quality surfaces). Graded against
`docs/design/ux-contracts.md` (state model, copy registry, nav model), the Neo-Brutalist system
(`.claude/skills/restormel-neu-brutalist-ui/SKILL.md`, `docs/design/design-system-index.md`,
`docs/design/COMPONENT-INVENTORY.md`), and the prior wizard review
(`docs/reviews/connect-wizard-ux-review.md` / `connect-wizard-ux-findings.md`, fixed in PR #190 —
re-audited below). Review only; no code changed.

**Rendered pass.** Dev server boots; signed-out shells for `/connect`, `/connect/pipeline?step=*`,
`/connect/ingest`, `/connect/graph`, `/activity`, `/login` all SSR 200 (`/keys/admin/*` 302s to
auth, as designed). Authenticated surfaces were reviewed at code level (markup, classes, copy);
nothing below is fabricated from an unreachable render.

**Verdict in one line.** The week's verification surfaces (trust scorecard, quality history,
launch forecast) are the best-disciplined components in the product — but they hang off a chrome
that still can't sign out, a runs surface that deletes without confirmation, a run console whose
"Restart run" button doesn't exist, and a verification spine that stops one hop short of the
actual evidence. Fix the five P0s and the skeleton of a world-class product is already here.

---

## 1. IA map — what's actually navigable vs the contract

### Actual tree (from `apps/dashboard/src/lib/nav-config.ts` + `dashboard-hub-nav.ts`)

```
/keys/dashboard  → 302 → /activity
│
├─ Sidebar · Work            Overview (/activity) · Connect (/connect) · Testing (/testing)
├─ Sidebar · Configure ▸     Connections · Gateway keys · Routes · Guard rails · Model catalog
├─ Sidebar · Monitor ▸       Usage · Logs · Health           (coming-soon placeholder when flag off)
├─ Sidebar · More ▸          Try a request · CLI & agents · Graph
│
├─ Connect hub tabs          Home · Library · Ingest routes · Setup · Runs · Graph · Proof · Agents
│   ├─ Home (/connect)           ledger (pulse + journey) + TRUST SCORECARD + QUALITY HISTORY
│   ├─ Setup (/connect/pipeline) 4-step wizard: store → domain → sources → launch
│   ├─ Runs (/connect/ingest)    runs list → run console (/ingest/[jobId])
│   ├─ Graph (/connect/graph)    explorer: triage queue · tools · READINESS LIBRARY (buried inside)
│   └─ Proof (/connect/proof)    graph-vs-baseline comparison + provenance drawer
│
├─ ORPHANED (exists, zero inbound nav links)
│   ├─ /settings  "Profile & settings"     ├─ /billing  "Subscription & Billing"
│   ├─ /logout    (only reachable from an auth-error banner)
│   ├─ /connect/ingest/new   legacy run-start form duplicating the wizard
│   └─ /projects, /lifecycle, /access/audit  (reachable only via in-page links / flags)
│
└─ /keys/admin (separate shell)   Founders Circle · User management · Package registry ·
                                  Quality gates · Ingest quality   [← Connect hub backlink only]
```

### The gaps

| # | Gap | Evidence |
|---|---|---|
| IA-1 | **No account menu.** ux-contracts §2 mandates "Avatar opens a menu with Profile & settings, Subscription, and Sign out." The topbar renders title + two help links only. Settings, Billing, and **Sign out** are unreachable. | `apps/dashboard/src/routes/keys/dashboard/+layout.svelte:268-299`; `nav-config.ts:48-81` (no settings/billing/logout items); only inbound `/logout` link is the expired-session error at `+layout.svelte:306` |
| IA-2 | **The contract itself is stale.** ux-contracts §1 describes sidebar groups "Set Up (… Rules, Guard Rails …), Monitor, Advanced (… Test & Preview, GitHub Setup …) plus Overview and Profile". The shipped IA is Work / Configure / Monitor / More, with Connect — the product's centre — absent from the contract entirely. The law no longer matches the building, so new surfaces can't be graded against it. | `docs/design/ux-contracts.md:34` vs `nav-config.ts:34-81` |
| IA-3 | **Two competing "homes".** Login lands on Overview (`/activity`) whose checklist is 100% Keys-routing (project → connection → gateway key → route → request → logs) and never mentions the graph, trust, or verification. The Connect hub calls itself "Your workspace home". The product's headline (verified context) is invisible on the actual landing page. | `+page.server.ts:7` (redirect), `activity/+page.svelte:81-89` (checklist), `connect/+page.svelte:33` ("Your workspace home") |
| IA-4 | **Verification spine discoverability.** Clicks from login to "why is this claim trusted": Overview → Connect (1) → scroll past ledger to scorecard → "Triage flagged ideas" (2) → select a claim (3) → … and the journey ends at a status badge + AI note. The evidence span — the actual *why* — is never shown (see P0-5). The spine is 3 clicks deep and the last vertebra is missing. | route walk; `ConnectGraphExplorer.svelte:2357-2403` |
| IA-5 | **New surfaces cohere unevenly.** Trust scorecard + quality history sit naturally on the hub (good). Readiness library is buried ~2,750 lines inside the graph explorer with no tab or nav entry of its own. Ingest-quality admin lives in a separate `/keys/admin` shell whose only crosslink is "← Connect hub" — fine for operators, but the operator gets no path *into* admin from the dashboard. Graph explorer itself is one 4,877-line component serving triage, tools, schema mapping, and readiness. | `ConnectGraphExplorer.svelte:2751`; `keys/admin/+layout.svelte:63` |
| IA-6 | **Dead deep-link contract.** Four surfaces link to `/connect/graph?filter=review` (scorecard, run console ×2, graph-health issues) but neither the graph page nor the explorer reads a `filter` param — only `workspace` and `focus` are parsed. It works today by coincidence (the queue defaults to review scope); the moment that default changes, every quality CTA silently rots. | `ConnectTrustScorecard.svelte:164`, `ConnectIngestRunConsole.svelte:345,406`, `graph-health-summary.ts:54` vs `ConnectGraphExplorer.svelte:632,660` |
| IA-7 | **Orphan run-start.** `/connect/ingest/new` is a parallel "create run" form (URLs, pasted text, profiles, stop-after-stage) with zero inbound links, duplicating the wizard's launch step with different gating. Delete or merge. | `connect/ingest/new/+page.svelte` (no references found outside the route) |
| IA-8 | **Topbar title holes.** `/billing` has no `PATH_TO_TITLE` entry (blank topbar). Hub tab says "Ingest routes", topbar says "Connect · Models", the registry says the page is "Models & keys" — three names for one page. | `nav-config.ts:137-157`; `dashboard-hub-nav.ts:15`; `docs/design/ux-contracts.md` ("Models & keys") |

---

## 2. Findings — grouped by journey

Severity: **P0** = user-stranding or trust-destroying; **P1** = clearly sub-world-class;
**P2** = polish. Every finding cites file:line + the contract it violates + a concrete fix.

### Journey A — being signed in at all (chrome, account, recovery)

**A-P0-1 · You cannot sign out, see your plan, or open settings.**
`+layout.svelte:268-299` renders the topbar with no account affordance; `nav-config.ts` has no
settings/billing/logout entries; `/settings` and `/billing` pages exist (`settings/+page.svelte:8`,
`billing/+page.svelte:16`) but are orphaned. Violates ux-contracts §2 ("Signed-in account menu:
Avatar opens a menu with 'Profile & settings', 'Subscription', and 'Sign out'") and strands users
on shared machines with no way to end a session.
**Fix:** Add the avatar menu to the topbar (right of the help links): Profile & settings →
`/settings`, Subscription → `/billing`, Sign out → `/logout` (with `data-sveltekit-reload`). One
component, three links, contract closed.

**A-P1-1 · Eight "Sign in to …" notices have no sign-in action.**
`connect/+page.svelte:46`, `connect/proof/+page.svelte:23`, `connect/graph/+page.svelte:63`,
`connect/mcp/+page.svelte:18`, `connect/library/+page.svelte:22`, `connect/models/+page.svelte:276`,
`connect/ingest/+page.svelte:40`, `connect/ingest/new/+page.svelte:85`. All are message-only —
ux-contracts §3 requires a recovery action ("Sign in" link) on every such state. PR #190 fixed
exactly this in the wizard (`ConnectPipelineWizard.svelte:168-171` now has the Sign in button);
the other eight surfaces still predate that standard.
**Fix:** Shared `<SignInNotice>` (message + `btn btn-primary` → `/keys/dashboard/login`), swap in
on all eight.

**A-P1-2 · Panel-load failures say "Refresh to try again" with nothing to press.**
Hub `connect/+page.svelte:123-125`, MCP `connect/mcp/+page.svelte:22-24`, Proof
`connect/proof/+page.svelte:35-37` catch blocks render a bare `<p role="alert">`. The trust
scorecard and quality history on the *same hub page* do this right (`BrutalErrorBanner` + working
"Try again" via `invalidateAll()`, `ConnectTrustScorecard.svelte:175-186`).
**Fix:** Reuse the scorecard's retry pattern (banner + `invalidateAll()` button) in the three
catch blocks.

**A-P1-3 · Internal ops copy leaks into user-facing errors.**
Overview: `{data.projectsError}. Check Vercel logs for database errors.`
(`activity/+page.svelte:148`) — customers don't have Vercel. Connect hub: a `role="status"`
warn-banner names `RESTORMEL_CREDENTIALS_ENCRYPTION_KEY` and `apps/dashboard/.env.local`
(`connect/+page.svelte:82-91`) — correct for self-hosters, wrong for cloud users, and it's a
warning announced politely as a status.
**Fix:** Generic copy + "Try again" for users; gate the env-var banner on a self-host/dev flag and
mark it `role="alert"` when it actually blocks saving keys.

**A-P2-1 · Welcome checklist's "Sign in with GitHub" is bold text, not a link**
(`+layout.svelte:317`); the only sign-in affordance is the marketing header. Make step 1 a link to
`/keys/dashboard/login`.

### Journey B — first ingest (wizard → launch → 10-minute run)

*Wizard re-audit:* PR #190 landed cleanly. Verified in code: honest stepper (`completedIds` from
real progress, `ConnectPipelineWizard.svelte:56-67`), `loadFailed` vs signed-out split with
recovery actions (`:157-172`), template param stripped after consumption (`:136-142`),
launch-panel-bound START RUN gate (`:115,263`), `BrutalLoadingState`/`BrutalErrorBanner` on lazy
panels (`:218-275`), reduced-motion guard (`:71-75`), quality forecast + chunk-based estimates
(`ConnectPipelineReviewLaunch.svelte:120-130,247-299`). Still open from that review: UX2
(`ConnectDomainPacksPanel` now 1,159 lines) and N8 (66 `1px solid` borders remain across Connect
surfaces). Two carried-over paper cuts: disabled-footer `title` hints are still invisible to
keyboard/SR users (`:294,306,319,332` — pair with `aria-describedby` text), and "START RUN →" is
still the only all-caps CTA.

**B-P0-1 · The run console's "Restart run" button does not exist.**
`ConnectIngestRunConsole.svelte` computes `canRestart` (`:114-117`), `runAgainLabel` (`:119-122`)
and defines `restartJob()` (`:168-197`) — **none of which are rendered**. No restart/run-again
button appears anywhere in the template; the only action is the buried "Cancel run" link
(`:583-589`). Worse, the preview-run banner explicitly instructs "Use **Restart run** or start a
new run" (`:366-372`) — directing users at a control that isn't on the page. A failed run shows
`job.error` as a bare red `<p>` (`:439-441`) with no recovery action at all: the user must know to
navigate back to the Runs list to find Restart. Violates ux-contracts §3 (every error needs a
recovery action) and is a textbook stranding.
**Fix:** Render the button in `run-head` (`.run-actions` CSS already exists at `:608`):
`{runAgainLabel}` when `canRestart`, plus a "View runs" outline link. Wrap `job.error` in
`BrutalErrorBanner` with Restart + "Check pipeline setup" actions.

**B-P0-2 · A frozen run is indistinguishable from a healthy one.**
Stage 1.6 shipped durable runs — lease/heartbeat, stale-run reclaim, checkpointed resume
(`ingest-full-runner.ts:246,880`) — but the console surfaces none of it. The ingest progress panel
(`ConnectIngestRunConsole.svelte:453-482`) shows percent + pulsing "In progress" with no
last-activity readout, no stall state, no reclaim/resume messaging. Meanwhile the *graph-repair*
panel already solves this (`ConnectGraphRepairProgress.svelte:61-64,148` — `isStale` after
inactivity, `role="status"` stall notice). During the 10-minute first run — the moment the user is
most anxious — a freeze looks identical to progress until they read raw log lines. When the
reclaim cron resumes the run, the percent just moves again with no explanation.
**Fix:** Lift the repair panel's staleness model into the main progress panel: "Last activity 12s
ago" mono line; after ~90s an amber stall block — "No worker heartbeat for 2m. Stalled runs are
reclaimed automatically and resume from the last checkpoint — nothing is lost." When a resume is
detected (status log already carries it), show a "Resumed from checkpoint after a stall" notice.
This is also a *trust* feature: the product that verifies claims should narrate its own recovery.

**B-P1-1 · Completed-run "What to do next" duplicates and competes.**
On completion the console can stack: success banner with 2 links (`:339-364`) + quality scorecard
(`:375-397`) + a numbered "What to do next" with 3 CTAs (`:399-437`) — up to three blocks
repeating "view graph / set up agent". The skill's anti-pattern list literally names this
("Duplicate status blocks — merge into one ledger").
**Fix:** One completion ledger: verdict cap (trust score + supported %) above a single
next-actions body; drop the separate success banner for the default case.

**B-P1-2 · Console load/loading states are bare text.**
`Loading run console…` plain `<p>` (`:283-284`), `Job not found.` / HTTP errors as plain
`run-error` text with no action (`:285-286`, `loadLive:205-212`). Adjacent pages use
`BrutalLoadingState`/`EmptyState`.
**Fix:** `BrutalLoadingState` for load; "Job not found" → `EmptyState` with "View all runs" CTA;
transient status-poll failures should show a retrying notice rather than swapping the whole
console to an error paragraph.

**B-P2-1 · Estimated-calls floor maths is still naive** (`max(chunks×2, docs×4)`,
`ConnectPipelineReviewLaunch.svelte:123`) and the "~3–8 min" band reappears for ≤30 chunks
regardless of model latency. Fine as a floor; label it "floor estimate" or derive from recent run
durations (the data exists in quality history).

### Journey C — returning operator (runs list, re-ingest, review queue)

**C-P0-1 · Destructive actions on the runs list fire with zero confirmation.**
`connect/ingest/+page.svelte:89-106` — per-run **Delete** sends `DELETE` immediately on click; it
is the *only* destructive control in the dashboard without a `confirm()` (access, projects,
routes, policies, integrations all confirm). `bulkClean()` (`:123-146`) cancels **running** jobs
and deletes failed/cancelled/stuck ones in one unconfirmed click. Direct violation of ux-contracts
§3 ("Destructive actions: Require explicit user confirmation before execution").
**Fix:** `confirm()` (or a brutal modal) on both; bulk copy must state the blast radius: "Cancel 1
running run and delete 4 finished runs? Run history and quality reports for them are removed."

**C-P0-2 · A healthy in-flight run is counted as "stuck".**
`stuckCount` includes every `running` and `pending` job (`connect/ingest/+page.svelte:31`), so the
moment you start a run, a red **"Clear stuck & failed (1)"** danger button appears — inviting the
operator to kill their own healthy run and implying the product thinks it's broken. Combined with
C-P0-1 this is a one-click data-loss path sitting next to the Refresh button during every run.
**Fix:** Count only genuinely stale runs (no heartbeat for > lease window — the durable-runs
plumbing knows this) or at minimum exclude `running`/`pending` younger than the stale threshold;
label it "Clean up old runs".

**C-P1-1 · The runs surface speaks the wrong language and the wrong idiom.**
Title "Ingest jobs", `<title>` "Knowledge ingest jobs", lede "…ingestion jobs. Each job…"
(`:150,157-158`) — the copy registry mandates **Ingest run** ("Not 'job' or 'import' in UI
copy"); the hub tab above it says "Runs". Status badges render raw lowercase enum values
(`{job.status}`, `:219`) instead of `ingestStatusLabel`. Cards are soft (1px borders +
`--rm-radius`, `:343-352`) beside the brutal run console one click deeper.
**Fix:** Rename page + copy to "Ingest runs"; reuse `ingestStatusLabel`; restyle rows as brutal
ledger rows. Also: data loads client-side `onMount` (`:33-57`) — move to a server `load` for
SSR + the shared skeleton.

**C-P1-2 · Re-ingest has no first-class entry.**
The wizard's operational phase exists (`phase: "operational"`, repeat-run kicker), but from the
hub the returning operator's path to "re-ingest the changed docs" is Setup → walk 4 steps. The
new incremental re-ingest capability (Stage 3.2) is invisible: nothing says "2 sources changed
since the last run". The BYO opt-in promises "Re-ingesting a changed source will update only that
source's claims" (`ConnectGraphStorePanel.svelte:670-675`) but no surface ever shows
changed-source state or a "Re-ingest changed" action.
**Fix:** On the hub run-chip / Runs list header, surface "N sources changed since last run →
Re-ingest" linking to launch with the changed set preselected.

**C-P1-3 · The review queue exists but is hidden behind a coincidence.**
The triage UX for review-state claims is real and decent (queue scope, verdict filters, coaching,
guidance, pagination — `ConnectGraphExplorer.svelte:1024-1030,2297-2330`), but: (a) every inbound
"quarantine queue" link relies on the unimplemented `?filter=review` (IA-6); (b) there's no badge
count on the Graph tab, so an operator with 40 unverified claims sees no pull anywhere in the
chrome; (c) there is no deep link to a *specific* claim (`?unit=` unsupported), so the proof
drawer, quality history, and MCP answers can't point at the claim they cite.
**Fix:** Implement `filter`/`unit` URL params in the explorer (init `queueScope`/`verdictFilter`/
selection from URL); add a review-count badge to the Graph hub tab fed by the hub stats already
loaded.

**C-P2-1 · `?filter=review` should select scope *and* communicate it** — when arriving via a
quality CTA, show a dismissible "Showing N flagged ideas from your trust scorecard" context line
so the operator knows why the list is filtered.

### Journey D — the verification spine (scorecard, history, proof, claim level)

**D-P0-1 · "Why is this claim trusted?" has no answer at the claim level.**
The pipeline persists per-claim evidence quotes and verification states (EBV Layer 1/2 —
`evidence-persist.ts:23-51` binds each stored unit's evidence quote; the claim-versions
migrations version them). The scorecard sells it: "ideas carry a **re-checkable source span**"
(`ConnectTrustScorecard.svelte:97`). But the explorer's `Unit` type carries no evidence field, and
the claim detail panel (`ConnectGraphExplorer.svelte:2357-2403`) shows only status badge +
author/source/kind + an AI note. The user can see *that* a claim is "Supported", never *by what*.
The product's headline interaction — claim → evidence span → source — does not exist in the UI.
The proof drawer (`ProvenanceDrawer.svelte:32-46`) gets closest (claim text + SUPPORTED/WEAK +
trust) yet shows no quote and links nowhere.
**Fix:** Plumb `evidence_quote` (+ binding status, validated_at) through
`/api/connect/graph/units` into the detail panel; render it as a first-class "Evidence" block
(see Signature §3.1). Link proof-drawer claims to `graph?unit=<id>`.

**D-P1-1 · Two different trust scores on one page.**
The hub renders the setup ledger's "Graph pulse" trust score — kg-audit formula
(`graph-health-summary.ts:20,105` via `buildAuditSummary`) — and, directly below, the trust
scorecard's score — factor-breakdown formula (`trust-scorecard-service.ts:132`). Different
formulas, different freshness (pulse derives from latest-run stats; scorecard reads the store
live). When they disagree — e.g. after a triage session updates states the run report doesn't know
about — the product whose pitch is *trust* shows two conflicting trust numbers with no
explanation. The skill names this anti-pattern ("Duplicate status blocks … merge into one
ledger").
**Fix:** One number. Make the scorecard service the single source; the ledger pulse should quote
it (and the run console's post-run "Trust score" should label itself "this run's audit" if it
must differ). Footnote the formula once.

**D-P1-2 · Scorecard dead-ends and unbound metrics.**
"Last verified: Never — run validation" (`ConnectTrustScorecard.svelte:88`) names an action with
no control — link it to the explorer's revalidate tool. "Coverage gaps … re-test the graph store
connection" (`:131-134`) has no link to `pipeline?step=store`. Factor rows in "What lowered this
score" aren't actionable per-factor (only one generic triage link, `:163-165`) — each factor
should deep-link to its filtered queue (needs C-P1-3's URL params).

**D-P1-3 · Quality history entries are terminal.**
Each verdict row shows G2/trust/gaps + reasons (`ConnectQualityHistory.svelte:88-133`) but links
nowhere — no run console link for `ingest_run` sources, no diff detail, no commit/CI run for
`ci_action`. A regression event is precisely when the operator needs "what regressed → show me
those claims", and the panel can't take them there. Also `aria-label="Eval verdict history"` is
jargon; and the 20-entry list has no trend visual (five PASS rows read as noise, a 20-point
sparkline reads as a story).
**Fix:** Link entries to their run/CI source; render a small trust/G2 sparkline header; keep
reasons as the expandable detail.

**D-P1-4 · Undefined "tint" tokens with double-duty fallbacks.**
`--color-green-tint` / `--color-red-tint` / `--color-yellow-tint` are defined nowhere in
`@restormel/keys-tokens` or app CSS — every use rides the hex fallback. Worse, the same token is
used as a pale *background* (`#fde8e8`, `ConnectTrustScorecard.svelte:262`) and as a *border/text*
color (`#e53935` border `ConnectQualityHistory.svelte:189`; `#c62828` text `:265`). If anyone ever
defines `--color-red-tint` (as a tint, per the name), regression-note text becomes pale-pink on
white — invisible. Same pattern in `graph-comparison/QualityDelta.svelte`-adjacent styles.
**Fix:** Add real tokens (`--state-ok-bg/-fg`, `--state-fail-bg/-fg`, `--state-warn-bg/-fg`) to
the token package; replace all tint fallbacks. This is the one place the new panels broke token
discipline.

**D-P2-1 · PASS/FAIL/REGRESSION chips are color+text (good) but the left-border severity rail is
color-only** (`ConnectQualityHistory.svelte:184-195`) — add a glyph (■/□/▲) for the rail.
**D-P2-2 · Scorecard/history put recovery buttons *outside* `BrutalErrorBanner`** instead of its
`actions` snippet (`ConnectTrustScorecard.svelte:175-186`; the component documents "Always render
at least one recovery action via the `actions` slot") — cosmetic, but it splits the error from
its remedy in the a11y tree.

### Journey E — store step & BYO opt-in (Stage 3.2b re-audit)

**E-P1-1 · The claim-versions opt-in is invisible to the primary path.**
The toggle lives only inside the `showAdvanced` manual-fields form
(`ConnectGraphStorePanel.svelte:619,650-693`). The promoted quick-connect path (paste connection
string → Connect) never reveals it, so the user most likely to want incremental re-ingest never
sees the offer; the excellent consent copy ("additive-only… REMOVE TABLE to revoke… degrades to
full ingest with an operator warning") goes unread.
**Fix:** After a successful save/connect (either path), render the opt-in as its own card in the
connected-state summary, not as a form footnote behind "Enter fields manually".

**E-P1-2 · The toggle's accessible name is "On"/"Off".**
The checkbox's label content is a decorative track + `sr-only` text that only says the *state*
(`:653-662`); the actual purpose ("Allow Restormel to manage claim versions…") is a sibling
paragraph not associated with the input. SR users hear "checkbox, On".
**Fix:** `aria-labelledby="vt-heading"` (or move the descriptive sentence inside the label) +
`aria-describedby` pointing at the explanation paragraphs; keep the sr-only state text as a
suffix.

**E-P2-1 · Saving the toggle requires resubmitting the whole store form** ("Save graph store"),
which re-validates endpoint fields — for an already-connected target a dedicated "Save preference"
affordance (or auto-save with status line) would match the toggle idiom users expect.

### Journey F — consistency, design system, a11y (cross-cutting)

**F-P1-1 · Two header dialects.** Connect pages use display-hero H1s (uppercase Barlow,
`--text-display-hero` — `connect/+page.svelte:144-153`, `library/+page.svelte:45-54`) while Keys
pages use quiet `.page-title` (`access/+page.svelte:143`, etc.), each redefining the class
locally. `BrutalPageHeader` — the contract's named primitive — is used exactly once in the entire
app (`ConnectGraphExplorer.svelte`). Pick one (the brutal header), ship it as the shared
component, delete ~10 local `.page-title` style blocks.

**F-P1-2 · N8 confirmed and still open: 66 `1px solid` borders across Connect surfaces** (grep,
components + routes) against the 2px micro-border floor; plus soft `--rm-radius` cards on operator
surfaces the skill explicitly bans (hub outcomes `connect/+page.svelte:173-181`, runs list rows,
library notice). One mechanical pass: `1px solid var(--rm-border)` → `var(--border-thin)`, radius
→ 0 on Connect operator surfaces.

**F-P1-3 · Copy registry drift roll-up.** "Ingest jobs"/"job" (C-P1-1); tab "Ingest routes" vs
registry "Models & keys" vs topbar "Connect · Models" (IA-8); "Connect a Provider" H1 under nav
"Connections" (`integrations/+page.svelte:176`) — registry term is "Provider integration" managed
under "Connections"; "Usage & Analytics" H1 vs nav "Usage" (`analytics/+page.svelte:123`). None
fatal individually; together they erode the "same words everywhere" contract.

**F-P2-1 · a11y paper cuts.** Disabled wizard CTAs rely on `title` only (B carry-over);
`aria-label="Eval verdict history"` jargon (D-P1-3); validation pill for *unvalidated* uses the
`-ok` class (`ConnectSetupLedger.svelte:252` — unknown styled as success); run-status pulse and
`.run-starting` animations don't respect `prefers-reduced-motion` (wizard scroll does —
`ConnectIngestRunConsole.svelte:716-746`); log screen `aria-live="polite"` on a 600-line stream is
correct, but the collapsed state loses the live region entirely while running (it can't collapse
while running — fine — document it).

**F-P2-2 · Desktop-first mobile gate** (`+layout.svelte:158-173`) hard-blocks phones from *all*
dashboard content, including read-only surfaces like run status. A running ingest is exactly what
someone checks from a phone. Allow read-only run console + scorecard through the gate.

---

## 3. Signature experience — five proposals

The system already has a voice: drafting-paper canvas, ink borders, stamps, ledgers, a CRT log.
The verification product story ("we can prove every claim") and the neo-brutalist visual story
("industrial honesty, receipts not vibes") are the *same story*. Lean in:

### 3.1 The Evidence Dossier — claim-level "why is this trusted"
The claim detail panel becomes a **dossier**: at top, the verdict as a physical **rubber stamp**
(uppercase mono, 2px ink frame, 1.5° rotation, coral for CONTRADICTED, ink-on-yellow for
SUPPORTED) with the validated-at date in the stamp ring. Below it, the **evidence block**: the
extractor's bound quote rendered as an offset-shadow excerpt card — source title as the cap
stripe, the span highlighted in yellow within surrounding context, "open source ↗" on the stripe.
Under that, a mono **chain-of-custody line**: `SOURCE → SPAN → CLAIM → JUDGE (model id) → STATE`,
each hop hoverable. One button: **"Re-check now"** — re-runs span entailment for this claim and
animates the stamp re-striking. Claim versions (Stage 3.2) appear as a `<details>` ledger:
"superseded 2 May — text changed in source". This single panel converts the product's thesis into
a feel-able interaction, and every piece of data already exists server-side (D-P0-1 is the only
plumbing gap).

### 3.2 The Machine Room — a run console that narrates its own survival
The 10-minute wait becomes the product demo. Keep the CRT log; add a **heartbeat strip** above it:
a mono tick-line (`▮▮▮▮▯…`) that advances with each poll, "LAST WORKER SIGNAL 4s AGO". Stage
odometer per pipeline stage (extracted 412 / validated 367 / quarantined 9) counting up live —
numbers, not just percent. When the heartbeat stops: the strip turns amber, stamps **STALLED**,
and prints the durable-runs contract in plain words: "Lease expires in 40s. A stalled run is
reclaimed and resumes from checkpoint 6/9 — nothing is lost." On resume, a green ledger line:
"RECLAIMED · resumed from checkpoint after 2m 10s". Failure gets the same honesty: the error
stamp, the failed stage, and one primary **Restart from checkpoint** button (fixes B-P0-1/2 as a
designed moment, not a patch).

### 3.3 One Trust Ledger — a single number with a paper trail
Merge the hub's "Graph pulse" trust readout and the trust scorecard into **one cap+body ledger**
(the skill's canonical layout): neon cap = the score as a 4-rem stamped numeral + G2 bar chip +
"last verified" + sparkline of the last 20 verdicts (absorbing quality history's headline);
white body = factor rails where **every row is a receipt** — `−6.2 pts · Evidence binding · 41
unbound → [Show the 41]` deep-linking into the filtered queue. Everything else in the product
*quotes* this ledger (launch forecast, run completion, proof drawer, MCP scorecard endpoint) so
the number is always the same number. Resolves D-P1-1/D-P1-2 and gives the hub a masthead.

### 3.4 The Stamping Desk — triage as a mechanical, keyboard-first loop
The review queue becomes an operator's desk: **J/K** moves through claims (the detail dossier
updates in place), **S** stamps Supported, **X** stamps Rejected, **E** opens evidence, **N**
writes a note — every stamp fires the system's 100ms mechanical press and prints a ledger line in
a session tally rail: "REVIEWED 14 · SUPPORTED 11 · REJECTED 3 · trust +2.1 this session". The
trust delta makes triage *feel* like raising the score (it literally is — the scorecard recomputes
from states). The coaching expander already provides "how to review this idea"; with evidence
inline (3.1) the operator never leaves home row. This is the retention loop for the returning
operator — the part of the product nobody else's RAG console has.

### 3.5 "Prove it" as a global gesture
One rule, everywhere: **any number or badge that asserts trust is a link to its evidence.**
Scorecard factors → filtered queue; "92% supported" on the launch forecast → last run's verdict
detail; proof-drawer claims → `graph?unit=<id>` dossier; quality-history REGRESSION → the diffed
claims; the MCP answer's verified-claim envelope → public scorecard URL. Implementation is mostly
the URL contract the explorer is missing (`filter`, `unit` params — C-P1-3). The neo-brutalist
treatment: such links get the dotted-underline + `↗` mono affordance, distinct from nav links —
users learn within minutes that *in Restormel, every claim opens its receipt*. That habit **is**
the brand.

---

## 4. Priority order (suggested)

1. **P0 batch (days):** account menu (A-P0-1) · runs-list confirms + stuck-count fix (C-P0-1/2) ·
   render Restart + error recovery on console (B-P0-1) · stall/reclaim surfacing (B-P0-2) ·
   evidence in claim detail (D-P0-1, plumbing + minimal block).
2. **P1 batch (1–2 weeks):** explorer URL contract + tab badge (C-P1-3, IA-6) · one trust source
   (D-P1-1) · sign-in/retry recovery sweep (A-P1-1/2) · runs-list language/idiom (C-P1-1) ·
   tint tokens (D-P1-4) · BYO toggle placement + name (E-P1-1/2) · ux-contracts nav-model rewrite
   (IA-2) so the next review has a true contract.
3. **Signature work:** 3.3 → 3.1 → 3.2 → 3.4 → 3.5 (each is independently shippable; 3.3 and 3.1
   carry the most product-story value per engineering day).

*Companion docs: the wizard-specific history lives in `connect-wizard-ux-findings.md`; component
inventory in `docs/design/COMPONENT-INVENTORY.md`. This review supersedes neither — it extends them to
the whole authenticated surface.*
