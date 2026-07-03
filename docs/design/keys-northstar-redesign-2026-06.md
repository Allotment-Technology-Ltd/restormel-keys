---
title: Keys north-star redesign — June 2026
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-12
last-reviewed: 2026-06-13
review-interval: P12M
---

# Keys north-star redesign — June 2026

**Status:** DESIGN APPRAISAL — presented for product-owner sign-off. No code changes; no
structural work fires until the open decisions (§6) are resolved.
**Brief (product owner, 2026-06-11, verbatim):** *"nothing should be off the table in terms of
actually redesigning functionality and user journeys, and reappraising every aspect, location and
connection between pages, and the layout of the dashboard, to bring it up to standard"* —
Restormel Keys functionality designed to the highest standard, with **Connect as the primary use
case and Keys as its enabling core.**

**Foundations** (this document builds on them and does not repeat them):
[`dashboard-ux-review-2026-06.md`](../reviews/dashboard-ux-review-2026-06.md) (**UX** — IA map,
journey friction, the five signature proposals),
[`dashboard-functionality-review-2026-06.md`](../reviews/dashboard-functionality-review-2026-06.md)
(**FUNC** — route inventory, capability gaps),
[`keys-core-journey-review-2026-06.md`](../reviews/keys-core-journey-review-2026-06.md)
(**KEYS** — the Keys⇄Connect seam, the readiness-ledger thesis, Wave K),
[`dashboard-latency-taskforce-2026-06.md`](../reviews/dashboard-latency-taskforce-2026-06.md)
(**PERF** — PR #259 merged: region pin to London, hooks memoization, poll diet; the latency was
geometry + chattiness, not compute, so this redesign assumes a fast baseline, must not regress
the poll diet, and treats Coolify self-host as the eventual compute path, not a prerequisite),
[`dashboard-world-class-roadmap.md`](dashboard-world-class-roadmap.md) (**W-stages**),
[`ux-contracts.md`](ux-contracts.md) (re-baselined by W1.1), the
`restormel-neu-brutalist-ui` and `restormel-keys-vs-platform` skills, and
[`keys-routing-contract.md`](../architecture/keys-routing-contract.md).

**Delivery state at time of writing** (verified against `origin/main` git log, 2026-06-12):
merged — W1.1–W1.7, W2.1, W3.4 (PR #256), W3.8 (PR #255), the latency taskforce (PR #259);
in flight — W2.4, W2.6, K2, K3. Everything else in the W/K programme is staged but unfired.
§4 reconciles this proposal against all of it.

**The one-line thesis.** The product's centre of gravity moved (Verified Context is the product;
the gateway is its foundation) but the dashboard's skeleton did not: the primary product lives
inside a tab strip inside one sidebar item, the foundation poses as a parallel co-equal product,
and two homes tell two different stories. The redesign is one structural move — **dissolve the
Connect hub into the dashboard itself** — plus the connective tissue the prior reviews already
designed (the readiness ledger, the "Prove it" gesture) installed as the *architecture* rather
than as patches.

---

## 1. North-star journeys

Designed blank-slate, then costed against today. Each journey states the minimal step count,
what is automated vs explicit, and where trust is built. The design rule throughout:
**automate the infrastructure, but print a receipt for every automated act.** A verification
product must never do invisible magic — invisible magic is exactly what it exists to replace.

### 1.1 Journey A — new user → first verified context served to an agent (the golden path)

**Today** (traced in UX IA-3/IA-4, KEYS §1.4): sign in → land on Overview whose checklist is
pure Keys-routing → find Connect → 8-tab hub → Setup wizard (store → domain → sources → launch)
→ discover mid-wizard that provider credentials live on a different page (Connections), that
ingest routes live on a third (`/connect/models`), that an edited route is a silent draft, and
that a gateway key is a fourth surface — **12–15 meaningful interactions across ~7 surfaces,
two disjoint checklists**, with the most likely first-run breaker (provider→project binding,
KEYS K-P0-2) checked by nothing until the run fails 10 minutes in.

**Target: 5 user decisions, 2 surfaces.** Everything else is automated with a ledger receipt.

| # | Step | Who acts | Surface | Trust receipt |
|---|------|----------|---------|---------------|
| 1 | Sign in with GitHub | user | login | workspace auto-created — first ledger row lights |
| 2 | Add one provider key — **verified live on save** | user | guided flow | "Verified against OpenAI — authenticated, 214 models listed" (K2: a real probe, not the placebo) |
| 3 | Point at sources + accept the suggested domain pack | user | guided flow | pack preview: what will be extracted, the quality forecast |
| — | Store, ingest routes, publish, provider binding, encryption check | **system** | — | one receipt per act in the preflight ledger: "Created 7 ingest routes (published) — view" · "Bound openai → workspace project — view" (apply-recommended + K3, finished) |
| 4 | Launch — preflight ledger fully green | user | guided flow | the K3/K4 preflight: ready in the ledger ≡ runnable in the gate; **no late failures** |
| 5 | Watch the run | user (passive) | run console | Machine Room honesty: heartbeat, odometers, stall/reclaim narration (W1.4 → W4.1) |
| — | First dossier offered on completion | system | run console → Claims | "See why this claim is trusted" → quote highlighted in source (W2.2 — falsifiability test) |
| 6\* | Wire the agent: copy-once MCP config with an auto-minted gateway key | user | Agents | the agent's first answer carries the verified-claim envelope → claim URL |

\*Step 6 is the activation moment, not part of the minimum to *produce* verified context —
hence "5 decisions". The flow ends by offering it.

