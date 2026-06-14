---
title: Connect Ingestion Setup Wizard — UX/UI Findings
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-09
last-reviewed: 2026-06-13
review-interval: P12M
---

# Connect Ingestion Setup Wizard — UX/UI Findings

Audit per `docs/reviews/connect-wizard-ux-review.md` (static review against `docs/design/ux-contracts.md`
+ Neo-Brutalist v2 specs, candidate validation UX1–UX5, best-effort rendered pass). Audit only —
no code was changed.

**Verdict in one line.** The orchestrator and launch step are in good shape; the real problems are
(a) one journey-blocking gate bug for Neo4j/Weaviate stores, (b) a systemic error/empty-state
discipline gap across the three big panels (color-only text errors, no recovery actions, errors
announced as `role="status"`, two empty↔error conflations, swallowed failures), and (c) the
1143-line domain panel confirming the decomposition concern. The adjacent run console already
uses `BrutalCard` + `role="alert"` + distinct state classes — the wizard panels predate that
standard and lag it.

## 1. Findings table

| ID | file:line | severity | category | issue | fix | conf | effort |
|---|---|---|---|---|---|---|---|
| N1 | `ConnectGraphStorePanel.svelte:178-213,698-749` ↔ `+page.server.ts:181,194-196` | **critical** | journey | Saving a Neo4j/Weaviate store writes `workspaces.graph_store_config` (`graph-store-config.ts:115`) but the step-1 gate reads `connect_graph_targets` (`getGraphTargetForUi`) — "Saved — connection healthy" yet Continue stays disabled and non-store steps redirect back. Dead end. `[verify: runtime]` | On adapter save, also upsert/activate a graph target (or make `hasGraphStore` read either source) | high | M |
| N2 | `+page.server.ts:225-229` + `ConnectPipelineWizard.svelte:137-138` | **high** | state | Catch-all load failure returns `wizard: null`, rendered as "Sign in to set up your pipeline." — an error shown to signed-in users as an auth prompt, with no recovery action either way | Distinguish `loadError` from signed-out in load payload; render `BrutalErrorBanner` + retry for errors, sign-in link for auth | high | S |
| N3 | `ConnectSourcesPanel.svelte:133-137,280-282` | **high** | state | `persistSelection` and `deleteConnection` swallow failures (`catch { /* ignore */ }`); checkboxes update optimistically so UI selection silently diverges from the server (footer count comes from the server) | Surface a retryable error and reconcile checkbox state on failure | high | S |
| UX2 | `ConnectDomainPacksPanel.svelte` (1143 lines) | **high** | component-health | Confirmed: 8 fetch flows, 5 concurrent message channels (`packMsg`, `designMsg`, `schemaMsg`, `draftSavedNotice`, `loadError`), 3 sub-flows + ~200-line creator form in one component | Decompose: PackPicker / SurrealImport / AiDesigner / PackEditorForm with one message-area contract | high | L |
| UX3 | `ConnectPipelineReviewLaunch.svelte:127-242` | **high** | journey | Confirmed: launch shows preflight + hardcoded "~3–8 min" + naive `docs × 4` call estimate; zero quality expectation — not even the pack's `quality_preset`/`cross_model_validation`; G2/trust surfaces are post-run (`IngestQualityCallout` is admin-only) | Quality-forecast block in step 4 (preset, cross-model validation, G2 bar, chunk totals, starter-preset warning) | high | M |
| N4 | `ConnectSourcesPanel.svelte:320→684-685, 345→698` | medium | state | Empty browse result ("No documents found.") renders with `.err` styling; conversely import *failures* with refs present render as `.notice`. Empty↔error conflated both directions | Separate empty/error channels; style accordingly with recovery actions | high | S |
| N5 | `ConnectPipelineWizard.svelte:69-75,109-126` + `ConnectDomainTemplateSelector.svelte:56-78` + `ConnectDomainPacksPanel.svelte:414-425` | medium | journey/state | Template handoff has three sources of truth: `?template` survives every `goToStep` (full-URL copy), so revisiting Domain re-applies the template over user edits; the wizard's banner never clears in-session after the selector consumed+cleared storage | Strip the `template` param on intake; clear banner via consumption event | high | S |
| N6 | `ConnectPipelineWizard.svelte:180-221` + `connect-pipeline.css:115-125` (and absence) | medium | design-system | `.wizard-panel-loading`/`.wizard-panel-error` have **no CSS anywhere** (bare text); panel errors are color-only `.err` text — ux-contracts maps error→`BrutalErrorBanner` (coral fill + border), loading→`BrutalLoadingState`. Run console already complies; wizard panels don't | Adopt Brutal state primitives across wizard chrome + panels | high | M |
| N7 | store `:540,562,630,686,738`; domain `:682,789,916`; sources `:456,462,511,603,654,718` | medium | a11y | Error messages announced with `role="status"` (polite) — screen readers may miss failures; only launch (`:244`) and panel-load errors use `role="alert"` | `role="alert"` (or `aria-live="assertive"`) when the message is an error | high | S |
| N9 | `PipelineWizardStepper.svelte:12-16` + `ConnectPipelineWizard.svelte:48-62` | medium | state-honesty | Stepper ✓ marks are purely positional (`index < stepIndex`) — deep-linking `?step=launch` shows all prior steps "completed"; the orchestrator's real `stepDone()`/`stepReachable()` are dead code (never called) | Pass real completion into the stepper; delete or wire `stepReachable` | high | S |
| N10 | `ConnectPipelineWizard.svelte:100` ↔ `ConnectPipelineReviewLaunch.svelte:31,74-75` | low | journey | Footer `runStepCanStart` (docs+models) duplicates and already diverges from panel `canStart` (also requires pack); blocked `startRun()` returns silently — a clickable button that no-ops | Single exported gate from the panel; never silent-return | high | S |
| N11 | `pipeline-config.ts:94` + `ux-contracts.md §2` | low | copy | Store step lead still says "connect SurrealDB you manage" though the panel offers Neo4j/Weaviate/Neptune (Build 2A drift). Registry gap: Connect nouns (Graph store, Domain pack, Ingest run, "Models & keys") aren't in the copy registry; "Models & keys" vs sidebar canon "Model Catalog" | Update step lead; register Connect nouns | high | S |
| N12 | `ConnectPipelineReviewLaunch.svelte:112,232` | low | copy/journey | "~3–8 min" hardcoded regardless of corpus; calls estimate is `docs × 4` | Scale estimate from chunk counts (available on `runDefaults.documents`) | high | S |
| N8 | `connect-pipeline.css:119,131,141,150,…` + store panel `<style>` 755-786 + sources `:668,715-716` | low | design-system | Hardcoded `1px` borders (below the 2px token micro floor; spec says 4px/2px), `.db-chip` rem paddings off the 4px scale, inline `style=` layout in sources | Use `var(--border)` / spacing tokens; lift inline styles | med | S |
| N13 | `ConnectPipelineWizard.svelte:66` + `ConnectDomainTemplateSelector.svelte:74` | low | a11y | `scrollIntoView({behavior:"smooth"})` ignores `prefers-reduced-motion` | Guard with media query or CSS `scroll-behavior` | high | S |
| UX4 | panels passim (see §2) | — | state | Verdict: every async surface has loading+success; **error and empty states systematically lack recovery actions** (sign-in errors without links: store `:274`, domain `:451`, sources `:169,198`; "No domain packs yet." without CTA: domain `:761`). Exceptions that comply: sources doc empty state `:513-526`, launch empty `:115-122`, domain routes-warning `:670-675` | — | high | — |
| UX1 | `+page.server.ts:194-196` | — | journey | Gate confirmed but **server-side** (redirect), not the dead client fn the pack cited. Defensible requirement; preview of later steps remains a fair enhancement (read-only render behind the redirect) | — | high | — |
| UX5 | `ConnectPipelineWizard.svelte:241-281` | — | copy | Disabled-button `title` hints present and accurate on all four footers ✓. Issues: "Domain selected → Continue" is enabled by the auto-selected default pack or merely opening the creator disclosure (`ConnectDomainPacksPanel.svelte:646`) — label asserts a choice the user didn't make; "START RUN →" is the only all-caps CTA among sentence-case siblings; `title` tooltips are invisible to keyboard/SR users (pair with visible hint or `aria-describedby`) | — | high | — |

