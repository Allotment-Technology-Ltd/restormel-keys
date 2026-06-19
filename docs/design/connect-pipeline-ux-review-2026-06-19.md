---
title: Connect knowledge-pipeline — end-to-end UX review & simplification proposal
class: technical
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-19
last-reviewed: 2026-06-19
review-interval: P12M
---

# Connect knowledge-pipeline — end-to-end UX review & simplification proposal

**Status:** REVIEW + PROPOSAL for product-owner decision. **No code was changed.** This is a
direction-setting document: read §4 (proposed flow) and §5 (phased plan), then pick a scope.

**The founder's verdict, verbatim:** *"overly complicated"* and *"not intuitive what a user is
supposed to be doing, when."*

**One-line diagnosis.** The Connect pipeline is not missing capability — it is missing a
**spine**. Today it is a set of competent but *independent* surfaces (a setup wizard, a run
console, a graph explorer with three tabs and a hidden readiness wizard, a graph library, an
ingest-routes page, a route builder) stitched together by deep-links. There is no single
authoritative "where am I / what's next" model. The user is asked to *infer* the journey from a
scatter of buttons that are all visible at once, several of which **silently no-op** when their
preconditions aren't met. The known symptoms (ghost run, silent validate/embed, "new run"
resuming) are all the same root cause: **the UI shows actions, not state**, so the system's
preconditions live in the user's head instead of on the screen.

**Scope note.** This extends, and does not duplicate, the two prior wizard reviews
(`docs/reviews/connect-wizard-ux-review.md`, `connect-wizard-ux-findings.md`), which audited only
the **setup wizard** (provider → sources → domain → launch). Those findings stand. This review
covers the part those reviews explicitly left out: the **post-launch journey** — run console →
graph explorer (validate / link / re-import / embed) → readiness runs → publish/route-binding —
which is where the founder's symptoms actually live.

---

## 1. The actual end-to-end journey, mapped

The journey crosses **five distinct top-level surfaces** at five different URLs, with no
persistent progress spine connecting them. Below is every distinct user action, what it does, the
state it changes, and the order the UI implies.

### Surface map (the five places a user must move between)

| # | Surface (as the user sees it) | URL | Role in the journey |
|---|---|---|---|
| A | **Connect hub / Home** masthead + setup ledger | `/keys/dashboard/home` | "Where am I" entry; setup steps + readiness ledger. `ConnectSetupLedger`, `connect-hub-load.ts` |
| B | **Ingest** guided flow (the setup wizard) | `/keys/dashboard/sources/ingest?step=…` | provider → sources → domain → **launch**. `ConnectPipelineWizard` + step panels |
| C | **Ingest run console** | `/keys/dashboard/runs/<jobId>` | live stage progress for one run; success banner + "what next" CTAs. `ConnectIngestRunConsole` |
| D | **Claims** graph explorer | `/keys/dashboard/claims` | validate / link / re-import / embed / triage / readiness runs. `ConnectGraphExplorer` (6,765 lines) |
| E | **Ingest routes** + **Route builder** | `/keys/dashboard/routes/ingestion`, `…/projects/<id>/routes/<id>` | bind models to stages, publish routes. `routes/ingestion/+page.svelte`, route detail |
| (F) | **Graph library** | rendered on `/keys/dashboard/sources` | add / activate / test / delete graph stores. `ConnectGraphLibrary`, `ConnectGraphSwitcher` |

The naming itself signals the fracture: the same domain object is called **"Connect"**,
**"Ingest"**, **"Claims"**, **"Graph"**, and **"Pipeline"** depending on which surface you're on
(see §3, terminology).

### The implied step order, action by action

