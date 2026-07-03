---
name: restormel-ux-craft
description: >-
  Novice-first UX standard for the Restormel Keys dashboard: one-glance next action, minimum
  path to a cited answer, state-derived progressive disclosure, honest ingest-run and citation
  states, abstention copy, jargon translation, CTA and error microcopy grammar. Use when
  building or reviewing any dashboard surface, flow, wizard, empty state, or user-facing
  string, when the user mentions onboarding, first-run, novice, empty state, stepper,
  citations, provenance, trust UX, or microcopy — not marketing-site or email copy
  (restormel-email-copywriting) and not visual chrome mechanics (restormel-neu-brutalist-ui,
  which this skill assumes and builds on).
---

# Restormel UX craft

Canonical references: [docs/design/ux-contracts.md](../../../docs/design/ux-contracts.md) (§2 content registry, §3 state conventions — this skill **extends** both and must never contradict a registry row), [docs/reviews/wave-r-design-usability-rubric.md](../../../docs/reviews/wave-r-design-usability-rubric.md) (severity ladder + X-invariants), [docs/design/onboarding-handoff/04_TOKENS.md](../../../docs/design/onboarding-handoff/04_TOKENS.md) (accessibility floors), [docs/design/DESIGN-SPECIFICATION.md](../../../docs/design/DESIGN-SPECIFICATION.md) (**v2 preamble + Accessibility section only, minus that section's focus-ring and blanket reduced-motion code blocks** — both superseded per the precedence table below; the v1 body's dark palette and Tailwind/React examples are historical; do not cite them).

The thesis this skill enforces: a complete novice — someone who has never said "knowledge
graph" or "ingest" — lands on Home, finds exactly **one** next action within one scan, and
reaches a **cited answer from their own documents** along the M0→M1→M4 spine
(Explore → Build → Connect). Verify/Store depth appears only when real graph state warrants
it. Every rule below is checkable against a diff or a rendered screen and maps to the rubric
severity ladder (Blocker / Major / Minor / Polish). The content column tops out ~892px —
write and test copy at that width.

**Do not** duplicate ux-contracts §2/§3 content into components or new docs. Cite the
registry row or §3 block; if a noun or state you need has no row, add one to the registry in
the same PR (registry discipline, ux-contracts §2).

Two conventions govern every check in this file:

1. **Route literals are the target IA** (ux-contracts §1 route taxonomy + §A redirect map).
   The shipped app is mid-migration — `/connect/*`, `/graph`, `/keys`, `/integrations` until
   R2–R5 land — so consult §A for a route's current disposition before writing a check
   against a literal path.
2. **Every grep runs over the diff's changed files**
   (`git diff --name-only origin/main...HEAD -- apps/dashboard/src | xargs grep …`), never
   the whole tree. The tree carries pre-existing debt; a rule gates only what the PR touches.

## Precedence and resolved conflicts

Where sources disagree, this table is the ruling. Cite it in PRs instead of re-litigating.

| Conflict | Ruling | Why |
|---|---|---|
| v1 blue focus ring (`rgba(76,141,255,0.5)`, DESIGN-TOKENS.md) vs v2 `brut-focus` yellow ring | **`brut-focus` is canonical** for all product chrome. The blue ring survives only in legacy data-viz and the dark `--rk-*` embeddable hosts (KeyManager / Web Components) that DESIGN-TOKENS.md retains. | DESIGN-SPECIFICATION v2 preamble supersedes v1; the 50%-alpha blue ring composites to ~1.7:1 on cream — fails the 3:1 floor. |
| Yellow `#FFD600` fills/rings on cream canvas (~1.2:1) vs WCAG 1.4.11 (3:1 non-text) | **Every yellow fill or focus ring carries a ≥2px ink border or ink offset.** Yellow alone never marks a boundary. This **amends** the shipped `.brut-focus` (currently a bare yellow outline in `brutalist-utilities.css`) and the 04_TOKENS "yellow focus ring" floor: implement the ink offset once, in the shared utility — never per surface. | R3-A3 covers ink-on-yellow text only; the fill/ring edge needs ink to pass 1.4.11. |
| Mono uppercase type (X2; 04_TOKENS §Buttons "uppercase for labels/buttons") vs all-caps readability cost | **Chrome uppercases; content stays sentence case.** `.btn` renders uppercase via `text-transform` (04_TOKENS §Buttons — canonical, unchanged); the *authored* string is sentence case. Uppercase as authored content = ledger labels and short operational nouns only (X12). Body, errors, helper text: sentence case, no transform. | 04_TOKENS and X12 both hold: the transform is chrome, so source strings (what i18n and assistive tech consume) stay sentence case; never extend uppercase to sentences. |
| Blanket `* { animation-duration: 0.01ms !important }` (DESIGN-SPECIFICATION Accessibility block) vs per-animation guards | **Per-animation `prefers-reduced-motion: reduce` guards with a static informative fallback** (X9, ux-contracts nav-pending/LiveRunChip pattern). No blanket kill rule in new code. | The blanket rule breaks "static text carries the signal" states. |
| Brand motion (100ms press, pulsing dots) vs vestibular safety | Brand motion is **never exempt** from the X9 guard. LiveRunChip static-under-reduced-motion is the precedent. | R3-A3, X9. |
| Research says ban "ingest" for novices vs registry canonical CTA "Ingest" (Sources) | **Registry nouns win.** The canonical term stays; first-contact surfaces pair it with a plain-language outcome line (see §5). | ux-contracts §2 is the single vocabulary source; this skill adds a translation layer, not synonyms. |

