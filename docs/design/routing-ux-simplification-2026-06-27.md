---
title: "Routing UX simplification — recommended simple journey + rework spec (Pick & Live)"
class: technical
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-27
last-reviewed: 2026-06-27
review-interval: P6M
---

> Produced by a multi-agent Opus design swarm (4 concepts → judge panel → synthesis →
> adversarial critique → finalize), grounded in a 6-agent diagnosis of the live code +
> the founder's DevTools HAR. Recommended spine: **Pick & Live** (route born running,
> the flow canvas as the only surface, autosave-no-publish, hard ingestion/gateway split).
> Status: draft for founder review — not yet built.

ary

# Restormel Keys — Route UX Rework: "Pick & Live" (hardened, build-ready)

> A user's one intent — **point a route at a model and make it live** — becomes **one click to a live, serving route, zero commit clicks.** The flow canvas the founder loves becomes the *only* gateway surface. Connect ingestion gets its *own* canvas-free Stage Board. We delete far more than we add.

**Spine:** Pick & Live — the route that's born running.
**Grafts:** born-disabled new steps + an unmissable `LIVE · SAVED` pill + server-side validate-on-write (from LIVE CANVAS); a *hard, server-enforced* ingestion split + one-directional escape hatch (from TWO FRONT DOORS).
**Status of this revision:** every HIGH/MEDIUM critique finding has been folded in and re-verified against HEAD. Three load-bearing claims in the first draft did **not** survive contact with the code and are corrected below (bug #2 is already fixed; the autosave write endpoints carry the same bug; removing Publish must not trip the *runtime* `route_unpublished` gate).

---

## The Problem

The route editor mirrors the `route_steps` table instead of the task. A single intent is fragmented across **2 tabs, ~4 commit clicks, ~44 controls, 5 raw-JSON textareas, and a vestigial version gate.** Two unrelated save subsystems (route metadata vs steps) sit under a 3–4 stage manual commit pipeline: `Apply changes` (local overlay) → `Apply to server` → `Publish`. The **same 3,461-line editor** (`apps/dashboard/src/routes/keys/dashboard/projects/[id]/routes/[routeId]/+page.svelte` — note: now **3,461** lines, not the 2,300 cited in earlier notes) serves BOTH API-gateway routes AND Connect-ingestion stage routes — the "hybrid monster."

**Live HAR proof (founder session, route "Knowledge Validation", a Connect-ingestion stage route: `workload=ingestion`, `stage=ingestion_validation`):** a trivial 2-step *reorder* fired `4× PATCH /steps {orderIndex}` → `PUT /graph {edges,entryStepId}` ("Apply to server") → `POST /simulate` → `POST /publish` (v5 → v6) → `2× GET /history`. A full apply+simulate+publish ceremony **and a version bump**, on a route that was *already live and active*. Publish only bumps `version==publishedVersion` together — it is pure ceremony in normal use **at the editor layer**.

**A critical correction to "publish is pure ceremony":** at the *resolve* layer it is NOT ceremony. The runtime resolver fails closed when `version > publishedVersion`:
- `classifyRouteForExplicitId` (`route-resolver.ts:394`) returns `route_unpublished` for explicit-routeId resolves;
- `selectRouteForDiscovery` (`route-resolver.ts:417`) drops the route from ingestion discovery via the same `isRoutePublished` filter (`route-resolver.ts:275-279`, `version === publishedVersion`).
So Publish is what keeps `publishedVersion` in lockstep. **If our autosave ever writes the `version` column, every live gateway route AND every ingestion stage discovery goes dark while the UI says `LIVE · SAVED`.** The autosave safety model below makes "never write the version column" a hard, tested invariant.

**The two reported bugs — corrected against HEAD:**
- **Bug #1 (routes list shows "No providers configured yet" for routes that have steps) is real and has two compounding causes** — a missing `management_key` branch in the route-steps **read** endpoint *and* an SSR gap + a truthiness cache guard in the browser. Both are fixed below. The editor data path already works (the founder's editor loads the 2 steps fine), confirming this is a list-surface scoping/SSR bug, not missing data.
- **Bug #2 (validation always errors `route_not_found`) is NOT fixed by the originally-prescribed change.** `validate-binding/+server.ts:15-18` **already contains** the exact `management_key` branch the earlier draft proposed to add. Shipping it is a no-op. Bug #2 must be **re-reproduced against HEAD** with the founder's real auth path and the actual returned `reasons[]` before anything is "fixed" — see the bug section.

---

## The Simple Journey

### Gateway (Mara) — before: ~8–10 clicks / 4 commit clicks → after: **1 click, 0 commit clicks**

1. Click **ROUTES** (now a top-level nav item; one unified list; chains render server-side, no empty-state flash).
2. Click **[+ NEW ROUTE]** → a real, already-LIVE route is created on the opinionated production default and the canvas opens. Header: `LIVE · SAVED · resolves ✓`. **Done — it is serving.**
3. *(optional)* **[CHANGE MODEL]** → picker (recommended pre-highlighted) → **[USE THIS MODEL]** → autosaves.
4. *(optional)* **[+ ADD FALLBACK]** → the card appears **DISABLED until its model is confirmed**; drag to reorder → **one coalesced write** (the new order, nothing else).
5. Close the tab. It was serving the whole time.

> **Before (HAR):** one reorder = `PATCH×4 → PUT /graph → POST /simulate → POST /publish (v5→v6) → GET /history ×2`.
> **After:** one reorder = **exactly one** `PUT /graph`. Zero publish, zero history-on-write, validate runs async off the save path. A regression test asserts this.

### Ingestion (Priya) — before: first run gated behind creating/publishing up to 7 stage routes in the 2,300+-line editor → after: **fill + run, never the editor**

1. Connect Launch → 3-check preflight (Source / Credentials / Stage models).
2. **[REVIEW STAGE BOARD]** → a flat stage→model grid (no DAG, no fallback stepper, no reorder, no simulate, no publish, no version).
3. **[USE RECOMMENDED FOR ALL]** → one click fills every stage.
4. Any row change → one autosave PATCH. Reorder/publish are *not concepts here* — and the server **rejects** them on ingestion routes, so they cannot be reintroduced by accident.
5. **[RUN INGESTION]** → gated only on "every stage has a valid model."

---

## Screens

### 1 — ROUTES (unified list + inline create)
```
+======================================================+
|  ROUTES                                 [+ NEW ROUTE] |
+======================================================+
|  #### KNOWLEDGE VALIDATION              (*) LIVE      |
|  together / gpt-5.2  -->  claude-sonnet-4-6           |
|  2 steps . edited 4m ago                   [ EDIT ]   |
+------------------------------------------------------+
|  #### CHAT DEFAULT                      (*) LIVE      |
|  together / gpt-5.2                         [ EDIT ]  |
+------------------------------------------------------+
|  CONNECT INGESTION  -  7 stages routed . OK          |
|  [ OPEN STAGE BOARD -> ]      (canvas-free surface)   |
+======================================================+
```
*Server-side: ingestion stage-routes never appear in this list — the list is filtered by a server predicate (`workload != 'ingestion'`), not a client filter.*

### 2 — ROUTE CANVAS (one surface, autosave, no publish)
```
+======================================================+
| < ROUTES  [ KNOWLEDGE VALIDATION____ ] (*) LIVE-SAVED |
|                       autosaved . resolves [OK] [TEST]|
+======================================================+
|  FLOW                                                |
|   +==================+   together / gpt-5.2          |
|   | PRIMARY    [::]  |   [ CHANGE MODEL ]            |
|   +========+=========+                               |
|            | if it fails v                           |
|   +==================+   together / sonnet-4-6       |
|   | FALLBACK 1 [::]  |   [ CHANGE MODEL ]   [ X ]    |
|   +==================+                               |
|        [ + ADD FALLBACK ]   (born DISABLED until     |
|                              a model is confirmed)    |
|  --------------------------------------------------  |
|  > ADVANCED  (timeout, retries, cost) --- API only   |
|                                 history . rollback    |
| (no Apply changes / Apply to server / Publish / Save) |
+======================================================+
```
Status pill is the single source of truth: `SAVING…` → `LIVE · SAVED`. The `resolves ✓` chip and the single `[TEST]` verb are passive (async, never a required commit).

### 3 — MODEL PICKER (the one decision)
```
+======================================================+
|  CHANGE MODEL -- PRIMARY                        [ X ] |
+======================================================+
| (o) together / gpt-5.2     PRODUCTION (RECOMMENDED)  |
| ( ) together / claude-sonnet-4-6                     |
| ( ) openai   / gpt-5.2                               |
| [ search models __________________________ ]        |
+------------------------------------------------------+
|                                    [ USE THIS MODEL ] |
+======================================================+
```

### 4 — CONNECT · STAGE BOARD (separate product, canvas-free, data-driven)
```
+======================================================+
| < ROUTES   CONNECT INGESTION - STAGE MODELS          |
|                          [ USE RECOMMENDED FOR ALL ] |
+======================================================+
| STAGE          MODEL                        STATUS   |
| Extraction    [ together/gpt-5.2     v ] *REC  * ok  |
| Validation    [ together/gpt-5.2     v ] *REC  * ok  | <- "Knowledge Validation"
| Embedding     [ together/embed-3     v ] *REC  * ok  |
| Summarise     [ together/sonnet-4-6  v ]       * ok  |
+------------------------------------------------------+
|  autosaved /        no canvas . no publish step      |
|  (*) All stages ready          [ RUN INGESTION -> ]  |
+======================================================+
```
Rows are built from `apps/dashboard/src/lib/server/ingestion-routing.ts`, never a hardcoded table, so new/custom stages don't break the grid. Reorder/publish/version are not rendered AND are rejected server-side for these routes.

### 5 — THE FORK (Connect Launch — the one-directional boundary)
```
+======================================================+
| CONNECT . LAUNCH INGESTION                           |
+======================================================+
| 1 *  Source connected            google-drive  OK    |
| 2 *  Credentials                 together key  [bind]|
| 3 *  Stage models                7/7 recommended OK  |
|        [ REVIEW STAGE BOARD ]   (inline, not editor) |
|          +------------------------------+            |
|          |     >  RUN FIRST INGEST      |            |
|          +------------------------------+            |
|  Need a custom gateway route instead?  -> Routes     |
+======================================================+
```
The "→ Routes" link is **one-directional**: Connect never reopens the gateway editor in place; Routes never deep-links into Connect.

---

## What We REMOVE (the kill list)

> **Anchor warning:** the line numbers below come from the diagnosis pass, which audited a 2,516-line build. The file is now **3,461 lines**. **Re-anchor every line number against HEAD before the strip PR** — the cited lines (1847, 2086, 2203, 2445, etc.) will be shifted and a blind delete could remove the wrong block. The *behaviours* to remove are exact; the *line numbers* are a starting map only. (The bug-fix file lines below were re-verified at HEAD and ARE accurate.)

File anchor: `apps/dashboard/src/routes/keys/dashboard/projects/[id]/routes/[routeId]/+page.svelte` unless noted.

- **The local-only commit layer:** both inspector "Apply changes" buttons (Call settings ~2086, Advanced ~2203) + the `localRouteStepById` overlay → replaced by autosave-on-change.
- **"Apply to server" / "Revert"** flow-canvas toolbar (~1847/1848) + `persistFlowDraftsToServer`.
- **Separate "Save route"** button (~2445) + the second save subsystem (`persistRoute` vs `persistAllPendingStepsToServer`; `routeDirty` vs `flowDraftPendingServer`) → one autosave.
- **Publish/Versions as a mandatory gate:** "Publish draft" action, draft banner (~1713), and the `version!=publishedVersion` duality in normal use (the HAR's reorder→publish v5→v6). Version history/rollback **kept** as an optional undo net only.
- **The entire Guard rails subsystem on this surface:** inspector accordion (~2099–2139), Configuration section (~2457–2477), tab badge, `RouteGuardRailsPanel`, `pendingPolicyOps` — already flag-off (`module-flags-types.ts:57`). Load-bearing *server* enforcement stays.
- **All 5 raw-JSON textareas:** switchCriteria (~2152), retryPolicy (~2156), costPolicy (~2160), modelPool (~2168), operator notes (~2164) → API/expert-only.
- **The 2 internal-ID free-text inputs:** parallelGroupId (~2185), parallelBranchRole (~2195) → auto-generated by the canvas "Add parallel branch".
- **The Add-step dialog's** redundant Provider/Model/Fallback/Timeout fields + the `/recommend` fetch on every open (`loadRecommendations` ~1116) → folded into the one-tap Model Picker.
- **Duplicate list page + redirect bounce:** collapse `/keys/dashboard/routes` and `/keys/dashboard/projects/[id]/routes`; remove the "Project routes" cross-link (~235) and the "New route" redirect (~241).
- **All tab strips:** the Routes-hub Rules/Ingestion strip + the 4 editor workspace tabs (Flow / Configuration / Versions / More) → one scrollable canvas + a separate Stage Board.
- **The step-label Rename→type→Done** micro-interaction → always-live inline field.
- **UI ceremony with no server gate:** publish/rollback `confirm()`, two-step delete confirm, `beforeNavigate`/`beforeunload` dirty guard, inspector step-switch guard.
- **Two-clicks-deep nav burial:** promote Routes to top-level (`apps/dashboard/src/lib/nav-config.ts:65`).
- **The Connect ingest detour through the full editor:** reframe "Apply recommended routes" from the destructive "Reset to recommended" confirm (`routes/ingestion/+page.svelte:361-398`) into the inline one-click happy path; drop the `canStart` hard-gate (`ConnectPipelineReviewLaunch.svelte:63-69`).
- **The "hold as draft" toggle is NOT added.** (The earlier draft proposed it as a safety valve; it re-introduces the exact draft/publish concept being deleted AND would trip the runtime `route_unpublished` gate, making a "held" route unservable. Version history + rollback already covers the rare staging need.)

---

## What We KEEP

- **The flow canvas the founder loves** — `RouteFlowCanvas.svelte` (DAG, drag-reorder, insert `+`, Add parallel branch) — promoted to the *only* gateway surface.
- **Core per-step essentials:** provider, model, ordered fallback, fallback-when trigger, timeout (timeout under the API-only Advanced disclosure).
- **Server-side publish validation** — `route-publish-validation.ts:17-66` — retained as a **save-time/live-time** check that drives the passive `resolves ✓` chip and **runs fail-closed on every autosave write** (manual Publish button gone). Born-disabled steps are excluded from the "every *enabled* step has provider+model" check, so a half-configured disabled step never blocks a save.
- **The primary-chain enable guard** — `route-flow-primary-enable-guard.ts:16-40`. **Correction:** this is *already* enforced server-side on the per-step disable path (`steps/[stepId]/+server.ts:142-158` returns `409 primary_chain_enable_guard`). Keep it; route the autosave "disable step" action through that same endpoint so the guard stays enforced — no new server work needed there.
- **The resolver ownership/security guards** — `getProject WHERE user_id` in `listRouteStepsByProject` (`neon.ts:3546-3547`) and `getRoute` tenant scoping. **Never removed.** Every bug fix below *passes the correct userId*; it does not drop a single `WHERE user_id` check.
- **The runtime publish gate** — `classifyRouteForExplicitId:394` and `selectRouteForDiscovery:417`. **KEEP as defense-in-depth.** We make it harmless by guaranteeing `version == publishedVersion` forever (autosave never writes `version`), not by deleting the gate.
- **Connect plumbing:** `returnTo`/`withReturnTo` + `invalidate()`, the launch-step credential preflight (`bindNow` one-click repair), and SSE run-console streaming.
- **Version history + rollback** (`VersionsPanel`) — demoted to an optional undo net.
- **resolve/simulate preview** (`RouteResolutionPreview`) — kept as the passive `resolves ✓` chip and the single `[TEST]` verb, never a required commit.

---

## Ingestion vs Gateway boundary (a HARD, server-enforced split — not a mode flag)

The earlier draft's separation was UI-deep: ingestion stage-routes are the same `route` records (`workload=ingestion`) in the same table, written through the same `graph`/`publish`/`steps` endpoints. "Reorder/publish aren't concepts" was only true in the Stage Board UI; the APIs stayed fully callable. We make the split **structural**:

- **Server-side rejection:** at the API layer, **reject** `PUT /graph`, `POST /publish`, step-reorder, and parallel-branch mutations on any route where `workload === 'ingestion'` (return `409 ingestion_route_immutable_topology`). The HAR storm becomes *structurally impossible* on ingestion routes, not merely un-rendered.
- **Server-side list predicate:** the gateway ROUTES list filters `workload != 'ingestion'` in the *server loader*, so the de-fusion does not depend on a client filter regression.
- **Gateway** = `ROUTES` nav → unified list → the single flow canvas (autosave, `[TEST]`). Full `RouteFlowCanvas`; the only place parallel branches are authored.
- **Ingestion** = `INGESTION`/Connect → the **Stage Board**: a flat stage→model grid built data-driven from `ingestion-routing.ts`. One model per stage; one autosave PATCH per change.
- **One-directional escape hatch:** a quiet "Need a custom gateway route? → Routes" link. Connect never reopens the gateway editor in place; Routes never deep-links into Connect.
- Both surfaces share ONE autosave and the SAME server ownership/validity guards underneath.
- *(Adjacent, out of UX scope:* the live `author Expected array but found NONE` coercion failure is an ingestion **data** bug. The Stage Board RUN/SSE console is exactly where it should surface — but it is tracked as a separate data ticket, not part of this rework.)*

---

## Autosave safety model — how "no publish" stays safe on live routes

The whole concept rests on autosave being *safer* than the old manual pipeline, not chattier. Four hard rules, each with a test:

1. **NEVER write the `version` column on autosave.** `version` stays `== publishedVersion` for the life of a dashboard route. Undo snapshots persist *only* to `route_version_events` (`insertRouteVersionEvent`), which does not bump `version`. **Consequence:** `isRoutePublished` is always true, so the runtime `route_unpublished` gate at `route-resolver.ts:394` and `:417` never trips for an autosaved route. **Regression test (required):** create a route → autosave several edits + a reorder → assert it still resolves on the explicit-id path AND is still returned by `selectRouteForDiscovery` for ingestion. This is the single most important test in the rework.
2. **Validate fail-closed on every write, but exclude disabled steps.** Run `validateRouteStepsForPublish` + the primary-chain enable guard **server-side on every write**. An invalid *enabled* step → the write is rejected (`409`), nothing invalid is ever persisted to live traffic. A **born-disabled** step (no model yet) is excluded from the "every enabled step has provider+model" rule, so adding a fallback never breaks the live primary. This resolves the open "what happens to a transiently-invalid autosave?" question: invalid-enabled = reject; valid-but-disabled = persist-not-served.
3. **No side-call cascade.** Debounce ~600 ms field-level writes. **Coalesce a reorder into exactly one `PUT /graph`** (the new order, nothing else) — never `PATCH×4`. `simulate`/`validate` run strictly **async, cancellable, debounced independently, and never on the save critical path**; they only feed the passive `resolves ✓` chip. **Never** fetch `/history` on a write. **Test:** a 2-step reorder produces exactly **1** write and **0** publish/history/critical-path-simulate calls (the inverse of the HAR).
4. **Multi-tab safety.** Add optimistic concurrency (`updatedAt`/etag) on every write; a stale write returns `409` and the UI shows a "route changed elsewhere — reload" toast rather than silently clobbering a live config. **Test:** two concurrent edits to one live route — the second is rejected with a reload prompt, not a silent overwrite.

State is unmissable: the `SAVING… → LIVE · SAVED` pill is the one source of truth; microcopy ("✓ Goes live the moment you create it", "This is just a label — change it any time") removes the ambiguity that the deleted Publish moment used to provide.

---

## The two bug fixes (ship FIRST — hard prerequisite for the unified list and Stage Board)

Run the **`restormel-high-risk-security`** review before the PR (touches auth/ownership resolution). **Every change ADDS the owner-resolving branch that sibling endpoints already have — it does not weaken any `WHERE user_id` guard.**

### Bug #1 — Routes list shows "No providers configured yet" for routes that have steps

Three changes (all verified against HEAD):

**1a. Read endpoint — `apps/.../api/projects/[id]/route-steps/+server.ts`.** `projectScope` (lines 5-9) is **synchronous and missing** the management_key branch (returns `userId: locals.user.uid`). Make it async and add the branch (import `getProjectInWorkspace`):
```ts
async function projectScope(locals: App.Locals, projectId: string): Promise<{ projectId: string; userId: string } | null> {
  if (!locals.user) return null;
  if (locals.user.authType === "gateway_key" && locals.user.projectIdForKey !== projectId) return null;
  if (locals.user.authType === "management_key" && locals.user.workspaceId) {
    const project = await getProjectInWorkspace(projectId, locals.user.workspaceId);
    return project ? { projectId, userId: project.userId } : null;
  }
  return { projectId, userId: locals.user.uid };
}
```
Then `await projectScope(...)` in the GET handler.

**1b. SSR — `apps/.../keys/dashboard/routes/+page.server.ts:82`.** Replace `routeStepsByRoute: {}` with a real server-side load via `listRouteStepsByProject(detail.projectId, userId)` so chains render on SSR and the empty state never flashes.

**1c. Client cache guard — `apps/.../keys/dashboard/routes/+page.svelte:159-185`.** The guard at line 161 is truthiness (`if (lazyRouteStepsByProject[projectId]) return;`) and `{}` is overloaded as both the genuine-empty marker (line 165) and the **error** marker (line 179). Do **not** simply switch to `!== undefined` — that would treat a failed fetch as "loaded" and permanently block retry (the same bug in a new disguise). Use an explicit tri-state (`loading | error | loaded`) or a separate `errorProjects` set: only a genuine *loaded-empty* result suppresses re-fetch; errors stay retryable; show a loading indicator distinct from empty.

**1d. Autosave WRITE endpoints — `steps/+server.ts` and `steps/[stepId]/+server.ts`.** *(Critique HIGH finding, verified at HEAD.)* Both still use the synchronous `projectScope` with **no** management_key branch (`steps/+server.ts:9-13`, `steps/[stepId]/+server.ts:11-15`). The new autosave engine writes step/reorder/model changes through exactly these endpoints, so management_key/SDK callers would silently `403` on every autosaved edit. Add the identical async management_key→`getProjectInWorkspace` branch to both (import `getProjectInWorkspace`) and `await` it in every handler (GET/POST/PATCH/DELETE). **Audit every endpoint the autosave path touches** (graph, recommend, primary-model) for the same omission before shipping autosave.

### Bug #2 — Validation always returns `route_not_found`

**The originally-prescribed fix is a NO-OP and must not be shipped.** `apps/.../api/projects/[id]/routes/[routeId]/validate-binding/+server.ts:15-18` **already contains** the management_key branch (function `projectIdAndUid`, `getProjectInWorkspace` already imported). Adding it changes nothing, so the claim that it makes validation return `{ok:true}` is unfounded.

**What to actually do:**
1. **Re-reproduce against HEAD** with the founder's exact auth path and capture the real returned `reasons[]` array (do not declare it fixed). Since the owner branch is present, `uid==owner` already resolves; the real failure is elsewhere. Most likely candidates, in order: (a) the route is in a draft state and the runtime `route_unpublished` reason is still pushed at `route-resolver.ts:732-733`; (b) a missing/empty `environmentId` in the request body (the endpoint hard-requires it, line 48-50); (c) an SDK base-URL / wrong-environment mismatch so `getRoute` genuinely finds nothing.
2. **Once the publish gate is removed under the autosave invariant** (`version == publishedVersion` always), `route_unpublished` can no longer legitimately fire; strip it from `validateRouteBinding` (`route-resolver.ts:732-733`) as part of that change so the preflight matches the runtime reality. This is the only validate-binding code change, and it is *consequential to* the publish removal — not a standalone "bug #2 fix."

---

## Rollout (sequenced; each step independently shippable)

1. **Bug #1 (all four parts) first**, including the write-endpoint branches (1d). The unified list and Stage Board both read steps via `listRouteStepsByProject`; without 1a/1b/1c they show empty, and without 1d the autosave engine 403s for SDK callers. Security review before PR. **Bug #2: re-reproduce, do not ship a no-op.**
2. **Autosave engine** per the four-rule safety model: never-write-version invariant + the resolve/discovery regression test, debounced ~600 ms field writes, reorder coalesced to one `PUT /graph`, async cancellable validate off the critical path, no history-on-write, etag concurrency + reload toast. Add the "2-step reorder = 1 write, 0 publish/history" test.
3. **Server-enforce the ingestion split:** reject graph/publish/reorder/parallel mutations on `workload=ingestion` routes (`409`); add the server-side list predicate (`workload != 'ingestion'`).
4. **IA collapse.** Merge the two list pages into one with inline `[+ NEW ROUTE]`; promote Routes to top-level (`nav-config.ts:65`).
5. **Strip the editor** to the single canvas: remove Apply / Apply-to-server / Publish / Save, the guard-rails subsystem, the 5 JSON textareas, the 2 parallel-ID fields, the Add-step dialog, and all tabs. **Re-anchor every removeList line number against HEAD first.** Keep version history/rollback behind the overflow.
6. **Stand up the Stage Board** as a separate surface, data-driven from `ingestion-routing.ts`; reframe "Apply recommended"; drop the `canStart` hard-gate; wire the one-directional escape hatch.
7. **Safety net for migration:** version history/rollback as the undo path. *(No "hold as draft" toggle — see removeList.)*

---

## Risks & mitigations

- **Live routes + ingestion go dark (HIGH).** If autosave writes `version` past `publishedVersion`, `route-resolver.ts:394` and `:417` fail closed while the UI says `LIVE·SAVED`. → **Invariant: autosave never writes `version`; snapshots go to `route_version_events` only; keep the runtime gate as defense; add the resolve+discovery regression test.**
- **Silent edit loss for SDK/management_key callers (HIGH).** The write endpoints (`steps`, `steps/[stepId]`) lack the owner branch. → **Fix 1d before autosave ships; audit every autosave-touched endpoint.**
- **Bug #2 shipped as a no-op (HIGH).** The proposed branch already exists. → **Re-reproduce against HEAD; capture `reasons[]`; the only real change is stripping `route_unpublished` from the preflight as a consequence of publish removal.**
- **Autosave recreating the HAR storm (MEDIUM).** → Debounce + coalesce to one write per interaction; async, cancellable validate; never fetch `/history` on write; test that a reorder = 1 write, 0 publish/history.
- **UI-deep ingestion split re-fuses (MEDIUM).** → Server-side `409` rejection of topology mutations on ingestion routes + server-side list predicate; the link is strictly one-directional.
- **Non-additive principle (MEDIUM).** The one justified addition is the autosave/etag engine. The Stage Board replaces the ingestion detour through the full editor; the Model Picker replaces the Add-step dialog's four fields + per-open `/recommend`; the unified list replaces two list pages + a redirect bounce. The "hold as draft" toggle is dropped.
- **Multi-tab clobber on a live route (MEDIUM).** → etag concurrency + "route changed elsewhere — reload" toast; tested.
- **Born-live default briefly serving an unintended model (LOW, mitigated).** The opinionated default IS a valid production model; new fallback/insert steps are born **DISABLED** until a model is confirmed; the primary-chain enable guard (already server-enforced) keeps every live route valid; the `LIVE·SAVED` pill + microcopy make state unmissable.
- **Cache-guard fix re-introducing the silent-empty bug (LOW).** → tri-state (`loading|error|loaded`), not `!== undefined`; errors retryable.
- **Stale removeList line anchors (LOW).** File is 3,461 lines, not 2,516. → Re-anchor before the strip PR.
- **Moving switchCriteria/retry/cost/modelPool to API-only strips the rare expert (LOW).** They were syntax-only validated (invalid policies already failed at runtime), so the API is the safer home; the canvas covers parallel branches visually.