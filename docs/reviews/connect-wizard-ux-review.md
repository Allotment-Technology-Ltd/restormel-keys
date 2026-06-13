# Connect Ingestion Setup Wizard — UX/UI Review Kit

Context + prompt for an advanced-model UX/UI review of the ingestion **setup wizard**.
Designed for a CLI agent with broad access (can read source, run the dev server, install
Playwright). It enables a **static/structural review that always works**, plus a **best-effort
rendered review** when the app boots.

---

## 1. What to review

The 4-step pipeline setup wizard the user completes before their first ingest run:

`store → domain → sources → launch`

Route: `/keys/dashboard/connect/pipeline?step=<id>`
Step copy lives in `apps/dashboard/src/lib/connect/pipeline-config.ts` (`PIPELINE_WIZARD_STEPS`).

## 2. Component inventory (`apps/dashboard/src/lib/components/connect`)

| Component | lines | role |
|---|--:|---|
| `pipeline/ConnectPipelineWizard.svelte` | 286 | orchestrator: step routing, gating, footer nav, template banner |
| `pipeline/PipelineWizardStepper.svelte` | 67 | the progress stepper |
| `pipeline/ConnectGraphStorePanel.svelte` | — | step 1 (store) |
| `pipeline/ConnectDomainPacksPanel.svelte` | 1143 | step 2 (domain) — **largest; primary decomposition candidate** |
| `pipeline/ConnectSourcesPanel.svelte` | 725 | step 3 (sources) |
| `pipeline/ConnectPipelineReviewLaunch.svelte` | 261 | step 4 (review & launch) |
| `pipeline/ConnectIngestRunConsole.svelte` | 1082 | post-launch run console (adjacent journey) |

The orchestrator is competent (URL-driven step state, lazy-loaded panels, `aria-current`,
`role="status"/"alert"`, breadcrumbs, template→sessionStorage handoff, initial-vs-operational
phase). **The perceived clunkiness, if any, lives in the 700–1140-line step panels** — aim there.

## 3. Grade against these canonical specs (do not invent a rubric)

- `docs/design/ux-contracts.md` — **state model** (loading / error / empty / success, each with a
  recovery action), **copy registry** (canonical nouns; no synonyms), section/header pattern.
- `docs/design/DESIGN-SPECIFICATION.md`, `docs/design/DESIGN-TOKENS.md`, `docs/design/design-system-index.md`,
  `docs/design/COMPONENT-INVENTORY.md` — Neo-Brutalist v2 system: `BrutalErrorBanner`, `EmptyState`,
  `BrutalLoadingState`, `BrutalPageHeader`, tokens (`--rm-*` / `--rk-*`), 4px borders,
  `8px 8px 0` shadows, zero radius, monospace, 100ms press.

A finding is only valid if it cites the wizard code **and** the contract/token it violates.

## 4. Candidate UX findings to validate or refute

Prior static pass — confirm or refute each, then find what it missed:

| # | where | claim |
|---|---|---|
| UX1 | `ConnectPipelineWizard.svelte:58-62` (`stepReachable`) | hard store-first gate: domain/sources unreachable until a graph store is connected — "commit infra before you can explore." Consider read-only preview of later steps. |
| UX2 | `ConnectDomainPacksPanel.svelte` (1143 lines) | over-large component; likely mixes data-loading, multiple sub-flows (built-in / import / AI-design / custom), and presentation — decompose + audit for inconsistent state handling. |
| UX3 | wizard ↔ quality surfaces | expected-quality feedback (G2 / trust score / orphan & faithfulness warnings — see `IngestQualityCallout`, `QualityDelta`, `run-quality-report`) lives OUTSIDE the wizard. The launch step shows what will run, not what quality to expect. Bringing a preview/forecast into step 4 is the highest-value journey change and ties to the ingestion-quality concern. |
| UX4 | all panels | verify every async surface implements all four `ux-contracts.md` states **with a recovery action**; flag any blank/spinner-only or message-only-no-recovery states. |
| UX5 | footer/stepper copy | "Store confirmed → Continue", "START RUN →", "Skip for now" — check against the copy registry and CTA grammar; check disabled-button `title` hints are present and accurate. |

