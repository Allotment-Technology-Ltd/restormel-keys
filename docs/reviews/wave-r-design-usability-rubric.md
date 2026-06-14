---
title: Wave R — Design + Usability + Copy Acceptance Rubric
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-12
last-reviewed: 2026-06-13
review-interval: P12M
---

# Wave R — Design + Usability + Copy Acceptance Rubric

*Source: Fable design-direction agent, 2026-06-12. The scoring standard for the R3/R4/R5 PRs.
Every criterion is pass/fail against the diff + the running surface. A criterion that cannot be
evaluated from the PR (no screenshot, no test, no reachable state) is a **fail** — provability is
the product's own thesis; PRs inherit it.*

Standards cited: `docs/design/keys-northstar-redesign-2026-06.md` (NS), `docs/design/ux-contracts.md`
(UXC, incl. §2 registry + §A redirect map), the `restormel-neu-brutalist-ui` skill (SKILL).

---

## R3 — One Home (`/home`)

### Visual fidelity
- **R3-V1 — Masthead order matches NS §3.3.** Top→bottom: trust cap (score numeral + sparkline/history + "last verified") → factor rails → two-column [READY-TO-VERIFY | INBOX] over [RUNS RAIL | AGENT TRAFFIC]. Any panel above the trust cap other than the page header = fail.
- **R3-V2 — Trust cap is a brutal cap, not a strip.** Oversized numeral (≥ `--text-3xl`, weight 900), flat accent fill, `border-radius: 0`, hard offset shadow, no gradients/blur. The shipped `.trust-strip` (1px dividers, 2px shadows) does not meet this; carrying it forward unchanged = fail.
- **R3-V3 — Ledger-row standard (NS §3.2).** Readiness/inbox/runs rows: min-height 44px, square state glyph (■/◪/□ or ▲) PLUS a status word (never colour-only — `ConnectVerifiedReadiness`'s `glyph()`+`statusWord()` is the reference), mono evidence column, right-aligned fix/prove link.
- **R3-V4 — Soft-SaaS regression check.** Diff grep: no `border-radius: var(--rm-radius)` on operator panels, no new 1px-border cards where brutal primitives exist, no Tailwind, no raw hex outside token fallbacks. Legacy `.connect-step`, `.btn{border-radius}`, `.testing-ci-*` idioms must not survive into the masthead.
- **R3-V5 — Retirement visible in the diff.** The two checklists ("Verified context journey" + "Gateway routing setup"), the second trust display, and the StackSetupWizard/Testing-CI disclosure are removed or absorbed into the ledger — not stacked below the masthead. Two checklists anywhere on `/home` = fail.
- **R3-V6 — Responsive.** At 390px the masthead stacks to one column; trust numeral + rows readable; no horizontal scroll. PR includes the three screenshots (first-run, half-ready, steady-state) or it cannot be scored.

### Usability & interaction
- **R3-U1 — Journey B step 1 on one screen (NS §1.2).** Above the fold at 1280×800: trust score (+delta/sparkline), review count, changed-sources count, last-run outcome, regression count. Each absent value → honest absent-state, not a blank.
- **R3-U2 — Every cell is a link (NS §2.4).** Factor rail → filtered Claims queue; inbox rows → desk / memory inbox / regression diff; runs rail → `/runs/[id]`; changed-sources chip → re-ingest; agent traffic → `/logs?source=agent`; readiness rows → `fixHref`. Any dead number = fail.
- **R3-U3 — Grammar affordances distinct.** Prove-it links (dotted underline + ↗) visually distinct from fix-forward rows ({status, evidence, fixHref} + "fix →") and from nav links.
- **R3-U4 — First-run = unlit ledger.** Cold workspace renders the same masthead with unlit (□) rows + one primary CTA into `/sources/ingest`. Any separate onboarding widget/wizard card/"getting started" block = fail.
- **R3-U5 — No dead ends.** Every empty/error panel offers a next action (UXC §3). Check the trust-cap error path — the shipped page swallows it (`{:catch}` renders nothing); silent omission of the masthead number = fail.

### State honesty
- **R3-S1 — Four states per panel, demonstrated.** Loading (skeleton, `role="status"`), error (`BrutalErrorBanner`, `role="alert"`, retry), empty, populated — for each of the five panels. "didn't trigger it" = fail.
- **R3-S2 — No second trust formula.** Masthead quotes the scorecard/W2.3 component only; the W2.6 no-second-formula test survives + passes. Any arithmetic producing a *score* (not a count) in page code = fail.
- **R3-S3 — No fabricated counts.** Changed-sources (W3.6) + memory-pending (W2.4) render explicit absent-state when their data doesn't exist. A hardcoded `0` presented as a measurement = fail.
- **R3-S4 — Readiness ≡ preflight.** The ledger consumes the same rows as the launch gate. Breaking a prerequisite flips the Home row and the flow's preflight together.
- **R3-S5 — No new stats queries.** `+page.server.ts` shows one stats resolution per request (Pivot 1.8); `/activity` + `/connect` 308 and login lands on `/home`.

### Accessibility
- **R3-A1** Each panel a labelled region; heading levels descend without skips (one h1).
- **R3-A2** Keyboard tab order = visual order; `:focus-visible` on every link/row; sparkline has a text alternative.
- **R3-A3** State never colour-only (glyph + word); ink-on-yellow/neon meets AA; pulses guarded by `prefers-reduced-motion`.

### Copy
- **R3-C1 — Registry (UXC §2).** "Home" (not Overview), "Claims" (not Graph — update "Open graph explorer"/"Explore the graph" CTAs), "Ingest run" (not job), "Trust scorecard", "Connections". Cite registry lines for new nouns.
- **R3-C2 — Mono labels are nouns of state.** READY TO VERIFY, INBOX, RUNS, AGENT TRAFFIC; no exclamation marks; evidence strings factual ("7 published", "checked 14:02").

**R3 ship gate:** R3-U1, R3-U2, R3-U4, R3-S2, R3-S3, R3-S5, X4, X7 — *one screen answers the daily loop, every cell links, the unlit ledger is the only checklist, one trust number, nothing fabricated.*

---

## R4 — Sources + wizard-as-flow (`/sources`, `/sources/ingest`)

### Visual fidelity
- **R4-V1** `/sources` uses `BrutalPageHeader`, brutal cards/ledger rows; absorbed `/connect/library` pack tiles must not get softer in transit (diff the styles).
- **R4-V2** The flow renders as a flow, not a tabbed destination: stepper/panel chrome, current-panel glyphs, one primary CTA per panel (yellow = the single advance action).
- **R4-V3** Preflight panel renders K3 rows in the ledger-row standard — identical anatomy to Home's readiness ledger.
- **R4-V4** Responsive: flow usable at 768px; documents degrade to stacked rows, no horizontal scroll.

### Usability & interaction
- **R4-U1 — Golden path = two panels (NS §1.1).** Provisioned workspace: Ingest CTA → sources+pack → preflight+launch. Test asserts panel count; reviewer verifies live. ≥3 panels for provisioned = fail (blocker).
- **R4-U2 — Conditional provider-key panel.** Cold workspace sees provider-key first with K2 live-verify inline (real probe result copy); provisioned never sees it.
- **R4-U3 — Store demoted but reachable.** Default path never shows a store decision; "Configure store" override reachable (honours W3.6 placement) but never blocking.
- **R4-U4 — Launch exits into `/runs/[id]`.** No terminal "success" panel; flow's last act is the handoff. No sidebar entry (flows are not places).
- **R4-U5 — No re-selection.** Pack chosen on `/sources` preselected in flow; selections persist across back/forward (completedIds honesty intact — completed panels show their receipt).
- **R4-U6 — returnTo loop.** Stepping out (e.g. to Connections) returns via the return bar to the same panel with state intact.
- **R4-U7 — Redirects.** `/connect/pipeline?step=*` maps to new panel ids (test table); `/connect/library` 308 → `/sources` Packs view.

### State honesty
- **R4-S1** Changed-source: W3.6 data absent → absent-state ("change detection not yet available" + what to do), never `0 sources changed`. Fabrication = blocker.
- **R4-S2** Preflight rows are real K3 checks or honestly fenced; no green rows for unchecked things.
- **R4-S3** Documents/packs lists: all four UXC §3 states each with a recovery action; empty documents explains what to add + links the way in.
- **R4-S4** Scope fences: no new preflight logic (K3 owns), no store-panel logic changes beyond placement (W3.6 owns). Violation = major.

### Accessibility
- **R4-A1** Stepper announces progress (`aria-current="step"`); panel transitions move focus to the new heading.
- **R4-A2** Verify-key result announced (`role="status"`); failure `role="alert"` + recovery.
- **R4-A3** Pickers keyboard-operable; selected state = glyph + text, not fill alone.

### Copy
- **R4-C1** Registry: "Sources", "Domain pack", "Ingest run", "Graph store" (not target/connection), CTA verb "Ingest". Panel titles imperative ("Point at sources", not "Configuration").
- **R4-C2** Receipt copy for automated acts: each automated step prints what it did ("Created 7 ingest routes (published) — view"). Invisible automation = major.

**R4 ship gate:** R4-U1, R4-U2, R4-U4, R4-S1, R4-S4, R4-U7, X5, X7 — *two panels to launch when provisioned, store never blocks, changed-source honesty, redirects carry `?step`.*

---

## R5 — Agents + Prove + Routes Ingestion

### Visual fidelity
- **R5-V1** `/agents` + `/prove` use exactly ONE tab level (Wiring·Catalogs; Proof·Traces·Audit·Share); tab strip in the brutal idiom; no second-level tabs inside any tab.
- **R5-V2** Moved pages don't drift: mechanical moves only; style rewrite of moved content beyond mount plumbing is flagged (W4.4's sweep, not R5's).
- **R5-V3** Traces tab uses the ledger-row standard (44px rows, mono timestamps newest-first, right-aligned export).

### Usability & interaction
- **R5-U1 — Journey C reachable (NS §1.3).** From `/prove`: proof comparison, a trace + its export, the audit log — each ≤2 clicks from the section root. Audit deep link from `/access` still works.
- **R5-U2** Routes "Ingestion" view: per-stage rows + create + return-bar behave as on `/connect/models` (tests moved, not rewritten); "Draft — publish to use" → builder Versions tab; Home readiness `fixHref`s land here.
- **R5-U3** Agents Wiring keeps the key handoff (copy-once MCP config; key masked, never logged); Catalogs reaches every former `/dev-tools/*` artifact; Agents links to the Request tester.
- **R5-U4** Old URLs (`/connect/mcp`, `/connect/proof`, `/access/audit`, `/connect/models`, `/dev-tools/*`) 308 to the correct tab (verify against UXC §A, don't re-implement).
- **R5-U5** Tab state URL-addressable (`/prove?tab=audit` or path-based) so prove-it links target a specific tab; back returns to the prior tab.

### State honesty
- **R5-S1 — Share tab honestly gated.** States plainly that public share is pending a security decision (D7/W4.3 STOP); no mock preview, no fake URL, no teaser implying it works. Interactive-looking disabled control = major.
- **R5-S2** Traces tab: empty (what produces one), error+retry, populated with cursor/limit honesty ("showing latest N"). No trace-detail visualisation (scope fence).
- **R5-S3** Audit tab: no new filters (K1/W3.7); truncation, if persists, is stated ("latest 50 events"), not silent.
- **R5-S4** No catalog-generation changes (W2.4 owns) — diff check.

### Accessibility
- **R5-A1** Tabs implement the ARIA tabs pattern (or real links with `aria-current`), consistently in both sections.
- **R5-A2** Trace/audit tables have proper headers or list semantics; export links name their object.

### Copy — buyer/auditor lens (weighted for R5)
- **R5-C1** Registry: section "Prove" (tab "Proof" — don't swap), "Agents", "Ingest routes" inside Routes.
- **R5-C2 — Prove reads as proof, not plumbing.** Each Prove tab's intro line parseable by an outside auditor with zero Restormel context. Internal jargon (EBV, G2, K-stage names, "graph store", "workload") may not appear unexplained in Prove headers/intros; verdicts use registry verification-state vocab (supported/inferred/unverified/contradicted/excluded) with plain glosses.
- **R5-C3** Claims assert only what the claims-ledger rows prove — no "tamper-proof"/"guaranteed"; numbers carry denominators ("41 of 612 unbound").
- **R5-C4** Audit framing as a proof artefact ("who did what, when, with which key"), not key-management housekeeping.

**R5 ship gate:** R5-U1, R5-U2, R5-S1, R5-S4, R5-C2, X5, X6 — *auditor reaches proof in two clicks, ingestion view behaves identically, Share honestly gated, Prove reads as credible proof, one tab level.*

---

## CROSS-CUTTING (all three PRs)
- **X1 — Token discipline.** No Tailwind; no raw hex except token fallbacks; only `--rm-*`/`--brut-*`/`--color-*`/`--state-*`; `scripts/check-brutalist-tokens.sh` passes.
- **X2 — Brutal surface invariants.** `border-radius: 0`, ink borders ≥2px, hard offset shadows (zero blur), flat fills, mono uppercase operational labels, `brut-pressable`/`brut-focus` on interactive cards. Yellow only as CTA/accent.
- **X3 — Primitive reuse.** Loading=`BrutalLoadingState`, error=`BrutalErrorBanner` (with actions snippet), empty=`EmptyState`, headers=`BrutalPageHeader`. Reinvented equivalent = fail.
- **X4 — Link-grammar completeness (NS §2.4).** Sample 5 status-bearing numbers/badges; each links to evidence (prove-it) or a fix. One orphan status = major; three = blocker.
- **X5 — No orphan surfaces.** Everything mounted reachable via nav/ledger link/account menu; everything unmounted redirects per UXC §A with query params preserved (`?step`,`?filter`,`?unit`,`?workspace`,`?focus`) + a redirect test.
- **X6 — One tab level, ever.** No tabs-inside-tabs anywhere, including incidental.
- **X7 — State-contract completeness.** Every new panel: loading/empty/error/populated each implemented + truthful + ≥1 recovery action on error/empty. Reviewer triggers ≥ error + empty per surface.
- **X8 — Poll diet (PERF).** No new polling intervals, no duplicated stats/scorecard fetches; streamed `Promise` props preserved. Diff `+page.server.ts` for added queries.
- **X9 — Reduced motion.** Every added animation has a `prefers-reduced-motion: reduce` guard.
- **X10 — Focus + keyboard.** Every interactive element reachable + visibly focused; ≥44px targets; Escape closes any overlay introduced.
- **X11 — Copy registry citation.** PR body cites the UXC §2 registry line for every surface noun/CTA introduced/changed. Missing = minor; contradicting = major.
- **X12 — Voice.** Sentence-case body; uppercase mono for ledger labels only; honest hedges where data is partial; never blame the user; destructive confirms state blast radius.

---

## Severity scale
| Severity | Definition | Merge effect |
|---|---|---|
| **Blocker** | Breaks a thesis invariant: fabricated state, second trust formula, dead-end status, broken redirect/param loss, golden path >2 panels, orphan surface | Must fix before merge |
| **Major** | Violates a contract (UXC §3 state missing, registry contradiction, scope-fence breach, a11y barrier, soft-SaaS regression on an operator surface) | Fix before merge unless explicitly waived with owner sign-off |
| **Minor** | Localised drift: one mislabeled noun, missing citation, sub-44px target, inconsistent affordance | Fix-forward issue filed, named in PR |
| **Polish** | Aesthetic nits within the system | Optional; batch for W4.4/W4.5 sweeps |

**Default merge bar (this autonomous run):** block merge on any **Blocker or Major**; **Minor/Polish** are fix-forward (filed, named in PR, not merge-blocking).