```
STAGE 0  SET UP THE STORE & MODELS (surface F + B)
  · Add / activate a graph store          ConnectGraphLibrary → POST graph-library/<id>/activate
  · Add a provider key (verified on save) wizard step "provider"
  · Publish chat + embedding routes       routes/ingestion → route builder (see Stage 5)

STAGE 1  INGEST (surface B → C)
  · Connect sources, check documents      wizard step "sources"  → persistSelection PUT
  · Choose / design a domain pack         wizard step "domain"
  · Review & launch                       wizard step "launch" → POST ingest/jobs
  · Watch the run                         run console (SSE), stage odometer
  · On completion: "View graph →" / "New run →"   CTAs to /claims or back to launch

STAGE 2  MAKE THE GRAPH "READY" (surface D — Claims explorer, "Tools & glossary" tab)
  Three explorer tabs: [Triage ideas] [Clusters] [Tools & glossary]
  The readiness work hides INSIDE the Tools tab as a 4-step sub-wizard:
    Catalog  → Scan/Import sources       POST graph/sources
    Link     → "Find sources for ideas"  POST graph/link-sources   (binds units → source text)
    Embed    → "Start embed backfill"    POST graph/embed          (vectorises units)
    Validate → "Validate unchecked ideas" POST graph/revalidate    (LLM verdicts ok/weak/unsupp.)
  Plus, above it, the Readiness Library: create a "run" = a cohort of the next N unchecked ideas
    Create run                            POST graph/readiness/runs
  Plus Auto-remediation (fix quarantined / unsupported) and per-claim Triage (A/W/U keys).

STAGE 3  PUBLISH / GO LIVE (surface E)
  · Activate the graph in the library     (one active graph per workspace)
  · Bind models to each ingestion stage   route builder
  · Save route metadata (workload/stage)  PATCH routes/<id>            ← save #1
  · Apply step/model edits to the flow    PUT routes/<id>/graph + step PATCHes ← save #2
  · Publish the route version             POST routes/<id>/publish     ← save #3 (+ confirm)
  · Repeat for every stage that isn't "Ready"
```

**Crucial structural fact:** the order above is *implied by names and blockers*, never *enforced
or shown as one journey*. Stages 1, 2 and 3 live on three different URLs with no shared progress
indicator. A user who finishes Stage 1 lands in the run console with a "View graph →" button; on
`/claims` they meet three tabs and must *discover* that the real "make it ready" work is buried in
the third tab's sub-wizard; and nothing on `/claims` links them onward to Stage 3 (publish).

### What each post-ingest action actually changes (the data model under the UI)

| Action (UI label) | Endpoint | State changed |
|---|---|---|
| Create readiness run | `POST graph/readiness/runs` | `knowledge_readiness_run` + `_run_units` (stamps a cohort of next-N unchecked unit ids) |
| Find sources for ideas (Link) | `POST graph/link-sources` | unit `source` edge/field (Postgres `source_id`; Surreal `source`) |
| Start embed backfill (Embed) | `POST graph/embed` | unit `embedding` vector |
| Validate unchecked ideas | `POST graph/revalidate` | unit `validation_status` / `validation_note` |
| Auto-remediate | `POST graph/revalidate` (mode `remediate`) | repaired/dropped units + re-embed |
| Triage verdict (A/W/U) | `PATCH graph/units/<id>/validation` | one unit's `validation_status` (optimistic + rollback) |
| Activate graph | `POST graph-library/<id>/activate` | `is_active` flag (one active store per workspace) |
| Apply recommended routes | `POST pipeline/apply-recommended-routes` | route steps + publishes versions + `provider_bindings` + `connect_stage_routing_config` |
| Publish route | `POST routes/<id>/publish` | `publishedVersion` = `version` (route goes live) |

---

## 2. The mental-model gap

**What a first-time founder/user thinks they are doing:**

> "I point Connect at my documents, it builds a knowledge graph, I check it looks right, and I
> turn it on so my app/agent can use it. One thing, start to finish."

**What the system actually requires:**

> Provision a store **and** publish chat+embedding routes (two different surfaces) **before** the
> wizard will let a run finish; then run an ingest; then move to a *different* screen and find a
> *third-level* sub-wizard to **link → embed → validate** the graph (each a separate job with its
> own options that must finish loading before the button works); optionally scope all of that to a
> **"readiness run" cohort**; then triage flagged claims by hand; then move to *yet another* screen
> and perform a **three-save** route-publish per stage to make any of it live.