**Where trust is built:** step 2 (the verify button verifies), step 4 (the product predicted
its own success before spending 10 minutes of the user's attention), step 5 (the run narrates
its own survival), the dossier (the user clicks the quote and checks the source *themselves*),
step 6 (the agent's answer is a receipt, not a vibe). Five trust moments on the golden path;
today there are zero before the run completes.

**What this requires that doesn't exist yet:** nothing new — it is exactly K2 + K3 + K4 +
W2.2 + W4.1 mounted on a geography that puts them in one corridor instead of seven rooms.
The redesign's contribution is the corridor.

### 1.2 Journey B — returning operator daily loop

**Today** (UX Journey C, KEYS K-P1-2/-6): the operator's loop is scattered — trust number on
the hub, review queue behind a coincidental deep link, changed sources invisible (Stage 3.2
shipped with no UI), runs list static, regressions terminal rows that link nowhere.

**Target: one glance, three interactions, under five minutes.**

| # | Step | Surface | Trust receipt |
|---|------|---------|---------------|
| 1 | Open dashboard → the Home masthead answers everything at a glance | Home | trust 87 (▲ 2.1) · 12 to review · 3 sources changed · last run ✓ · 0 regressions |
| 2 | Inbox → Stamping Desk: J/K through claims, S/X stamps, evidence inline | Claims | session tally: "REVIEWED 14 · trust +2.1 this session" (W4.2) |
| 3 | "3 sources changed → Re-ingest" chip → incremental launch, preselected | Home → Runs | copy states exactly what incremental re-ingest will and won't touch (W3.6); live-run chip in the topbar tethers the run while the operator moves on |

**Automated vs explicit:** change detection, re-ingest scoping, queue prioritisation, and the
trust recompute are automatic; *stamping a claim* and *launching a run* are deliberately
explicit — those are the two acts where the operator's judgment IS the product.

**Where trust is built:** the session tally makes triage feel like raising the score (it
literally is); a regression row links to the diffed claims (W2.3/W4.3); run attribution proves
cross-family validation actually happened ("validated by anthropic vs openai — cross-family ✓",
K5). The retention loop is the inbox; no other RAG console has one.

### 1.3 Journey C — auditor / buyer proving a claim

**Today:** the spine is 3 clicks deep and ends at a status badge (UX IA-4, D-P0-1, pre-W2.2);
there is no public entry point, no as-of UI, no trace browser, and the audit log shows 50
unfiltered rows.

**Target: 2 clicks from entry to the quoted span — and zero required trust in Restormel.**
The auditor can verify the claim themselves; that falsifiability is the entire pitch.

Three entry points, one destination:

| Entry | Path | What the auditor can verify |
|---|---|---|
| A shared scorecard URL (public share view) | scorecard → factor row "Evidence binding −6.2 · 41 unbound → show the 41" → dossier | the score decomposes into receipts |
| An agent answer's verified-claim envelope | claim URL (`?unit=` — W2.1, shipped) → dossier | this exact answer's provenance |
| A compliance review | Prove → traces + audit log + export | who did what, when, with which key |

The **dossier** (W2.2) is the destination in all three: verdict stamp (validated-at in the
ring) → evidence quote highlighted in source context → "open source ↗" → **Re-check now**
(deterministic Layer-1, no keys) → chain of custody (`SOURCE → SPAN → CLAIM → JUDGE (model id)
→ STATE`) → versions ledger with **as-of** ("what was true on 3 May" — W2.5) → infrastructure
attribution ("served by route X, validated by family Y" — K5) → trace export.

**Where trust is built:** the Re-check button (the auditor presses it and watches the product
re-derive its own verdict), as-of (the product admits what it used to believe), and the audit
log living *on the proof surface* — the IA move in §2 puts `/access/audit` under **Prove**,
because an audit log is a proof artefact, not a key-management appendix.

---

## 2. Target information architecture

### 2.1 Principles

1. **One product, one home.** Connect is not a module you visit; it is what the dashboard is
   *for*. The Connect hub dissolves: its tabs become top-level sections; `/activity` and
   `/connect` merge into one Home. (Resolves UX IA-3 structurally instead of cosmetically.)
2. **The foundation kneels.** Keys surfaces (Connections, Gateway keys, Routes, Guard rails,
   Projects, Model catalog) are grouped as **Foundation** — always reachable, never the story.
   Users arrive there via readiness-ledger fix links far more often than via nav, and leave
   via the returnTo bar. Keys stops being a parallel product and becomes Connect's visible
   floor (the KEYS §3 coherence thesis, made architectural).
3. **Sections are intents, not modules.** Home (state), Sources (what goes in), Runs (the
   machine working), Claims (what came out + the operator's judgment), Prove (show an
   outsider), Agents (consumption). Max one level of tabs anywhere; never tabs-inside-tabs.
4. **A surface is reachable by nav OR by a ledger link; an orphan is a bug.** (Today: eight
   orphans — FUNC §1.)
5. **Flows are not places.** The setup wizard becomes a guided flow launched from Home/Sources
   and exits into Runs; it stops occupying a permanent tab pretending to be a destination.

### 2.2 Target nav tree

```
TOPBAR  [▦ RESTORMEL KEYS]  Workspace ▾   ····   ⌘K Search   [● RUN 2:41]   Help   [▣] avatar
                                                  (palette)   (live-run chip)        (account menu)

SIDEBAR
  ── work ──────────────────────────────────────────────────────────────
  ■ Home        /home          merged Overview + Connect home: trust ledger,
                               readiness ledger, inbox strip, runs rail
  ■ Sources     /sources       documents + domain packs (library) + changed-source
                               state · primary CTA "Ingest" → guided flow
  ■ Runs        /runs          runs list → run console (Machine Room)      [pulse when live]
  ■ Claims      /claims        explorer: review desk, evidence dossiers,
                               memory inbox, as-of                          [badge: review count]
  ■ Prove       /prove         graph-vs-baseline proof · trace browser ·
                               audit log · public scorecard share
  ■ Agents      /agents        MCP/agent wiring · agent gateway keys ·
                               CLI/MCP/AAIF catalogs (dev-tools merged in)
  ── foundation ▸ (collapsed) ────────────────────────────────────────────
  □ Connections     /integrations
  □ Gateway keys    /access
  □ Routes          /routes          all workloads, incl. an "Ingestion" view
  □ Guard rails     /policies
  □ Projects        /projects        gets a nav entry at last
  □ Model catalog   /models
  □ Request tester  /sandbox         workspace-mode tester (W3.2)
  ── observe ▸ (collapsed) ───────────────────────────────────────────────
  □ Logs            /logs
  □ Usage           /analytics
  □ Health          /healthcheck
  ── ───────────────────────────────────────────────────────────────────
  ■ Testing     /testing        unchanged hub (Start · CI snippets)

ACCOUNT MENU (W1.2, shipped): Profile & settings · Subscription · Admin (flagged) · Sign out
ADMIN SHELL (/keys/admin): unchanged, separate; gains the account-menu entry above.
```

Six work sections, two collapsed groups, Testing. Eight Connect tabs + four sidebar groups
collapse into a structure where the golden path is the top of the sidebar read top-to-bottom:
*Home → Sources → Runs → Claims → Prove → Agents* **is** the product loop.

**Naming note — "Claims", not "Graph".** Three reasons: (a) `/keys/dashboard/graph` is already
taken by the Restormel Graph module stub (real collision); (b) the operator's unit of work is
a claim — "graph" describes the storage, not the intent; (c) "Claims" is the noun the entire
verification story already uses (claims ledger, claim versions, verified-claim envelope).
Decision D2 in §6; the registry change rides R1.

### 2.3 Disposition table — every route

Legend: **KEEP** (survives in place) · **MOVE** (same page, new mount/URL with permanent
redirect) · **MERGE-INTO** (content absorbed, route redirects) · **REDESIGN** (page rebuilt) ·
**KILL** (deleted; redirect only where externally linked).

| Current route | Disposition | Target | Notes |
|---|---|---|---|
| `/keys/dashboard` (→ `/activity`) | REDESIGN | redirect → `/home` | one home |
| `/activity` | MERGE-INTO | `/home` | with `/connect`; W2.6 (in flight) is the down payment — see §4 |
| `/connect` (hub Home) | MERGE-INTO | `/home` | trust ledger + readiness + inbox masthead |
| `/connect/library` | MERGE-INTO | `/sources` (Packs view) | a pack is chosen per ingest; it belongs with sources |
| `/connect/models` ("Ingest routes") | MOVE | `/routes` ingestion view | it is genuinely a Keys routing surface; reached day-to-day via ledger fix links, not nav. Registry's "Ingest routes" label survives as the view name. Keep the per-stage create/return-bar pattern intact (KEYS' best seam pattern) |
| `/connect/pipeline` (+ step redirects) | REDESIGN | `/sources/ingest` guided flow | wizard reborn as a flow, not a tab; store step demoted to automated-with-override (workspace Neon default; BYO = option); `?step` preserved by redirect |
| `/connect/ingest` | MOVE | `/runs` | page intact (post-W1.3) |
| `/connect/ingest/[jobId]` | MOVE | `/runs/[id]` | console intact (post-W1.4; W3.1/W4.1 land here) |
| `/connect/ingest/new` | KILL | — | confirms W4.7's default; zero inbound links, duplicates the flow |
| `/connect/graph` | MOVE | `/claims` | explorer intact incl. W2.1 URL contract (`?filter`/`?unit` survive the redirect — acceptance criterion in R2); monolith split is W-stage work already noted, not Wave R |
| `/connect/proof` | MOVE | `/prove` (Proof tab) | joined by traces + audit + share |
| `/connect/mcp` | MOVE | `/agents` | agent setup intact incl. key handoff |
| *(new, W2.4 in flight)* `/connect/memory` | MOVE | `/claims/memory` | inbox lands per its spec, then relocates (nav entry only) |
| `/testing` | KEEP | `/testing` | W3.8 landed here (merged) — unchanged |
| `/integrations`, `/integrations/[id]` | KEEP | Foundation › Connections | K2/K6 land here unchanged |
| `/access` | KEEP | Foundation › Gateway keys | K1 lands here |
| `/access/audit` | MOVE | `/prove` (Audit tab) | an audit log is a proof artefact (journey C); deep link kept from `/access` |
| `/routes` | KEEP | Foundation › Routes | gains the Ingestion view (from `/connect/models`) |
| `/projects`, `/projects/[id]`, `…/routes`, `…/routes/[routeId]` | KEEP | Foundation › Projects | Projects finally gets a nav entry; route builder untouched (W1.5 shipped; W3.5 lands here) |
| `/projects/[id]/usage` | KILL | redirect → `/analytics?project=` | stub that links to Analytics anyway |
| `/policies`, `/policies/[id]` | KEEP | Foundation › Guard rails | |
| `/models`, `/models/[id]` | KEEP | Foundation › Model catalog | |
| `/lifecycle` | KILL | — | honest stub, unlinked; restore when the product exists |
| `/analytics` | KEEP | Observe › Usage | mock-fallback fix stays in W4.7 |
| `/logs` | KEEP | Observe › Logs | W3.3 + K5 source tag land here |
| `/healthcheck` | KEEP | Observe › Health | |
| `/sandbox` | MOVE (label) | Foundation › Request tester | URL stays; W3.2 builds the workspace mode; Agents links to it |
| `/dev-tools` (+ `/aaif`, `/cli`, `/mcp`) | MERGE-INTO | `/agents` (Catalogs) | "CLI & agents" was always consumption-wiring; W2.4's generated MCP catalog mounts here |
| `/copy-for-ci` | KEEP | Testing hub tab | |
| `/copy-for-cli` | KEEP | redirect (already is) | |
| `/cli/connect` | KEEP | out-of-nav functional page | device-code approval |
| `/graph` (Restormel Graph stub) | KILL (from nav) | route may remain as placeholder | leaves the sidebar until Phase 6 ships; frees the "graph" mental slot for Claims |
| `/settings` | KEEP | account menu | |
| `/billing` | KEEP | account menu | W1.6 shipped |
| `/login`, `/logout` | KEEP | — | |
| `/admin`, `/admin/users`, `/admin/package-registry` (legacy 301s) | KILL | — | the 301 targets are stable; one release of grace then delete |
| `/keys/admin/*` (5 consoles) | KEEP | separate admin shell | unchanged |
| `/prototype/brutalist-dashboard` | KILL | — | confirms W4.7 |

