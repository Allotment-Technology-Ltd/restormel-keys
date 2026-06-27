---
title: "Connect dashboard redesign — Claude Design prompt (the verified-graph spine)"
class: technical
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-27
last-reviewed: 2026-06-27
review-interval: P6M
---

> Copy-paste-ready prompt for **Claude Design** to generate high-fidelity mockups of the
> redesigned **Connect knowledge-pipeline dashboard**. It implements §4 of
> `connect-pipeline-ux-review-2026-06-19.md` (the five-stage "Build your verified graph"
> spine). **Run it inside the "Restormel Dashboard" design-system project** so Claude Design
> builds with the product's REAL components and tokens (see the design-system block below) —
> that project was synced from the live dashboard via `/design-sync`.

---

== HOW TO USE THIS PROMPT ==
Open (or attach) the **"Restormel Dashboard"** design system in Claude Design, then paste
everything from "Design high-fidelity mockups…" onward. Claude Design will reuse the real
cards (RoutePipelineStrip, ProjectReadinessCard, SetupChecklist, ConnectPipelineWizard, …)
and the real tokens, so the output maps 1:1 onto shippable Svelte code. **Do not let it
invent a fresh visual language** — the design system IS the visual language.

---

Design high-fidelity mockups for the redesigned **Connect** dashboard of **Restormel Keys**, a
BYOK (bring-your-own-key) AI gateway. **Connect** is the product surface where a user points the
system at their documents, it builds a verified knowledge graph, they check it, and they turn it
on so their app/agent can consume it. The redesign replaces five disconnected surfaces (a setup
wizard, a run console, a 6,765-line graph explorer with hidden sub-wizards, a graph library, a
route builder) with **ONE visible spine**: a five-stage ledger that is always on screen, tells
the user exactly where they are and what the single next action is, and never shows a button that
silently does nothing.