The gap is not that the steps are wrong — each exists for a real reason. The gap is that **the user
is never told this is the shape of the journey, never shown where they are in it, and is given
buttons that look interchangeable when they are actually sequential and precondition-gated.**

Concretely, the model breaks in four ways:

1. **"Ready" is invisible and overloaded.** There are at least four different "ready/active/publish"
   concepts — graph-store *active*, models *ready*, route *published*, graph *validated/ready* — and
   they use overlapping words (§3). A user cannot answer "is my graph live yet?" from any single
   screen. The hub's readiness ledger (`ConnectVerifiedReadiness`) is the closest thing to a spine,
   but it lives only on Home and doesn't span into the explorer or route builder.

2. **Everything is available at once, so nothing reads as "next".** The explorer's Tools tab shows
   Catalog / Link / Embed / Validate buttons simultaneously, gated by computed `…Complete` blockers
   (`graphReadinessBlockers`, `ConnectGraphExplorer.svelte:1162`). But the *blockers* are advisory
   text, not a guided one-primary-action-at-a-time flow. The user sees four buttons and guesses.

3. **Buttons lie about availability.** Several actions are clickable but no-op until async *options*
   finish loading (Link, Embed) — see §3/pain-point 2. A button you can press that does nothing is
   the single most corrosive thing for "what am I supposed to do."

4. **Redundant + sequential saves read as redundant.** Publishing one stage's route takes three
   distinct saves on two tabs (Setup → Flow "Apply" → Versions "Publish") with a scary confirm,
   then must be **repeated per stage**. The user reasonably expects "set it, then turn it on."

---

## 3. Concrete pain points (with pointers), tied into systemic problems

> Severity: **P1** = directly causes the founder's "what do I do" confusion or silent data risk;
> **P2** = significant friction; **P3** = polish. File paths under
> `apps/dashboard/src/`. The two prior wizard findings docs cover the wizard panels; these are
> *new* findings on the post-ingest journey unless noted.

### P1 — The "ghost" readiness run is now a *presentation* bug (the server was already fixed)