**Positive patterns to preserve** (don't regress in any fix): quick-connect parse recovery
(`ConnectGraphStorePanel.svelte:371-383` — auto-opens manual fields + parsed preview), sources
document empty state with CTA, launch preflight checklist with per-row Edit → links and the honest
"Only X of Y selected" warning, busy-label buttons everywhere, native confirms on all destructive
actions, the `returnTo`/step round-trip, lazy-panel `{#await}` states, legacy step redirects.

## 2. High-severity expansions

**N1 — Neo4j/Weaviate stores can't pass step 1.** The store panel's multi-DB selector saves
Neo4j/Weaviate via `PUT /api/connect/pipeline/graph-store-config`, which persists to
`workspaces.graph_store_config` and explicitly notes "SurrealDB continues to use the dedicated
graph-target flow" (`graph-store-config.ts:7`). But wizard progress is computed from that other
flow only: `hasGraphStore: Boolean(target)` where `target = getGraphTargetForUi(workspace.id)`
(`+page.server.ts:181`), and the server hard-gates every non-store step on it:
`if (!target && step !== "store") throw redirect(302, pipelineWizardHref("store"))` (`:194-196`).
So a Weaviate-only user sees "Saved — connection healthy.", a disabled "Store confirmed →
Continue" (`title="Connect your graph store to continue"`), no status card (it renders only in
the `dbKind === "surrealdb"` branch, `ConnectGraphStorePanel.svelte:500`), and any deep link
bounces back to store. Marked `[verify: runtime]`: statically the save path writes no row in the
table the gate reads.