Net: 51 routes → **6 work sections + 7 Foundation + 3 Observe + Testing + account/auth/admin**;
5 kills, 9 moves, 5 merges, 2 redesigns, zero orphans.

### 2.4 The connection model — three link grammars

The prior reviews designed the connective tissue; this IA installs it as the *only* three ways
pages reference each other (plus the palette for lateral jumps):

1. **Fix-forward (readiness rows).** Every ledger row is `{status, evidence, fixHref}` (KEYS
   §3 / K4). Home's readiness ledger → any Foundation surface → **returnTo bar** back. The
   `ConnectBuilderReturnBar` pattern (the best seam idiom in the product, per KEYS) is
   generalised: every fix-forward foray gets the return bar. The launch preflight and
   run-failure explanations consume the same rows — "ready", "runnable", and "why it failed"
   can never disagree.
2. **Prove-it (evidence links).** Any number or badge that asserts trust links to its receipt
   (UX §3.5 / W4.3): trust score → factor rails → filtered Claims queue → dossier → quoted
   span → source. Dotted underline + `↗` mono affordance, distinct from nav. This is the
   *downward* grammar (state → evidence) where fix-forward is the *upward* one (state → fix).
3. **Side-task return.** `returnTo` everywhere a flow steps out (flow → builder → flow;
   ledger → Connections → ledger). One implementation, used by grammars 1 and 2.