== USE THE DESIGN SYSTEM (do not re-invent — these are the product's real parts) ==
Build every screen from the **"Restormel Dashboard"** design system in this project. Its look is
**neo-brutalist**; use its real tokens, never hand-picked values:
- **Canvas** `--color-bg` warm cream `#f3ead0`; **card/input surface** `--color-surface` `#fffef0`.
- **PRIMARY accent / main CTA fill** = `--color-yellow` `#ffd600` with **black text** (this is the
  product's primary — NOT teal).
- **Success / verified / "ready" signal** = `--signal-teal` `#2ec4b6`; **warning/insight** =
  `--amber-insight` `#ffb84d` / `--brut-amber`; **error** = `--coral-alert` `#f25c54` /
  `--brut-coral`. State chips: `--state-ok-*`, `--state-warn-*`, `--state-fail-*`.
- **Ink / borders / shadows** = `--color-ink` `#0c0c0c`. Borders are **2px solid ink, hard
  90° corners, radius 0**. Shadows are **hard offset, no blur** (`--shadow-sm/md/lg` =
  `3/5/7px 3/5/7px 0 ink`). Buttons press into their shadow on click.
- **Type**: display = **Barlow Condensed** (`--font-display`, chunky uppercase headings); mono =
  **Space Mono** (`--font-mono`, labels / status / model IDs / metadata — UPPERCASE); body =
  **DM Sans** (`--font-body`). Buttons are mono, uppercase, 12px, 700, tracking 0.06em.
- Spacing on the `--space-*` scale; generous and grid-aligned — a confident engineering tool,
  not a soft SaaS dashboard.

**Reuse these real component cards (compose screens from them, don't redraw them):**
- Spine / dashboard surfaces: **RoutePipelineStrip**, **ProjectReadinessCard**,
  **RouteCoverageIndicator**, **SetupChecklist**, **QuickActions**, **LiveRunChip**.
- Ingest wizard surfaces: **ConnectPipelineWizard**, **PipelineWizardStepper**,
  **ConnectSourcesPanel**, **ConnectProviderKeyPanel**, **ConnectPipelineReviewLaunch**.
- Primitives: **BrutalButton**, **BrutalBadge**, **BrutalCard**, **BrutalInput**,
  **BrutalBentoGrid**, **BrutalErrorBanner**, **BrutalLoadingState**, **BrutalPageHeader**.
- Shell: **AppLogo**, **CommandPalette**, **EmptyState**, **UserMenu** (frame screens in the shell).

== THE SPINE (the one idea — present on EVERY Connect screen) ==
A single persistent horizontal/vertical ledger of five stages, current stage highlighted, with
**exactly one primary (yellow) CTA** for the active stage. Build it from the **SetupChecklist** /
**RoutePipelineStrip** pattern. The five stages and their state come from data the product already
computes:
```
①  CONNECT      store + provider + routes      [✓ done]      teal check
②  INGEST       run on your documents          [✓ done]      teal check
③  MAKE READY   link · embed · validate        [▸ DO THIS]   yellow CTA — the active stage
④  REVIEW       triage flagged claims          [12 LEFT]     amber count badge
⑤  GO LIVE      publish routes for your app    [▢]           inert until ④ clears
```
Each tile links to where that work happens. The spine is the answer to "where am I / what's next"
that the old UI never gave.

== SCREENS TO PRODUCE (6) ==

SCREEN 1 — CONNECT HOME (the spine + status, the hero frame).
The shell (AppLogo, UserMenu) framing a **BrutalPageHeader** "CONNECT", the five-stage spine
across the top, and below it a **ProjectReadinessCard** ("Your verified graph: 1,204 ideas ·
842 unchecked · 12 flagged") plus a **QuickActions** row. Stage ③ MAKE READY is highlighted as
the active stage with a single yellow "[ MAKE READY → ]" CTA. Show a **LiveRunChip** ("INGEST ·
stage 4/7 · running") if a run is live. No wall of equally-weighted buttons — one primary action.

SCREEN 2 — INGEST WIZARD (stage ②, provider → sources → domain → launch).
A **ConnectPipelineWizard** framed by the spine (stage ② active) with a **PipelineWizardStepper**
showing the four steps. Show the **ConnectSourcesPanel** (sources connected, documents checked)
and a **ConnectProviderKeyPanel** (provider key, "verified on save" teal chip) as the active step,
then the **ConnectPipelineReviewLaunch** review+launch step with one yellow "[ LAUNCH INGEST → ]".

SCREEN 3 — RUN CONSOLE (watch one run).
A stage odometer of the 7 ingest stages as a **RoutePipelineStrip** with a **LiveRunChip** and a
mono SSE-style progress log in a **BrutalCard**. On completion show a teal success banner and TWO
honest CTAs (fixing today's mislabelled "New run"): a yellow **[ MAKE READY → ]** (the real next
step) and two secondaries **[ RE-RUN THIS CORPUS ]** (same documents) and **[ INGEST DIFFERENT
DOCUMENTS ]**. Never a single ambiguous "New run".

SCREEN 4 — MAKE READY (stage ③ — the promoted sub-wizard, the key fix).
The spine (③ active), title "MAKE YOUR GRAPH READY", and a **cohort selector** top-right
("[ WHOLE WORKSPACE ▾ ]" — visible, not hidden). Below, a **linear checklist with ONE active
step** (SetupChecklist pattern):
```
■ LINK ideas to their sources       1,204 / 1,204 linked     ✓ teal done
■ EMBED ideas for retrieval         1,204 / 1,204 embedded   ✓ teal done
□ VALIDATE unchecked ideas          842 unchecked            ▸ [ VALIDATE 842 ]  ← single yellow CTA
   > details (Catalog / Clusters)  — collapsed disclosure
```
CRITICAL — show the honest-button states (this is the whole point): render one step's CTA
**DISABLED with a visible mono reason** ("LOADING OPTIONS…" using **BrutalLoadingState**) and
another disabled with "ALL IDEAS ALREADY EMBEDDED". **No clickable-but-inert buttons anywhere.**
Show the persistent active-cohort banner state ("OPERATING ON RUN 1 — 100 IDEAS · [ SWITCH TO
WHOLE WORKSPACE ]") as a thick-bordered amber strip.

SCREEN 5 — REVIEW (stage ④ — triage flagged claims).
The spine (④ active, "12 LEFT" badge). A list of flagged claims as **BrutalCard** rows, each with
mono claim text, a source snippet, and three uppercase verdict buttons keyed A / W / U
(ACCEPT / WEAK / UNSUPPORTED) using **BrutalButton** + **BrutalBadge**. Show one row mid-verdict
with a resilient "SAVING…" state (not optimistic-flip-back). A teal "0 LEFT — REVIEW COMPLETE"
end state advances the spine to ⑤.

SCREEN 6 — GO LIVE (stage ⑤ — one-click recommended publish).
The spine (⑤ active). Make **"USE RECOMMENDED PRODUCTION SETUP"** the single primary path: one big
yellow "[ PUBLISH RECOMMENDED ROUTES → ]" button with a **RouteCoverageIndicator** showing the 7
stages it will publish ("extraction · grouping · validation · remediation · embedding · …") all
turning teal. Below, a collapsed "> ADVANCED: configure routes individually" disclosure (the
old per-stage Setup→Flow→Versions three-save path, demoted). After publish, show the LIVE state:
teal "● GRAPH LIVE" + a mono "how to consume it" snippet (endpoint / key) in a dark code panel.

== THE FLOW THE MOCKS MUST TELL ==
CONNECT HOME (see the whole journey) → INGEST WIZARD → RUN CONSOLE (watch) → MAKE READY (link →
embed → validate, one step at a time, honest buttons) → REVIEW (triage) → GO LIVE (one-click
publish). The spine is the constant; every screen shows the same five tiles with the current one lit.

== DO NOT INCLUDE (the removed complexity — its absence is the redesign) ==
- NO wall of equally-weighted buttons; exactly ONE primary CTA per stage.
- NO clickable-but-inert buttons — every action is enabled-and-works or disabled-with-a-reason.
- NO "ghost" readiness run: when there are 0 unchecked ideas, show "GRAPH FULLY VALIDATED —
  NOTHING TO COHORT", never a mintable empty run.
- NO three separate tabs (Triage / Clusters / Tools) with the real work hidden in the third —
  MAKE READY is its own first-class screen.
- NO three-save per-stage publish as the primary path (it lives only behind "Advanced").
- NO terminology sprawl on screen: one noun per concept — "ideas" (not units/claims), "Link
  sources" (one label), "Re-run this corpus" (not "New run").
- NO soft shadows, rounded corners, or generic SaaS chrome — it must read as the Restormel
  neo-brutalist product.

== DELIVERABLE ==
Six high-fidelity desktop frames (~1280px wide) built from the Restormel Dashboard design system,
on the cream canvas, that read as one continuous "here is the whole journey, here is the one next
thing" story. Prioritise **SCREEN 1 (CONNECT HOME / spine)** and **SCREEN 4 (MAKE READY)** as the
hero frames — they carry the core fix (a visible spine + honest, one-at-a-time actions). Show the
disabled-with-reason button states and the active-cohort banner explicitly so the honesty model is
legible.