**N2 — load failures masquerade as a sign-in prompt.** Any thrown load error (workspace, DB)
hits the catch-all and returns the same shape as signed-out (`wizard: null`,
`+page.server.ts:225-229`); the wizard renders `<p class="notice" role="status">Sign in to set up
your pipeline.</p>` (`ConnectPipelineWizard.svelte:137-138`). A signed-in user with a transient
backend failure is told to sign in, with no link to do even that, no retry, and no error
semantics — violating both the error-state and recovery-action contracts (`ux-contracts.md §3`).
The rendered pass confirmed truly signed-out visitors get the dashboard layout's own (compliant)
sign-in shell instead, so this branch is *primarily* the error path in practice.

**N3 — selection saves fail silently.** Document checkboxes drive what the next run ingests.
`persistSelection` PUTs and ignores failure entirely (`ConnectSourcesPanel.svelte:133-137`);
the checkbox stays checked, the footer count (server-derived) disagrees, and the user launches a
run against a selection they didn't make. Same pattern on `deleteConnection` (`:280-282`).

**UX2 — confirmed, with the decomposition seams visible.** One component owns: pack list +
radio selection, per-pack view/edit/delete overflow menus, Surreal schema discovery→mapping→import,
the AI designer (intent, domain, starter-doc sampling), the template selector intake, and the full
custom-pack creator/editor. Sub-flows are individually well-behaved (each has its own busy flag and
message channel) — the cost is five message channels that can all render at once and a form model
(`np`) shared between "AI draft", "Surreal import", and "manual edit" entry points.

**UX3 — confirmed; the launch step describes effort, not expected quality.** Step 4 shows what
will run (store, pack, documents, models) and rough cost ("~3–8 min", `docs × 4` calls) but
nothing about expected outcome quality: the chosen pack's `quality_preset` (production vs starter)
and `cross_model_validation` are configured upstream and invisible here, and the G2 bar /
trust-score / orphan-warning machinery only appears after the run (run console `quality_report`,
admin `IngestQualityCallout`). The pack's own warning copy ("Starter reduces chunk coverage … not
for agent-facing graphs", `ConnectDomainPacksPanel.svelte:1073`) is exactly what belongs on the
launch screen when a starter-preset pack is about to be used.

## 3. Journey-level recommendations (sequenced by user impact)

1. **Unblock non-Surreal stores (N1)** — *targeted change*: on adapter save, upsert + activate a
   graph target (or widen `hasGraphStore`). Preserve: the server-side store-first redirect, target
   activation semantics in the Graph Library.
2. **Quality forecast in the launch step (UX3)** — *targeted change*: a "What to expect" block in
   `ConnectPipelineReviewLaunch` (preset + cross-model validation + G2 bar + chunk totals + starter
   warning), feeding from `runDefaults` + pack fields already loaded. This is the highest-value
   journey change and ties directly to the ingestion-quality programme.
3. **State-discipline pass across panels (N2, N3, N4, N6, N7, UX4)** — *targeted, mechanical*:
   Brutal state primitives for error/loading, recovery actions on every error/empty, `role="alert"`
   for errors, split empty vs error channels in browse/import, surface selection-save failures.
   Preserve: `role="status"` for genuine notices, busy-label buttons.
4. **Decompose `ConnectDomainPacksPanel` (UX2)** — *per-panel re-architecture behind the existing
   route*: PackPicker / SurrealImport / AiDesigner / PackEditorForm with a single message-area
   contract. Preserve: embedded mode, `stepState` dispatch, selection PUT semantics, embedding
   lock, schema-mapping flow, template intake, starter-doc sampling.
5. **One source of truth for template handoff + honest stepper (N5, N9)** — *targeted*: strip the
   `template` param once consumed, clear the wizard banner on a consumption event, pass real
   `stepDone` data into the stepper (and delete the dead client gate fns). Preserve: login→
   sessionStorage handoff, scroll-to-intent affordance (with reduced-motion guard, N13).

**On "rebuild":** nothing here justifies a from-scratch rebuild. The orchestrator's hard-won
behaviors (URL-driven step state, server gate + redirects, `returnTo` round-trip, `invalidate`
keys `app:connect-pipeline:<ws>` / `app:connect-hub:<ws>`, lazy-import await states, journey
phase initial/operational, legacy step redirects, template handoff) are exactly what a naive
rebuild would drop.

## 4. Rendered review

The app boots: `pnpm --filter dashboard run dev` (after a `pnpm install` to fix a stale
workspace link unrelated to the wizard). All four step URLs
(`/keys/dashboard/connect/pipeline?step=store|domain|sources|launch`) SSR with HTTP 200.
**Without a session, the dashboard layout renders its generic sign-in shell** ("…sign in to see
your next step. Sign in with GitHub." — registry-compliant CTA), so the populated wizard is
unreachable headlessly (GitHub OAuth). Per the kit, no screenshots were fabricated; Playwright
was not installed since the only reachable render is the signed-out shell. **Not verified
rendered:** populated panel states, focus order, mechanical-press motion, the N1 dead end at
runtime, stepper visuals. These are the items a signed-in manual pass (or a seeded dev session)
should confirm.