Rules of composition: **the sidebar names places; ledgers carry state; links carry receipts.**
No page may render a status it cannot link to evidence for (the claims-ledger rule expressed
as IA), and no ledger row may state a problem it cannot link a fix for (ux-contracts §3
expressed as IA).

---

## 3. Layout system — the shell

### 3.1 Appraisal of today's shell

Graded against the neo-brutalist skill and the operator-tool benchmarks (Linear, Vercel,
Stripe):

| Aspect | Today | Verdict |
|---|---|---|
| Sidebar | 3 work items + 3 collapsed groups; no badges except Graph (post-W2.1); groups hide the surfaces the golden path needs at fix-time | structure fine, contents wrong (fixed by §2); needs badge/pulse affordances |
| Second nav layer | 8-tab Connect hub strip — the primary product is two navigation layers deep | the central defect; removed by §2 |
| Topbar | title + ⌘K palette trigger (W3.4, merged) + help links + account menu (W1.2) | search is now solved; the remaining gap is **no live-run awareness** — a 10-minute run is invisible from every other page |
| Detail panels | each surface invents its own (explorer side panel, log drawer, proof drawer) | no standard; Stripe's consistent right-rail is the benchmark |
| Density | brutal primitives are chunky; operator lists drift soft (1px borders, radius — UX F-P1-2) | needs a *ledger-row* density standard so brutal ≠ low-density |
| Content width | per-page ad hoc | needs two standards: reading surfaces vs consoles |
| Mobile | hard gate blocks everything (UX F-P2-2) | read-only tier (W4.6) — checking a run from a phone is a real operator need |
| vs Linear | palette shipped (W3.4); still no **inbox** — review queue + memory writes + regressions are an inbox scattered across three surfaces | the Home inbox strip (§3.2) unifies |
| vs Vercel | no persistent live-status affordance (Vercel's deploy bar) | topbar live-run chip |
| vs Stripe | logs weak (W3.3 staged), no drawer standard | covered above |

The brutalist language itself is **not** the problem — the trust scorecard, setup ledger, and
graph explorer show it carrying operator content with more honesty than soft SaaS chrome.
The problem is that the shell never decided what kind of tool it is. The answer: **an
operations desk** — dense ledgers, one masthead number, a machine you can hear running.

### 3.2 Target shell

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ ▦ RESTORMEL KEYS │ Acme Workspace ▾   ⌘K   ····    [● INGEST 62% · 2:41] ? ▣   │ topbar 48px
├──────────────┬─────────────────────────────────────────────────────────────────┤
│ ■ HOME       │                                                                 │
│ ■ SOURCES    │   content area                                                  │
│ ■ RUNS    ●  │   · reading surfaces: max-width 1200px, left-aligned            │
│ ■ CLAIMS ⑫  │   · consoles (run console, logs, explorer): full-bleed           │
│ ■ PROVE      │   · ledger pages: cap+body overlap cards per the skill          │
│ ■ AGENTS     │                                                  ┌────────────┐ │
│ ──────────   │                                                  │ DOSSIER    │ │
│ ▸ FOUNDATION │                                                  │ RAIL       │ │
│ ▸ OBSERVE    │                                                  │ (standard  │ │
│ ──────────   │                                                  │ right rail │ │
│ ■ TESTING    │                                                  │ drawer)    │ │
└──────────────┴──────────────────────────────────────────────────┴────────────┘
 sidebar 200px, mono uppercase labels, 2px ink border-right, no icons-only mode
```

**Shell elements, specified:**

- **Topbar (48px).** Logo · workspace switcher (future multi-workspace; today a label) ·
  breadcrumb title (existing `topbarTitle`) · **⌘K search button** (W3.4's palette + its topbar trigger, merged — kept as-is) · **live-run chip**: when any ingest run is active, a bordered mono chip
  `● INGEST 62% · 2:41` pulses (reduced-motion: static) and links to the console — the
  operator is tethered to the machine from anywhere; on stall it turns amber (the W1.4
  staleness model, promoted to the chrome) · help · avatar menu (shipped).
- **Sidebar (200px, two zones).** Work zone: six sections, mono uppercase, square active
  marker (■), badge counts (Claims review count — the W2.1 badge relocated; Runs gets a
  live pulse dot). Foundation/Observe collapsed by default (current localStorage persistence
  kept). No hub tab strip anywhere for Connect; the only tab strips left are *within*
  sections that genuinely subdivide (Prove: Proof · Traces · Audit · Share; Agents: Wiring ·
  Catalogs; Testing unchanged). **Rule: one tab level, ever.**
- **Dossier rail.** One shared right-rail drawer component (hard 3px border, offset shadow,
  full-height, 420px, Escape closes, focus-trapped): used by Claims detail (the W2.2
  dossier), log detail, run quick-peek from the runs list, readiness-row detail. Replaces
  three bespoke drawers; W2.2 builds *into* it.
- **Ledger-row standard.** 44px min-height rows, square state glyphs (■/□/▲) + text (never
  colour-only), mono evidence column, right-aligned fix/prove link. All operator lists (runs,
  keys, claims queue, readiness, audit) use it — density with discipline; closes the
  soft-card drift class of findings (W4.4 enforces).
- **Mobile.** The gate opens for a read-only tier: Home masthead, run console, Claims
  read-only (W4.6's list, plus Home). Actions hidden, not disabled-and-teasing.

### 3.3 Home — the masthead page (wireframe)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ████ 87 ████  TRUST        ▁▃▅▆▆▇ 20-verdict sparkline   last verified 2h │  ← W2.3 One Trust
│ cap (neon)                                                                │    Ledger, mounted
├──────────────────────────────────────────────────────────────────────────┤    as the masthead
│ factor rails: −6.2 · Evidence binding · 41 unbound  → [show the 41]      │
├───────────────────────────────────┬──────────────────────────────────────┤
│ READY TO VERIFY (K4 ledger)       │ INBOX                                │
│ ■ gateway key ✓        1 active   │ ■ 12 claims to review   → desk       │
│ ■ provider families ✓  2 (x-model)│ ■ 3 memory writes pending → inbox    │
│ ■ stage routes ✓       7 published│ ▲ 1 regression (run #41)  → diff     │
│ ■ binding ✓ · encryption ✓        │                                      │
│ ■ store ✓ · 132 documents         │                                      │
├───────────────────────────────────┼──────────────────────────────────────┤
│ RUNS RAIL                         │ AGENT TRAFFIC                        │
│ last run ✓ 9m · trust 87          │ 412 verified answers served · 24h    │
│ ▲ 3 sources changed → RE-INGEST   │ → /logs?source=agent                 │
└───────────────────────────────────┴──────────────────────────────────────┘

First-run state: the same page renders the guided flow instead — unlit ledger rows ARE the
checklist (no separate onboarding widget), one primary CTA into /sources/ingest.
```

This single page retires both today's homes, the two disjoint checklists (KEYS K-P1-6), and
the two trust numbers (UX D-P1-1): the checklist *is* the readiness ledger, the trust number
*is* the scorecard service, and every cell is a fix-forward or prove-it link.

---

## 4. Reconciliation — the proposal vs in-flight reality

### 4.1 Stage survival table

| Stage | Status | Disposition under the new IA |
|---|---|---|
| W1.1–W1.7 | merged | **Survive as-is.** Chrome/safety fixes are IA-agnostic. W1.1's contract gets a second re-baseline (R1). |
| W2.1 | merged | **Survives.** `?filter`/`?unit` move with the explorer to `/claims`; R2's redirects must preserve query params (explicit acceptance criterion). |
| W2.4 memory inbox | in flight | **Land as spec'd**, then relocate to `/claims/memory` in R2 (nav entry only — it's a component). |
| W2.6 Overview→verified-context home | in flight | **Land as spec'd** — it is the down payment on R3's merged Home (trust strip quoting the scorecard, parallelised load). R3 then completes the merge and retires `/connect` home. Do not re-point mid-flight. |
| W3.4 palette | merged | **Survives.** R2 updates the command registry + search endpoint to the new section names and URLs (small, named coordination). The palette matters *more* in the new IA — it is the lateral grammar. |
| W3.8 Testing hub | merged | **Unaffected.** |
| K2 verification probes | in flight | **Unaffected** (Foundation › Connections). |
| K3 preflight + bindings | in flight | **Unaffected**; its preflight mounts inside the relocated flow without change. |
| W2.2 Evidence Dossier | staged | **Survives, elevated** — builds into the shared dossier rail (R6 defines it; if W2.2 fires first, its panel becomes the rail's reference implementation). May fire in parallel with R1/R2. |
| W2.3 One Trust Ledger | staged | **Survives; re-targeted** — mounts as the Home masthead (§3.3), not the Connect-hub panel. Fire after R3, or build component-first and let R3 mount it. |
| W2.5 as-of | staged | Survives (Claims). |
| W3.1 SSE | staged | Survives; **gains a consumer** — the topbar live-run chip (R6) rides the same channel. |
| W3.2 request tester | staged | Survives; placement = Foundation › Request tester; Agents links to it. |
| W3.3 logs | staged | Survives (Observe); K5's source tag note unchanged. |
| W3.5 config intelligence | staged | Survives (Foundation › route builder). |
| W3.6 incremental re-ingest UX | staged | Survives; the changed-source chip mounts on **Home + Runs** (was: hub run-chip + runs header) — spec language updates in R1. |
| W3.7 | absorbed | Already absorbed into K1 (per Wave K) — unchanged. |
| K1, K5, K6 | staged | Survive unchanged (Foundation/console surfaces). |
| K4 readiness hub | staged | **Survives, elevated** — its ledger becomes the Home masthead's left panel (§3.3) instead of "a panel on the Connect hub"; the project-page card and Overview-chip mounts in its spec are superseded by R3 (one mount, not three). Re-scope note in R1. |
| W4.1 Machine Room | staged | Survives (`/runs/[id]`). |
| W4.2 Stamping Desk | staged | Survives — becomes Claims' review mode; the Inbox strip is its front door. |
| W4.3 Prove-it gesture | staged | **Survives, elevated** — its link grammar is now structural (§2.4); the public scorecard share view becomes Prove's Share tab (the STOP-gated exposure design should be approved early — decision D7). |
| W4.4 / W4.5 sweeps | staged | Survive; **re-sequenced after Wave R** — they touch every file; sweeping pre-move geography wastes the pass. |
| W4.6 shell hardening | staged | **Split:** error boundaries + auth-redirect consistency fire as-is, any time. The mobile read-only tier folds into R6 (one shell stage, not two). |
| W4.7 hygiene | staged | Survives; two of its open questions are resolved by this appraisal pending sign-off (`ingest/new` → kill, prototype → kill). |

**Cancelled: nothing.** Every fired or staged stage survives; the redesign relocates mounts
(cheap — they are components) and re-sequences two sweeps. This is the payoff of the
programme's component discipline: the IA can move while the work keeps its value.

### 4.2 Migration sequencing — no big bang

The structural work is mostly *relocation*, and SvelteKit makes relocation cheap (routes are
folders; pages are components; redirects are one-liners). Sequenced as one-agent-run stages:

```
Phase 0  (now)        Let the in-flight batch land: W2.4, W2.6, K2, K3.
                      Fire W2.2 in parallel (independent of the IA).
Phase 1  R1           Docs: IA decision record + ux-contracts re-baseline v2.   [after sign-off]
Phase 2  R2           Routes + redirects + nav skeleton. Pages unchanged inside.
                      The product works identically the next morning; only the
                      map changed. Highest-breadth, lowest-depth stage.
Phase 3  R3 ∥ R4 ∥ R5 One Home · Sources section · Agents/Prove assembly.
                      (Disjoint footprints; R2 owns nav-config exclusively so
                      these three never touch it.)
Phase 4  R6           Shell v2: live-run chip, dossier rail, mobile tier.
Phase 5  —            Remaining W/K stages fire in the new geography per their
                      existing batch order (W2.3 and K4 now target Home; then
                      W3.x, K4–K6, W4.1–W4.3).
Phase 6  W4.4, W4.5   The sweeps, alone, last — unchanged rule.
```

Rollback posture: R2 is a pure mapping change (reversible by reverting redirects + nav);
R3 is the only stage that *rebuilds* a page, and it ships behind the same URL with the old
`/connect` home redirecting only when R3 merges — `/activity` and `/connect` can both 308 to
`/home` in one commit, or be staged a release apart if caution demands.

---

## 5. Wave R — proposed stages

Sized like W/K stages: one agent run → one reviewable PR. Numbering continues the programme.
Dependency summary: R1 → R2 → {R3, R4, R5} → R6; R7 is decision-gated and independent.

### Stage R1 — IA decision record + ux-contracts re-baseline v2

```
ROLE
Technical writer-engineer recording the product owner's IA decisions from
docs/design/keys-northstar-redesign-2026-06.md §6 and re-baselining the UX contract so
every Wave R and later W/K stage is graded against the target IA, not the accreted one.
Docs only — no code.

TARGET
ux-contracts §1 describes the TARGET nav tree (§2.2 of the redesign doc) with a
"shipped vs target" status column per surface; §2 registry adds/renames the new
canonical nouns (Home, Sources, Runs, Claims, Prove, Agents, Foundation, Request
tester) and records the Claims-vs-Graph decision; a redirect-map appendix lists every
old→new URL from the disposition table (§2.3) as the contract R2 implements.

FIRST
- docs/design/keys-northstar-redesign-2026-06.md §2 (tree + disposition + grammars)
  and §6 (the owner's recorded decisions — do not proceed on undecided items: mark
  them OPEN in the contract and fence the dependent rows).
- docs/design/ux-contracts.md (the W1.1 re-baseline + changelog idiom — append, same style).
- Re-scope notes flagged in §4.1: K4 (one mount: Home masthead), W3.6 (chip mounts:
  Home + Runs), W4.6 (mobile folds into R6), W2.3 (mount: Home masthead) — edit
  docs/design/dashboard-world-class-roadmap.md and the Wave K section of
  docs/reviews/keys-core-journey-review-2026-06.md is NOT edited (reviews are frozen
  evidence); the roadmap is the living doc and takes the amendments.

ACCEPTANCE CRITERIA
- §1 target tree with per-surface status (shipped / R2 / R3…); §2 registry rows for
  every new noun with non-use synonyms ("Claims, not Graph, for the explorer"); the
  topbar-title table updated to target titles.
- Redirect-map appendix: every route in disposition §2.3 with disposition + target +
  query-param preservation notes (?step, ?filter, ?unit, ?workspace, ?focus).
- Roadmap amendments applied with a changelog block naming this redesign doc.
- Changelog entry in ux-contracts.md (mirrors the W1.1 block).

PROCESS
Docs-only PR. Quote the before/after §1 tree in the PR body. Use effort: medium.
```

### Stage R2 — Route migration, redirects, nav skeleton

```
ROLE
Senior SvelteKit engineer executing the relocation: new top-level routes for the six
work sections, permanent redirects from every old URL, the two-zone sidebar, the hub
tab strip removed. Pages move UNCHANGED inside — this stage is a map change, not a
page change. The product must behave identically except for URLs and nav.

TARGET
/home /sources /runs /runs/[id] /claims /claims/memory /prove /agents live; every
/connect/* and relocated URL 308-redirects per the R1 appendix (query params
preserved); nav-config.ts rewritten to §2.2 (six work items + Foundation/Observe
groups incl. Projects and Request tester); CONNECT_HUB_TABS deleted; in-section tab
strips only where §3.2 allows (Prove, Agents); palette command registry (W3.4)
updated to the new names; the W2.1 review badge moves to the Claims sidebar item.

FIRST
- The R1 redirect appendix (the contract) and docs/design/keys-northstar-redesign §2.
- apps/dashboard/src/lib/nav-config.ts + dashboard-hub-nav.ts (current ground truth;
  hydrateNavGroupsOpen's legacy-key migration is the pattern for persisting the new
  group ids).
- The Connect pages' internal links: grep for href="/keys/dashboard/connect — every
  in-page link updates to the new canonical URL (redirects are for external/bookmark
  traffic, not for the app's own links).
- W2.1's URL params (?filter/?unit) and the wizard's ?step — redirects must carry
  them; add the test.

ACCEPTANCE CRITERIA
- Route-by-route: old URL + params → new URL + params, 308, covered by a redirect
  unit test table driven from the R1 appendix.
- nav-config matches §2.2 exactly; topbar titles per R1; zero references to
  CONNECT_HUB_TABS remain; the sidebar persists group state incl. legacy keys.
- No page component's internals change (mechanical import-path moves only); the
  vitest suite passes without test rewrites beyond paths/labels.
- Kills executed: /connect/ingest/new, /lifecycle, /projects/[id]/usage (redirect),
  legacy /dashboard/admin/* redirect routes, /prototype/brutalist-dashboard —
  each gated on the §6 decisions recorded in R1; skip any still OPEN.
- A crawl test (or route-manifest assertion): every page route is reachable from
  nav, a ledger link, or the account menu — zero orphans.

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
PR: before/after sidebar screenshots + the redirect test table. Use effort: xhigh —
breadth is the risk; depth is deliberately zero.
```

### Stage R3 — One Home

```
ROLE
Senior product engineer building the single home (§3.3): the merged masthead page
that retires the two-homes split, the two checklists, and (with W2.3/K4) the two
trust numbers. W2.6 has landed (verify) — this stage completes what it started.

TARGET
/home renders: trust masthead (W2.3's component if merged, else the W2.6 trust strip
quoting the scorecard service — never a second formula), readiness ledger (K4's
module if merged, else setupHealth + the K3 preflight rows as a degraded-but-honest
ledger), inbox strip (review count, memory pending when W2.4 data exists, latest
regression), runs rail (last run + W3.6's changed-source chip when its data exists),
agent-traffic line. First-run: the same page renders the guided-flow entry with
unlit ledger rows as the checklist. /activity and /connect 308 here.

FIRST
- §3.3 wireframe + §2.4 grammars (every cell is a fix-forward or prove-it link).
- W2.6's shipped implementation (streamed load, trust strip, checklist mapping) —
  extend, don't rebuild; keep its no-second-formula test.
- K4's spec (the row shape {status, evidence, fixHref}) — consume the module if
  merged; otherwise build the panel against the same interface with today's
  setupHealth/preflight inputs so K4 slots in without rework.
- Pivot Stage 1.8 invariant: one stats resolution per request — the merged page must
  not multiply stats calls (the hub already streams; reuse its load).

ACCEPTANCE CRITERIA
- One page answers journey B step 1 (§1.2): trust, review count, changed sources,
  last run, regressions — each linked per the grammars; aria-labelled regions.
- First-run state renders the flow entry; a half-configured workspace shows the
  partially-lit ledger (the checklist IS the ledger — no separate onboarding widget).
- /activity and /connect redirect; login lands on /home; the welcome/signed-out
  behaviour preserved (W4.6 owns the redirect decision).
- No second trust formula (test); no new stats queries (test or code-trace in PR).
- ux-contracts §3 states per panel; suite green.

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
PR: screenshots of first-run, half-ready, and steady-state Home. Use effort: xhigh.
```

### Stage R4 — Sources section + wizard-as-flow

```
ROLE
Senior engineer assembling the Sources section: one place for documents, domain
packs, and changed-source state, with the setup wizard reborn as a guided flow at
/sources/ingest that exits into /runs/[id].

TARGET
/sources: documents list + pack browser (the /connect/library page absorbed as a
"Packs" view) + changed-source state (W3.6's data when present) + primary CTA
"Ingest" → /sources/ingest. The flow keeps the wizard's four panels but re-ordered
per §1.1: provider key (only when missing — K2 verify inline), sources + pack,
preflight + launch (K3 rows); the store step demotes to automated-with-override
(workspace Neon default; BYO store + claim-versions opt-in live behind "Configure
store", honouring W3.6's placement spec). ?step redirects from /connect/pipeline
map to the new panel ids.

FIRST
- ConnectPipelineWizard + panels (post-#190/W1.x state) — relocation and re-ordering,
  not a rewrite; the completedIds honesty model and returnTo loop survive intact.
- connect/library/+page.svelte (the pack browser to absorb) and the
  ConnectGraphStorePanel (the store override + BYO opt-in).
- K3's preflight module (REQUIRED for the launch panel if merged; else the current
  launch gate with a TODO fenced to K3) and K2's verify states for the provider step.
- W3.6's spec for what "changed since last run" the server can answer — degrade to
  absent-state honestly (no fabricated change counts).

ACCEPTANCE CRITERIA
- /sources renders documents + packs + CTA; pack selection state shared with the
  flow (no re-selection); empty states per ux-contracts §3.
- Flow: a fully-provisioned workspace reaches launch in two panels (sources+pack →
  preflight); a cold workspace sees provider-key first; store override reachable but
  never blocking the default path. Step-count assertion in a test (golden path ≤
  the §1.1 decision count).
- Launch hands off to /runs/[id]; the flow is not in the sidebar (flows are not
  places); /connect/pipeline?step=* redirects map correctly (test).
- Scope fence: no new preflight checks (K3 owns), no store-panel logic changes
  beyond placement (W3.6 owns the opt-in card).

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
PR: recording cold-start flow and provisioned two-panel flow. Use effort: xhigh.
```

### Stage R5 — Agents + Prove assembly, Foundation rehoming

```
ROLE
Senior engineer assembling the two composite sections and finishing the Foundation
moves: Agents (MCP wiring + catalogs), Prove (proof + traces + audit + share slot),
and the /connect/models content rehomed as the Routes ingestion view.

TARGET
/agents: the connect/mcp wiring page as the Wiring tab + dev-tools catalogs
(cli/mcp/aaif) as the Catalogs tab (W2.4's generated MCP catalog mounts when
merged). /prove: Proof tab (the comparison page moved), Traces tab (trace list over
GET /connect/v1/traces + the existing export link — the FUNC §3 trace-browser gap,
minimal list+export only), Audit tab (the /access/audit page moved, deep link kept
from /access), Share tab placeholder honestly gated on W4.3's STOP decision.
/routes gains an "Ingestion" view rendering the connect/models per-stage content
(create/return-bar/draft-publish links intact); ledger fixHrefs point here.

FIRST
- connect/mcp, dev-tools/* pages (merge mechanics: tabs, not rewrites);
  connect/proof and access/audit pages (moves); connect/models page + its
  stage-routing loads (the view keeps its server load — only the mount changes).
- The traces endpoints (GET /connect/v1/traces, /traces/[id]/export) — list+open+
  export only; no trace-detail visualisation in this run.
- R2's nav (already final — this stage adds NO nav entries; everything it mounts
  is already routed).

ACCEPTANCE CRITERIA
- Both sections render with one tab level; every absorbed page reachable; old URLs
  redirect (R2's table covers them — verify, don't re-implement).
- Routes ingestion view: per-stage rows + create + return-bar work as on
  connect/models today (tests moved, not rewritten); "Draft — publish to use" links
  to the builder Versions tab (closes KEYS K-P0-3's residue — W1.5 is merged).
- Traces tab: list (newest-first, cursor if the endpoint supports it), open → export;
  empty/error states per contract.
- Scope fence: no Share-view exposure design (W4.3 STOP gate), no audit-log filters
  (W3.7/K1 territory), no catalog generation changes (W2.4 owns).

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
PR: screenshots of Agents, Prove (all tabs), Routes ingestion view. Use effort: high.
```

### Stage R6 — Shell v2: live-run chip, dossier rail, mobile read-only tier

```
ROLE
Senior engineer shipping the three shell upgrades (§3.2) that make the dashboard
feel like an operations desk: the topbar live-run chip, the shared dossier rail,
and the mobile read-only tier (absorbing W4.6's mobile half — W4.6's error-boundary
and auth-consistency halves fire separately, unchanged).

TARGET
(1) Topbar chip: when any ingest run is active — "● INGEST 62% · 2:41" — pulsing
(reduced-motion: static), amber on stall (W1.4's staleness model), linking to
/runs/[id]; fed by W3.1's SSE if merged, else a light poll (30s,
workspace-scoped, one query — within PR #259's poll diet). (2) DossierRail: shared right-rail drawer (hard border, offset shadow,
420px, Escape, focus trap, aria-modal where appropriate) with the W2.2 dossier as
first consumer if merged (adopt its panel into the rail), else the runs-list
quick-peek as the reference consumer. (3) Mobile: the hard gate opens for /home,
/runs/[id], /claims read-only; actions hidden; everything else keeps the gate with
honest copy.

FIRST
- +layout.svelte (topbar + the mobile gate at its current lines), the W1.4
  staleness thresholds (reuse, don't re-derive), W3.1's event shape if merged.
- The three bespoke drawers (explorer detail panel, logs drawer, proof provenance
  drawer) — DossierRail is the standard they migrate to OVER TIME; this stage ships
  the component + ONE consumer; migration of the rest rides W4.4 or the surfaces'
  own next stages (note in each).
- restormel-neu-brutalist-ui (rail styling) and prefers-reduced-motion guards.

ACCEPTANCE CRITERIA
- Chip: appears on any page during an active run; stall state; gone at zero; never
  blocks topbar a11y; component test with mocked status stream.
- DossierRail: keyboard contract (Escape, trap, return focus), one consumer live,
  documented API; COMPONENT-INVENTORY.md entry.
- Mobile: the three surfaces render readably at 390px (screenshots); the gate
  copy elsewhere is honest; touch targets ≥44px on what opens.
- Scope fence: no SSE endpoint work (W3.1), no drawer migrations beyond the one.

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
PR: phone screenshots, chip states, rail keyboard recording. Use effort: high.
```

### Stage R7 — Workspace infrastructure project *(decision-gated: D4)*

```
ROLE
Senior engineer removing the last coincidence on the golden path: Connect's routing
project is whichever project the user happened to have (often the auto-provisioned
Testing project — KEYS §1.3), and bindings exist there only by bootstrap accident.

TARGET
A visible, auto-provisioned "Workspace infrastructure" project owned by Connect:
created on first flow entry (mirroring testing-bootstrap), set as the routing
config's default project, receiving apply-recommended routes and K3's ensured
bindings; the Home readiness ledger names it ("Routing project: Workspace
infrastructure — change"); users with existing custom routing configs keep them
(no migration of existing setups — additive default only).

FIRST
- KEYS §1.4 (the execution chain) + K-P0-2; testing-bootstrap.ts (the pattern);
  stage-routing.ts (routing config defaulting at connect-models-load.ts);
  K3's binding-ensure (REQUIRED dependency — this stage must not duplicate it).
- STOP gate: if K3's implementation already introduced an equivalent default,
  STOP and reconcile rather than adding a second mechanism.

ACCEPTANCE CRITERIA
- Cold workspace: first flow entry provisions the project + routing config;
  idempotent; named row in the readiness ledger with a change affordance.
- Existing workspaces: untouched unless routing config is absent.
- Tests: provisioning idempotency, default-selection precedence, ledger row.

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
Use effort: high.
```

### Wave R dependency summary

| Stage | Depends on | Coordinates with |
|---|---|---|
| R1 | §6 sign-off | edits the W/K roadmap (re-scope notes) |
| R2 | R1 | W3.4 palette registry; W2.1 params |
| R3 | R2; W2.6 merged | W2.3 + K4 (consume if merged; interface-compatible if not) |
| R4 | R2 | K2/K3 (consume if merged); W3.6 spec |
| R5 | R2 | W2.4 catalog; W1.5 (merged — publish links) |
| R6 | R2 | W3.1 (chip transport), W2.2 (rail consumer), absorbs W4.6 mobile |
| R7 | K3 merged; decision D4 | testing-bootstrap pattern |

---

## 6. Open product decisions

Each requires the owner's call before the dependent stage fires. Recommendations attached.

| # | Decision | Options | Recommendation |
|---|---|---|---|
| **D1** | **Dissolve the Connect hub into the dashboard?** The structural core of this proposal: six top-level work sections, one Home, no hub tab strip. | (a) yes, full §2.2; (b) keep the hub, fix only the homes; (c) defer | **(a).** Connect is the product; a product does not live in a tab strip. Option (b) preserves the accretion this appraisal was commissioned to remove. |
| **D2** | **"Claims" vs "Graph"** as the explorer section's name (and `/claims` path). `/graph` is taken by the Graph-module stub. | (a) Claims; (b) Graph (kill the module stub's path claim); (c) Knowledge | **(a) Claims.** The operator's object is a claim; the whole verification vocabulary (claims ledger, claim versions, claim envelope) already says so; no collision. |
| **D3** | **Real URL moves vs label-only renames.** | (a) move with permanent redirects (R2); (b) keep `/connect/*` paths, change nav labels only | **(a).** URLs are product surface; `/connect/` as a prefix is meaningless once Connect is the whole product. Redirect risk is bounded and tested (R2). |
| **D4** | **Workspace infrastructure project** (R7): auto-provision a Connect-owned routing project vs keep selecting among user projects. | (a) auto-provision + ledger visibility; (b) status quo + K3 preflight only | **(a).** K3 catches the binding trap; R7 removes the trap. The Testing bootstrap proves the pattern. |
| **D5** | **Audit log placement:** move to Prove (auditor journey) or stay under Gateway keys. | (a) Prove tab + deep link from /access; (b) stay | **(a).** "The context layer your auditors can read" should put the audit log where auditors look. |
| **D6** | **Usage + Logs:** merge into one "Traffic" surface or keep separate. | (a) keep separate, cross-linked (W3.3 unchanged); (b) merge | **(a) — defer the merge.** W3.3 makes Logs excellent first; merging now couples two stages for cosmetic gain. Revisit after W3.3 ships. |
| **D7** | **Public scorecard share view** (W4.3's STOP gate) — the auditor journey's public entry. | (a) approve a scoped exposure design early (fields, expiring signed URLs, no claim text without opt-in) so Prove ships with its Share tab; (b) keep deferred | **(a).** Journey C's first entry point depends on it; deciding late leaves Prove with a hole. The security review remains mandatory before build. |
| **D8** | **Kills:** `/connect/ingest/new`, `/lifecycle`, `/projects/[id]/usage`, legacy admin redirects, `/prototype/brutalist-dashboard`, Graph-module stub out of nav. | (a) all six; (b) subset | **(a) all six.** Each is an orphan, stub, or duplicate; W4.7 already defaulted to most of these. |
| **D9** | **W2.6 (in flight):** allow to land as spec'd, or re-point mid-flight at the merged Home. | (a) land, then R3 completes; (b) re-point now | **(a).** Mid-flight re-pointing breaks the one-agent-run discipline; its work is the down payment on R3 either way. |
| **D10** | **Mobile read-only tier scope** (R6): which surfaces open. | (a) Home, run console, Claims read-only; (b) run console only | **(a).** The daily-loop glance (Home) is exactly what a phone check is for; Claims read-only costs little once the rail exists. |

---

*Prepared on branch `docs/keys-northstar-redesign`. On sign-off: R1 records the decisions and
re-baselines the contract; nothing structural fires before that. The reviews under
`docs/reviews/` remain frozen evidence; the W/K roadmap and this document are the living
programme.*