The server is correct: `readiness-runs-service.ts:36-38` **pre-resolves** the cohort *before*
inserting the run ("a resolution failure then surfaces as an error instead of leaving behind a
misleading empty run"), and the route returns a **warning** when the cohort is empty
(`…/readiness/runs/+server.ts:65-74`: *"No unchecked ideas were available… the graph may be fully
validated already."*).

The client throws that away. `ConnectGraphExplorer.svelte:503-532` (`createReadinessRun`):

```ts
if (typeof body.warning === "string") runsError = body.warning;
await loadReadinessRuns();
if (body.run?.id && (body.run.sizeActual ?? 0) > 0) {
  activeRunId = body.run.id;
  scrollToGraphReadinessWizard();
}
// ← when sizeActual === 0: the empty run is STILL created + listed, not auto-selected,
//    and the only feedback is the warning string buried in `runsError`.
```

So on a fully-validated graph, pressing "New run" **creates a real, inert "Run N" row** that the
user can select but that drives nothing. **Systemic problem:** the UI offers "create a run" as an
always-available primary action even when the precondition (unchecked ideas exist) is false. The
fix is not server-side — it's to *not offer*, or to *block-with-explanation*, a run when
`unchecked === 0`, and to never leave a 0-size run in the list.

### P1 — Validate / Link / Embed silently no-op until options load (and on slow/failed loads)

The Tools sub-wizard's options are fetched lazily with a 25s timeout
(`ConnectGraphExplorer.svelte:554` `TOOLS_OPTIONS_TIMEOUT_MS`, `ensureToolsOptions` ~`:598-670`).
On timeout the `catch` is swallowed and panels render *without* options. Then:

- **Link** (`startSourceLinking`, `:2226-2241`): `if (!linkSourcesOptions) { linkSourcesError = "…still loading…"; return; }` — early return; the only signal is a small error string the user may not be looking at.
- **Embed** (`startEmbedBackfill`, `:2485-2486`): `if (!embedOptions?.enabled || !embedOptions.health.actionNeeded || embeddingBackfill) return;` — a **fully silent** early return: no error, no toast, nothing. The button appears pressable and does nothing.

**Systemic problem:** the button's *enabled* state and its *will-actually-work* state are
decoupled. A button must be disabled (with an honest reason) whenever it cannot act — never
clickable-but-inert. This is the literal mechanism behind "it's not intuitive what to do."

### P1 — "New run →" resumes the previous run instead of starting fresh

The run console's completion CTA is `<a href={pipelineWizardHref("launch")}>New run →</a>`
(`ConnectIngestRunConsole.svelte:837`). That lands the user **on the final `launch` step**, and the
launch step's `runDefaults` are derived from the workspace's *persisted* selection —
`selectedDomainPackId` and `ingestDocumentSelection` (`sources/ingest/+page.server.ts:281-292`,
`resolveRunDefaults(...)`). So "New run" pre-fills the previous run's documents + pack and skips
straight to launch. It *feels* like resuming the last run, not starting a new one.

This is defensible as a convenience (re-run the same corpus), but it is **mislabelled**: "New run"
should mean "choose what to ingest." If the intent is "re-run the same thing," the CTA should say
**"Re-run this corpus →"** and the genuinely-new path should start at `sources`, not `launch`.

### P1 — Three-save, per-stage route publish with no "what next" hand-off

To make a graph usable, each ingestion stage's route must be published, and publishing is three
saves across two tabs (Setup metadata → Flow "Apply to server" → Versions "Publish" + confirm:
`routes/<id>` PATCH, `routes/<id>/graph` PUT, `routes/<id>/publish` POST). After "Apply to server"
the route is still a draft with **no affordance pointing to Versions/Publish** — the user is left at
"I applied changes, now what?" And this repeats for grouping / validation / embedding stages.

There **is** a one-click escape hatch — **Apply recommended routes**
(`apply-recommended-routes.ts`: builds a production chain, publishes every stage, ensures bindings)
— but it's framed as a scary "Reset to Recommended" overwrite
(`routes/ingestion/+page.svelte` confirm), so users avoid the very thing that would save them.

**Systemic problem:** the publish model exposes its internal route-versioning machinery (draft →
apply → publish, per route) as the *primary* user path, when 95% of users want "use the recommended
production setup." The advanced path should be opt-in, not the default surface.

### P2 — The post-ingest journey is hidden three levels deep, with no spine

The actual "make your graph ready" work (link/embed/validate) is: **Claims page → "Tools &
glossary" tab → readiness sub-wizard**. Two of three tabs (Triage, Clusters) are *consumption*
views; the *production* steps hide in the third. Nothing on `/claims` indicates that Tools is where
the journey continues, and nothing links onward to publish. `ConnectGraphReadinessWizard.svelte` is
1,898 lines doing the heavy lifting, but it is reached only by exploration.

### P2 — Cohort scope is a hidden global mode

Selecting a readiness run sets `activeRunId`, which silently scopes *all* subsequent link/embed/
validate/auto-remediate calls to that cohort (the `cohort_run_id` is threaded into every POST:
`ConnectGraphExplorer.svelte:2243,2486,…`). A user who selected "Run 1 · 100 ideas" earlier and
forgot will later wonder why "Validate" only touched 100 of 5,000 ideas. The active cohort needs a
persistent, unmissable banner ("You are operating on Run 1 — 100 ideas. [Switch to whole
workspace]").

### P2 — Re-import / re-ingest has two names and no first-class entry

"Re-ingest" (coach copy) and "re-import" (schema repair) refer to re-running ingestion, but there's
no clear single "re-import this source" action in the explorer — the user falls back to the wizard
launch path (the same one mislabelled "New run"). Incremental re-ingest exists server-side
(`incremental-reingest.ts`) but isn't surfaced as a clean explorer affordance.

### P2 — Optimistic verdicts flip back on failure

Triage verdicts apply optimistically then `revertReviewOptimistic` on server rejection
(`ConnectGraphExplorer.svelte:2139-2184`). On a flaky network the user sees a verdict accept, then
silently revert with a delayed error — undermining trust during the most hands-on task.

### P3 — Terminology sprawl (the copy-registry gap, extended)

One object, many names. This is a top-3 driver of "not intuitive":

| Concept | Names in the wild |
|---|---|
| The product/area | Connect, Ingest, Claims, Pipeline, Graph |
| A claim | idea (UI), unit (code/API), claim (stamping desk/evidence) |
| Make a store the default | "Activate" (library) — collides with "publish" mentally |
| Make a route live | "Publish" |
| Make the graph usable | (no single word) — "ready", "validated", blockers cleared |
| Bind unit→source | "Link sources" / "Find sources for ideas" (two labels, one action) |
| Re-run ingestion | "re-ingest" / "re-import" / "New run" |

`docs/design/ux-contracts.md` already mandates a canonical-noun registry; the Connect post-ingest
nouns are not in it. (Prior finding N11 flagged the wizard side; this extends it to the explorer +
library + route builder.)

---

## 4. Proposed simplified flow (the intuitive target)

**Design principle:** *one spine, one primary action per stage, state always visible, no
clickable-inert buttons, advanced machinery opt-in.* Keep it neo-brutalist (hard-bordered stage
ledger, mono stage labels, single yellow primary CTA per stage) and **honest about what is built**
— nearly everything below already exists on the backend; this is mostly re-presentation.

### The spine: a five-stage "Build your verified graph" ledger

A single persistent component (extend the existing `ConnectVerifiedReadiness` / setup-ledger model,
which already computes most of this) shown at the top of **every** Connect surface, with the
*current* stage highlighted and exactly one primary CTA:

```
①  CONNECT      store + provider + routes      [done]      ── reuses connect-hub-load setupHealth
②  INGEST       run on your documents          [done]      ── wizard + run console
③  MAKE READY   link · embed · validate        [▢ do this] ── the Tools sub-wizard, promoted
④  REVIEW       triage flagged claims          [12 left]   ── Triage tab
⑤  GO LIVE      publish routes for your app    [▢]         ── one-click recommended publish
```

Each tile is a link to where the work happens; the ledger is the missing "where am I / what's
next." The stage states come from data already loaded: `setupHealth`, `graphReadinessBlockers`,
quarantine counts, route `modelsReady`.

### Stage-by-stage redesign

**① Connect & ② Ingest** — largely keep the current wizard + run console (the prior wizard reviews'
fixes apply). One change: rename the run-console completion CTAs honestly —
**"Re-run this corpus →"** (current behaviour, lands on launch with prefilled selection) and
**"Ingest different documents →"** (starts at `sources`). The ambiguous "New run →" goes away.

**③ Make ready** — promote the Tools sub-wizard out of the third explorer tab into its own
**"Make ready"** view reached directly from the run-console success CTA and the spine. Present it as
a **linear checklist with one active step at a time**, driven by the existing blockers:

```
MAKE YOUR GRAPH READY                                   [whole workspace ▾]   ← cohort selector, visible
■ Link ideas to their sources          1,204 of 1,204 linked      ✓ done
■ Embed ideas for retrieval            1,204 of 1,204 embedded    ✓ done
□ Validate unchecked ideas             842 unchecked              ▸ VALIDATE 842   ← single primary CTA
  Clusters / Catalog details under a `<details>` (progressive disclosure)
```

Rules that kill the silent-no-op class:
- A stage's CTA is **disabled with a visible reason** until its options resolve ("Loading
  options…") and disabled with a reason when there's nothing to do ("All ideas already embedded").
  Never clickable-inert. (Fixes the Link/Embed early-returns.)
- **Readiness runs become an explicit, optional "spot-check first" affordance**, not an
  always-present "create run" button: only offered when there *are* unchecked ideas; when the graph
  is fully validated, the control shows "Graph fully validated — nothing to cohort" instead of
  minting a ghost run. The active cohort is shown as a persistent banner. (Fixes the ghost run +
  hidden-scope findings.)

**④ Review** — the existing Triage tab, reached from the spine when quarantine > 0. Make optimistic
verdicts resilient (queue + retry, or confirm-on-success) so they don't flip back.

**⑤ Go live** — make **"Use recommended production setup"** (the existing
`apply-recommended-routes`) the **primary** path: one button, one confirm, publishes every stage
and ensures bindings. Reframe it from a destructive "Reset to Recommended" into the happy path
("Publish recommended routes — extraction, grouping, validation, remediation, embedding"). The
manual per-stage Setup→Flow→Versions three-save path stays for power users behind an "Advanced:
configure routes individually" disclosure. After any apply, the spine flips ⑤ to "Live" and shows
the graph endpoint / how to consume it.

### What maps to existing backend (reuse) vs needs change

| Need | Status |
|---|---|
| Stage states for the spine | **Reuse** — `connect-hub-load.ts`, `verified-readiness.ts`, `graphReadinessBlockers` |
| Link / Embed / Validate jobs | **Reuse** — services + endpoints unchanged |
| Cohort runs | **Reuse** service; **change** client to gate creation + show active-cohort banner |
| Ghost-run warning | **Reuse** server warning; **change** client to honour it (don't create/list 0-size run) |
| One-click publish | **Reuse** `apply-recommended-routes`; **change** framing to primary CTA |
| Honest button states | **Change** — disable-with-reason; never silent early-return |
| The spine ledger | **Build** — but from a component pattern that already exists (the setup ledger) |
| Promote Tools→"Make ready" view | **Refactor** — lift `ConnectGraphReadinessWizard` out of the explorer tab |

No backend rewrite is required. The risk-bearing behaviours a naive rebuild would drop (and that
must be preserved): URL-driven wizard step state + server store-gate, `invalidate` keys, lazy-import
await states, SSE resume in the run console, cohort membership stamping, optimistic-verdict
rollback, the as-of time-travel read-only mode, and the K3 launch preflight.

---

## 5. Phased redesign recommendation (smallest-first)

Three tiers so the founder can pick scope. Each tier is shippable on its own and de-risks the next.

### Phase 1 — Tactical fixes (days; mostly client-side; low risk)

Stop the bleeding — kill the silent/ghost/mislabel class without restructuring anything.

1. **Ghost run:** in `createReadinessRun` (`ConnectGraphExplorer.svelte:503-532`), when
   `sizeActual === 0`, do **not** add the run to the visible list; render the server warning as a
   first-class notice, and disable the "New run" control when `unchecked === 0` with a reason.
2. **Silent Embed/Link:** make `startEmbedBackfill`/`startSourceLinking` early-returns set a visible
   error, and **disable the buttons** while `…Options` are null/loading with a `title` reason.
   Surface the `ensureToolsOptions` timeout (`:554-670`) as a retry, not a swallowed catch.
3. **"New run" relabel:** split the run-console CTA (`ConnectIngestRunConsole.svelte:837`) into
   "Re-run this corpus →" (launch, prefilled) and "Ingest different documents →" (`sources`).
4. **Active-cohort banner:** when `activeRunId` is set, show a persistent "operating on Run N" strip
   with a "switch to whole workspace" action.
5. **One canonical-noun pass:** "idea" vs "unit" vs "claim"; "Link sources" single label; add these
   to `ux-contracts.md`. Plus the standing prior-review wizard fixes (N1-N13) that are still open.

*Outcome:* nothing is clickable-inert, no ghost runs, "new run" is honest, scope is visible. This
alone removes most of the "what am I supposed to do" friction at near-zero structural risk.

### Phase 2 — Medium refactor (1-2 weeks; the spine + one-click publish)

Give the journey a visible backbone.

6. **Build the five-stage spine ledger** (Connect / Ingest / Make ready / Review / Go live) from the
   existing readiness compute, shown across Connect surfaces with one primary CTA per stage.
7. **Promote "Make ready"**: lift the Tools sub-wizard into its own linear, one-active-step view,
   reached from the run-console success state and the spine; demote Catalog/Clusters detail behind
   progressive disclosure.
8. **Make one-click publish the primary "Go live"** path; move the manual three-save route flow
   behind an "Advanced" disclosure. Add a "what next" hand-off after every stage completes.

*Outcome:* a user can follow the journey top-to-bottom without inferring it. This is the
highest-leverage change for the founder's specific complaint.

### Phase 3 — Larger redesign (3-4 weeks; only if Phase 2 isn't enough)

9. **Decompose `ConnectGraphExplorer.svelte` (6,765 lines)** behind the existing route into
   explorer (Triage/Clusters), a standalone "Make ready" flow, and a readiness-runs panel — each
   testable, each owning one message-area contract. (Mirrors the prior review's UX2 decomposition
   recommendation for the 1,143-line domain panel; this is the bigger sibling.)
10. **Unify the route-publish model** so "make my graph live" is genuinely one action end-to-end
    (graph activate + stage routes published + binding confirmed) with the per-stage machinery fully
    internal. This is the only item that touches the publish backend shape and should be scoped
    against `apply-recommended-routes` + `graph-target` + route versioning carefully.

*Outcome:* maintainability + a single "go live" primitive. Defer unless Phases 1-2 leave residual
confusion.

---

## 6. Recommendation

Do **Phase 1 now** (it directly neutralises the three named symptoms and the silent-no-op class for
days of work and almost no risk), then commit to **Phase 2** as the real answer to "not intuitive
what to do, when" — the five-stage spine is the missing piece. Treat **Phase 3** as conditional.
The backend is in good shape; the problem is presentation and journey, which is exactly where the
cheapest wins are.

---

### Appendix — primary code references

- Hub / spine source: `apps/dashboard/src/lib/server/connect/connect-hub-load.ts`,
  `…/verified-readiness.ts`, `…/components/connect/ConnectSetupLedger.svelte`,
  `ConnectVerifiedReadiness.svelte`
- Setup wizard: `…/components/connect/pipeline/ConnectPipelineWizard.svelte`,
  `…/lib/connect/pipeline-config.ts`, `…/routes/keys/dashboard/sources/ingest/+page.server.ts`
- Run console: `…/components/connect/pipeline/ConnectIngestRunConsole.svelte` (CTAs `:815-837`)
- Graph explorer: `…/components/connect/ConnectGraphExplorer.svelte`
  (readiness run `:503-532`; link `:2226-2275`; embed `:2485-2523`; options `:554-670`;
  blockers `:1162`)
- Readiness sub-wizard / library: `…/components/connect/ConnectGraphReadinessWizard.svelte`,
  `ConnectReadinessLibrary.svelte`
- Readiness services: `…/server/connect/readiness-runs-service.ts`,
  `…/routes/keys/dashboard/api/connect/graph/readiness/runs/+server.ts`
- Stage services: `graph-source-link-service.ts`, `graph-embed-backfill-service.ts`,
  `graph-revalidate-service.ts` (+ `-options` / `-guards`)
- Publish: `…/server/connect/apply-recommended-routes.ts`,
  `…/routes/keys/dashboard/routes/ingestion/+page.svelte`, route detail + `routes/<id>/publish`,
  `…/projects/[id]/routes/[routeId]/validate-binding/+server.ts`
- Graph library / target: `ConnectGraphLibrary.svelte`, `graph-target/*` endpoints,
  `graph-library/[id]/activate/+server.ts`
- Prior context (still valid): `docs/reviews/connect-wizard-ux-review.md`,
  `docs/reviews/connect-wizard-ux-findings.md`, `docs/reviews/connect-ingest-context.md`,
  contracts in `docs/design/ux-contracts.md`