## 5. How to run the review

### Static / structural (always works — primary path)

Read the components + grade against §3. Validate component edits with:

```bash
pnpm --filter dashboard run check   # svelte-kit sync + svelte-check (its `precheck` builds deps first; slow but complete)
```

### Rendered (best-effort — needs the app to boot)

The dashboard is a SvelteKit app; the populated wizard depends on auth + a graph store, so a
fully-populated render may not be reachable without backend config. Empty/initial states and
the wizard shell usually are. Try:

```bash
pnpm --filter dashboard run dev     # runs `predev` (builds ~8 workspace pkgs), then vite dev (default :5173)
# then open /keys/dashboard/connect/pipeline?step=store  (and ?step=domain, =sources, =launch)
```

For screenshots / interaction (Playwright is NOT installed by default — install on demand):

```bash
pnpm -w add -D @playwright/test && pnpm -w exec playwright install chromium
# drive the route above, capture each step, evaluate against §3
```

**If the app cannot boot in this environment, say so and fall back to the static path** — do
not block the review on a running server, and do not fabricate screenshots.

---

## 6. The prompt

```
ROLE
You are a senior product designer + frontend engineer auditing one user journey. Deliverable:
a prioritized UX/UI findings report. Audit only — propose changes, do not rebuild or edit
unless explicitly told in a follow-up.

SCOPE
The Connect ingestion setup wizard: apps/dashboard/src/lib/components/connect/pipeline/** and
its step config apps/dashboard/src/lib/connect/pipeline-config.ts.
Read docs/reviews/connect-wizard-ux-review.md first (component map, candidate findings, the
specs to grade against, how to run it). Do not re-derive the component map — it is there.

METHOD
1. Static review against the canonical specs in §3 of that doc (ux-contracts.md state model +
   copy registry; the Neo-Brutalist design system / tokens). Every finding cites the wizard
   code AND the contract/token it violates.
2. Validate or refute each candidate finding (UX1–UX5); then find what the list missed.
3. Attempt a rendered review (§5). If the app boots, walk each step
   (?step=store|domain|sources|launch), capture state coverage and visual issues. If it does
   not boot, say so explicitly and continue with the static review — never fabricate output.

LENS
- Journey friction: premature commitment, dead ends, unclear "what next", reachability gates.
- State coverage: loading / error / empty / success each present WITH a recovery action.
- Copy: canonical nouns only (no synonyms); CTA grammar; honest disabled-state hints.
- Design-system fidelity: tokens vs hardcoded values; correct Brutal* components for states.
- Component health: oversized components mixing data + multiple sub-flows + presentation.
- Accessibility: focus order, aria-current/role usage, keyboard nav, label correctness.

OUTPUT (markdown)
1. Findings table: ID | file:line | severity | category (journey / state / copy / a11y /
   design-system / component-health) | the issue | the fix | confidence | effort.
2. One paragraph per high-severity finding with the code/spec citation.
3. "Journey-level recommendations" — at most 5, sequenced by user impact (e.g. UX3 quality
   forecast in the launch step). For each, say whether it is a targeted change or a
   re-architecture, and name the hard-won behaviors a rebuild would risk dropping
   (store-first gating, template handoff, invalidate() keys, lazy-import states, journey phase).
4. "Rendered review" section: what you could and could not load, with screenshots if any.

Use effort: high. One pass; do not ask scoping questions. Prefer targeted change over rebuild;
if you recommend a rebuild, justify it against the preserved behaviors above.
```

---

**Note on "rebuild".** A from-scratch rebuild of a working, accessible, gated flow is
high-risk. The prompt forces audit-first and names the specific behaviors a naive rebuild drops.
Treat rebuild as the exception, applied per-panel, behind the existing route — not a big-bang.