## 1. Novice-first: the one-glance test

| # | Rule | Severity if violated |
|---|---|---|
| 1.1 | Exactly **one** yellow primary CTA per rendered view state. Everything else is secondary/link styling. Two yellow buttons on one screen is a defect, not emphasis. | Major |
| 1.2 | CTA labels name the literal outcome, verb-first, 1–3 words + object: "Ingest a document", "Ask a question", "Connect an agent". **Banned strings:** "Get started", "Learn more", "Click here", bare "Submit", bare "Continue" when the destination is not visible on screen. | Major |
| 1.3 | No upfront tour, tutorial modal, or coach-mark sequence on first route load (NN/g: tours measurably don't help and get skipped). Contextual help only: dismissible, re-openable, rendered adjacent to the thing it explains. | Major |
| 1.4 | Onboarding checklists: ≤5 items, and **every item is a spine event** (document ingested, run completed, cited answer viewed, agent connected). The PR names the instrumentation event per item. "Complete your profile"-class filler is banned. | Major |
| 1.5 | Golden path (land → cited answer) crosses ≤2 panels (rubric Blocker ladder). Verify by counting panels crossed in a clean-workspace walkthrough — the panel count is the bar, countable and reproducible, not elapsed time. | Blocker |
| 1.6 | Scan-first writing: the user's goal keyword sits in the first 2 words of every heading and link; paragraphs ≤3 sentences at 892px; front-load, never "In order to…" (grep-checked below). | Minor |
| 1.7 | First-run sample path: the M0 Explore surface offers a one-click cited question against sample content before the user has ingested anything — teach by doing, not by explainer. | Major |

### How to verify

- Screenshot each changed route at 892px; count yellow CTAs (must be 1) and confirm every yellow fill shows its ink border.
- `git diff --name-only origin/main...HEAD -- apps/dashboard/src | xargs grep -riE '>(get started|learn more|click here)<'` — must return nothing (the tree has legacy hits, e.g. `keys/+page.svelte`; the diff must add none).
- Same pipeline with `grep -n 'In order to'` — nothing new (1.6).
- Clean-workspace walkthrough: land → cited answer, count panels crossed (≤2).
- Checklist PRs: table in the PR body mapping item → event name.

## 2. State-derived progressive disclosure and empty states

Extends ux-contracts §3 (loading/error/empty/success + recovery-action floor). Do not restate §3; cite the relevant §3 block in the component doc-comment.

| # | Rule | Severity if violated |
|---|---|---|
| 2.1 | **Every advanced surface names its reveal predicate.** Verify/Store depth, as-of controls, evidence facets, etc. render only when a real state condition holds (e.g. `claims.some(c => c.verification)`). The predicate is quoted in the component doc-comment and the PR description. Static "advanced" toggles with no state predicate are banned. | Major |
| 2.2 | Empty-state anatomy on every emptiable container: (a) one line saying what will live here, (b) why it's empty, (c) **exactly one** action that populates it. First-use, cleared, no-results, and error are four distinct states — design each, never one generic placeholder. | Major |
| 2.3 | Honest absent states: a missing measurement renders an explicit absent state, **never a fabricated `0`** (ux-contracts Home masthead rule; rubric Blocker "fabricated state"). | Blocker |
| 2.4 | What earns screen presence: a feature the current state can't use is absent, not disabled-and-teasing (ux-contracts mobile mutations rule generalised). Don't explain features the user can't reach yet. | Major |
| 2.5 | No orphan surfaces (X5): everything mounted is reachable via nav/ledger link/account menu; unmounted routes redirect per UXC §A with query params preserved + a redirect test. | Blocker |
| 2.6 | Delete copy that restates visible UI ("Below you can see your documents"). Populated state speaks for itself: counts, chips, the graph. | Minor |

### How to verify

- Render each emptiable container with empty fixtures (first-use AND no-results AND error) — screenshot all; check the 3-part anatomy and the single populating action.
- Diff check: reveal predicate quoted in doc-comment; grep the PR body for it.
- `pnpm test` in `apps/dashboard` — redirect tests for any moved/unmounted route (X5 convention).
- getByRole test asserting the absent-state text renders when the fixture lacks the measurement (never `0`).

## 3. Wizard and flow craft

| # | Rule | Severity if violated |
|---|---|---|
| 3.1 | One decision per panel (GOV.UK one-thing-per-page). Cut fields before paginating — step count doesn't drive abandonment, field friction does (Baymard). The PR body lists fields per panel (before → after) for any flow-shape change. | Major |
| 3.2 | Prefill every field that has a safe default. Optional questions are deferred out of first-run entirely; if one must stay, mark it "(optional)" **in the visible label**, never in a placeholder. Required/optional both explicit. | Major |
| 3.3 | Honest steppers: step count = real decision count, `aria-current="step"` on the active step (R4-A1), panel transitions move focus to the new heading, Back preserves input. No decorative steps, no progress bar whose speed you can't guarantee. | Major (a11y barrier) |
| 3.4 | One primary CTA per wizard state (rule 1.1 applies inside flows too). Escape closes any overlay introduced; focus returns to the opener (X10, DossierRail contract). | Major |
| 3.5 | Destructive confirmations state the blast radius in numbers ("Cancel 2 running runs and delete 5 finished runs? Run history and quality reports for them are removed.") — ux-contracts §3. | Major |
| 3.6 | Pickers keyboard-operable; selected state = glyph + text, never fill alone (R4-A3, R3-A3). ≥44px targets on every interactive row (04_TOKENS floor). | Major / Minor (sub-44px) |

### How to verify

- Tab walkthrough of the rendered flow in `pnpm dev`: every focusable shows the shared `brut-focus` ring; the ink offset comes from the shared utility (precedence table) — if it's missing, the finding is against `brutalist-utilities.css`, not the component. Tab order = visual order; Escape closes overlays and returns focus.
- `@testing-library/svelte` test (jsdom, `// @vitest-environment jsdom`, doc-comment citing the ux-contracts §3 block): `getByRole` step assertions for `aria-current="step"`, `document.activeElement` lands on the new heading after transition.
- Flow-shape changes: fields-per-panel table (before → after) in the PR body; a new panel added without a net field cut is challenged under 3.1.
- `pnpm check` (svelte-check) clean on changed files.
- axe-core scan (axe DevTools browser extension — a required manual step, not yet in CI) on each wizard panel: the reviewer runs it and pastes findings in the PR; serious/critical findings are rubric Major.

## 4. AI trust patterns: citations, runs, abstention

| # | Rule | Severity if violated |
|---|---|---|
| 4.1 | **Cite passages, not documents.** A citation resolves, on click, to the Evidence dossier with the bound span highlighted (ux-contracts §2 Evidence dossier row). A citation that can't resolve says so ("Source passage no longer available") — never silently dropped. | Blocker (fabricated state) |
| 4.2 | Provenance is progressively disclosed: inline marker + source count ("From 3 of your documents") → hover/tap quote preview → click for the full dossier. Never front-load a citation panel on a novice surface. | Major |
| 4.3 | **Words over numbers for support.** Use the registry vocabularies verbatim: EBV states (supported / inferred / unverified / contradicted / excluded) and Operator verdicts (Supported / Weak / Unsupported / Pending — "Rejected" is retired). No new confidence percentages, no second trust formula — the trust number is only ever **quoted from the Trust scorecard** (W2.3 single source; a second formula is a rubric Blocker). | Blocker |
| 4.4 | Long-running ingest runs show **named real stages + honest unit counts** ("Reading your documents — 214/500 pages"), never a percent or bar not derived from counted units. ETAs are ranges ("usually 1–3 minutes"), never precise promises. Per-document status rows: done / working / failed-with-reason / retry. Partial results are kept and shown. | Major |
| 4.5 | At ~20s+, offer background continuation ("We'll keep working — you can explore meanwhile") with the durable surface being Runs (`/runs/[id]`, LiveRunChip in the topbar). Run failure names the actual event per item ("2 of 14 pages couldn't be read — the PDF is scanned images"), plus one concrete next step. Generic "ingestion failed" after a long wait is banned. | Major |
| 4.6 | **Abstention is a feature.** When retrieval finds nothing: scoped refusal naming the boundary + what was searched + one recovery action — "Not found in your 12 documents yet. Add a source about X, or try asking about Y." Never a generic apology, never a dead-end (ux-contracts recovery floor). Don't hedge answers that are well-supported. | Major |
| 4.7 | A "verified" mark answers *who/what verified it, against which source, and when* on click (Guru/Glean precedent — maps to the Evidence dossier chain of custody). Binary verified/unverified chips suit the brutalist system: hard-border chip + glyph + word, never colour-only (R3-A3). | Major |

### How to verify

- getByRole test: citation link/button has an accessible name naming its source; clicking (fireEvent) opens the dossier dialog (`getByRole("dialog")`, `aria-modal`, Escape/focus-return — DossierRail.test.ts pattern).
- Fixture run with one failed document: screenshot the per-row reason + retry affordance + kept partial results.
- Reduced-motion emulation (devtools): LiveRunChip and any run animation render their static informative fallback.
- Abstention screenshot: refusal names the searched scope and shows exactly one recovery CTA.
- Diff review (human check — no mechanical gate): no new confidence percentage or locally computed trust number anywhere in the diff — the only trust figure is quoted from the Trust scorecard (4.3); provenance layering (4.2) is likewise reviewer-checked.

## 5. Jargon translation (first-contact layer)

Registry nouns (ux-contracts §2) are canonical and stay. This table governs the **first
occurrence per surface** on novice-facing sections (Home, Sources first-run, Runs first-run,
Claims first-run, Agents first-run): pair the term with its outcome line, or keep the term
out of the primary layer entirely.

| Internal term | First-contact treatment | Where the raw term may appear |
|---|---|---|
| Ingest / Ingest run | CTA stays **"Ingest"** (registry). Supporting line on first contact: "Turn your documents into cited answers." Never "ingestion pipeline" in primary copy. | Everywhere (canonical noun) |
| Knowledge graph / graph | Primary copy: "your documents, connected" / "key facts from your documents". Section label is **Claims**, never "Graph" (registry D2). | "Graph store" only in Foundation/settings depth |
| Claims | First visit to the Claims section (`/claims` target IA) defines it inline: "Key facts we found in your documents — each with its source." | Everywhere after first definition |
| Verify / verification / EBV | "Checked against your documents." EBV state labels stay verbatim (4.3); the acronym "EBV" never appears in UI. | State labels; dossier depth |
| MCP | Primary CTA: "Connect an agent". First use of the noun expands it: "MCP (the connector most AI agents use)". | Agents catalogs, code snippets, docs depth |
| Embedding, vector, index, triple, entity, corpus, RAG | **Never user-visible.** Surfaces as "Getting ready" / "Reading your documents". | Nowhere in UI |

**Do not** invent synonyms for registry nouns to "simplify" them — that recreates the
vocabulary drift W4.5 exists to kill. Translate by *adding the outcome line*, not by renaming.

### How to verify

- `git diff --name-only origin/main...HEAD -- apps/dashboard/src | xargs grep -riE 'knowledge graph|embedding|vector|corpus|triple\b|\bRAG\b'` — hits allowed only in Foundation/depth surfaces named in the PR.
- Screenshot each first-run surface: every table-listed term visible carries its outcome line.

## 6. Microcopy rules

Extends ux-contracts §2 CTA grammar. Registry rows govern nouns; this section governs sentences.

| # | Rule | Severity if violated |
|---|---|---|
| 6.1 | Body copy: active voice, second person, present tense. Sentences ≤25 words; reading grade ≤8 (Flesch ≥60). "We're reading your documents", not "Documents will be processed". | Minor |
| 6.2 | Error grammar template, no exceptions: **[what happened, specific] + [what to do next]**, rendered adjacent to the source, user input preserved. No codes-only, no blame tone, no humor. | Major |
| 6.3 | Loading copy names the work + expectation: "Reading your document… usually under a minute." A bare spinner is banned (§3 loading floor + this). Completion says what happened, announced via `role="status"` `aria-live="polite"`. | Major |
| 6.4 | Labels are visible noun phrases above the field; helper text is a visible sentence outside the field. **Placeholders never carry instructions** (they vanish on focus). | Major |
| 6.5 | i18n (UK/EU): whole-sentence strings only — no concatenation or mid-sentence splicing; assume +35% expansion for sentence-length strings and **2–3× for short labels/buttons** (under ~10 characters — W3C i18n), and test mono labels/fixed-width brutal buttons with expanded strings; no idioms or wordplay; dates DD Month YYYY. | Major |
| 6.6 | Uppercase as authored content is reserved for ledger labels and short operational nouns (X12). Errors, CTAs, helpers: sentence case in the authored string — buttons render uppercase via `.btn` `text-transform` (chrome, per 04_TOKENS §Buttons, not content). | Minor |

Good/bad pairs (use these as the register):

| Bad | Good |
|---|---|
| "Error 422: ingestion failed." | "We couldn't read that file — it may be password-protected. Remove the password and try again." |
| "No data." | "No claims yet. Ingest a document and the key facts we find — each with its source — appear here." |
| "In order to get cited answers, you first need to add documents." | "Add a document to get your first cited answer." |
| "Get started" | "Ingest your first document" |
| Spinner, no text | "Reading your documents… usually 1–3 minutes." |

### How to verify

- Readability pass on new body strings with a scoring tool (npm `text-readability` or Python `textstat`) against the ≤25-word / grade-8 caps; quote the worst sentence + its score in the PR.
- Render forms with expanded pseudo-strings: +35% on sentences, 2–3× on short labels/buttons — no clipping at 892px.
- Diff review: every new error string parses as [happened]+[next]; every loading state has copy; no instructional placeholders (`grep -rn 'placeholder='` over the changed files and read each).

## Anti-patterns

- A tour/checklist shipped *instead of* fixing the unclear surface — evidence says effort belongs in the UI, not the tutorial.
- Two yellow CTAs "because both matter". Pick the spine action; demote the other.
- A percent bar animated on a timer rather than derived from counted units.
- Numeric confidence scores ("87% confident") on novice surfaces — words + the registry state vocabularies only.
- Explaining Verify/Store depth to a user with an empty graph (violates 2.1/2.4).
- Renaming registry nouns to be "friendlier" instead of adding the outcome line (§5).
- Fabricated `0`, hidden broken citations, or a locally computed trust number — all Blockers.

## Workflow

1. Read this skill + the governing ux-contracts §2 rows and §3 blocks before touching a dashboard surface or string.
2. Draft states first (empty/loading/error/success + reveal predicates), copy second, chrome last (chrome rules: restormel-neu-brutalist-ui).
3. Run the per-section "How to verify" checks for every rule-group your diff touches; paste evidence (screenshots, grep output, test names) in the PR.
4. Classify any deviation against the rubric ladder; Blockers and Majors block merge, Minors are filed + named in the PR.

## Related skills and docs

| Resource | Use for |
|---|---|
| [restormel-neu-brutalist-ui](../restormel-neu-brutalist-ui/SKILL.md) | Visual chrome: borders, shadows, tokens, Brutal* primitives |
| [docs/design/ux-contracts.md](../../../docs/design/ux-contracts.md) | Canonical nouns, CTA grammar, §3 state contracts, §A redirect map |
| [docs/reviews/wave-r-design-usability-rubric.md](../../../docs/reviews/wave-r-design-usability-rubric.md) | Severity ladder, X-invariants, per-stage criteria |
| [docs/design/onboarding-handoff/04_TOKENS.md](../../../docs/design/onboarding-handoff/04_TOKENS.md) | Token + accessibility floors (44px, focus ring, reduced motion) |
| `apps/dashboard/src/lib/styles/brutalist-contrast.test.ts` | Contrast audit precedent for new colour pairings |

## Staleness & upkeep

This skill hard-codes facts that can rot: the registry vocabulary (§5 table), the spine
(M0→M1→M4), the target route map (`/home`, `/sources`, `/runs`, `/claims`, `/prove`,
`/agents` — ux-contracts §1/§A; the app is mid-migration until R2–R5 land), the 892px
column, the shipped `.brut-focus` shape (bare yellow outline pending the ink-offset
amendment), and the "axe not yet in CI" caveat. **Update this file in the same PR** whenever:
a registry row this skill quotes changes (W4.5 will catch you if you don't), a spine section
is renamed or re-routed or an R2–R5 route move lands, the `.brut-focus` amendment ships,
axe-core lands in CI (then move the axe check from "manual extension" to the test command),
or the rubric ladder changes. If you find this skill contradicting ux-contracts.md, the
contracts win — fix the skill.