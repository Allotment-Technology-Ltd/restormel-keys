---
title: RES-113 copy pack — literal strings for every surface state
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-07-02
last-reviewed: 2026-07-02
review-interval: P12M
---

# RES-113 copy pack — literal strings for every surface state

**Status:** Canonical for the `onboardingJourney`-flag-ON path. This is PR-1 of the RES-113
refinement plan: the word-for-word screen strings for every state of Home, Build (M1),
Verify (M2), Connect (M4), and the shared nav. Implementation PRs (PR-3 → PR-7) consume these
strings verbatim; a string change is a change to this document first.

**Audience assumption:** a complete novice who has never heard "knowledge graph", "ingest",
or "claims". Every string below passes the `restormel-ux-craft` skill rules: verb-first
outcome CTAs (skill §1.2), say-what-happened + say-what-next errors (§6.2), sentence case in
authored strings with mono-uppercase reserved for short operational labels (§6.6 / X12),
jargon paired with its outcome line at first contact per surface (§5), exactly one yellow
primary CTA per rendered state (§1.1).

**Governing sources:** `restormel-ux-craft` SKILL.md (jargon table, CTA/error grammar),
[ux-contracts.md](ux-contracts.md) §2 registry (cited per section) and §3 state conventions,
[onboarding-handoff/03_SCREENS.md](onboarding-handoff/03_SCREENS.md) (voice),
[planning: res113-mvp-refinement-plan.md] §3 (surface specs) and §4 (founder decisions —
REC-ADR-022 approved; nav STRIPPED; Settings/Store from S1; Verify tab monotonic).

## 0. Conventions for reading this pack

- Strings are literal. `{n}`-style tokens are runtime values; every counted string ships a
  singular and a plural variant (i18n rule §6.5 — whole sentences only, no splicing).
- Mono-uppercase strings (e.g. `STEP 1 OF 4`, `READ`, `LIVE`) are authored uppercase because
  they are short operational labels (X12). Everything else is authored sentence case; buttons
  may render uppercase via `.btn` chrome, never via the authored string.
- The `→` glyph appears on **at most one element per state: the yellow primary CTA**.
  Secondary links and muted lines never carry an arrow (Build visual-lens fix, generalised).
- The `↗` glyph marks a link that opens something outside the current screen — a source
  passage, a help article. Its accessible name says where it leads.
- Placeholders never carry instructions (§6.4); labels are visible noun phrases above the
  field; helper text is a visible sentence outside the field.
- A missing measurement renders its stat **absent** — never `0`, never `—` (§2.3; plan §3.1).
- Where a state is "quiet" (no yellow primary), that is deliberate and noted; §1.1 caps
  primaries at one, and a steady state may earn none.

### Shared vocabulary ramp (registry citations)

| Term | Treatment in this pack | Registry / skill authority |
|---|---|---|
| graph | First contact per surface pairs it with the canonical gloss "your documents, connected" or a what-you-get sentence. Never "knowledge graph" in UI. | ux-craft §5; ux-contracts §2 "Graph store" (depth only) |
| facts | The novice-facing word for extracted units on Home and Build, taken from the registry's own Claims gloss ("Key facts we found in your documents"). Replaces the handoff's "ideas". | ux-contracts §2 [R1] Claims |
| claims | Introduced only on the Verify surface, defined inline at first contact; used operationally there. | ux-contracts §2 [R1] Claims (D2); ux-craft §5 |
| Ingest / Run ingest | Canonical CTA noun kept; first contact pairs it with the outcome line "Turn your documents into cited answers." | ux-contracts §2 "Ingest run"; ux-craft §5 + precedence table |
| Provider key | Field label for the provider API key; the stored object is the registry's **Provider credential** ("Your OpenAI, Anthropic, Google, or other provider API key" — the registry itself says "key"). | ux-contracts §2 "Provider credential" |
| MCP | Expanded at first use: "MCP (the connector most AI agents use)". The user-goal card is "Connect an agent". | ux-craft §5 |
| Trust score | Always quoted from the Trust scorecard, never recomputed; first contact per surface carries the gloss "how strongly your answers are backed by your documents". | ux-contracts §2 "Trust scorecard" (W2.3) |
| Supported / Weak / Unsupported | Operator-verdict display labels, verbatim. "Rejected" retired. | ux-contracts §2 "Operator verdict" (W4.5) |
| embedding, vector, index, triple, entity, corpus, RAG | Never user-visible. Surface as "Making it searchable" / "Getting ready". | ux-craft §5 |

### Shared stage vocabulary (Home run line + Build tracker)

One table, used by both surfaces. Unknown or internal stages fall back to the last row —
engineering stage names never leak (novice-lens fix, plan §3.1/§3.2).

| Pipeline stage | On-screen name | One-line description (Build tracker only) |
|---|---|---|
| extract | Reading your documents | Pulling the facts out of each page. |
| relate | Connecting the facts | Linking facts that belong together. |
| group | Organising topics | Grouping related facts so answers stay focused. |
| embed | Making it searchable | Preparing everything so questions find the right facts fast. |
| validate | Checking against sources | Making sure each fact matches the document it came from. |
| *(any unmapped stage)* | Getting ready | Setting things up. |

Stage state chips (mono operational labels): `DONE` · `RUNNING` · `WAITING` · `FAILED`.
Accessible names: "done", "running", "waiting", "failed with an error".
Unit counts are always real counted units: "214 of 500 pages" — never a timer-driven percent
(ux-craft §4.4). Time expectations are ranges: "usually 1–3 minutes", never a promise.

---

## 1. Home

Registry rows cited: [R1] Home; Trust scorecard; Ingest run. Home owns the single primary
action for the whole app (plan §3.5) — the nav never carries a CTA.

**Hero (persistent, all states).** Graph name + real counts + connection chip. In EMPTY the
metric row is absent (nothing is fabricated) and the display name is the plain "Your graph"
until a built graph carries a real name.

| Element | Literal string |
|---|---|
| Hero title (EMPTY) | Your graph |
| Hero title (all other states) | *{graph name}* (e.g. acme-graph) |
| Metric row (BUILT onward) | {n} facts · {m} sources · trust score {t} |
| Metric row, singulars | 1 fact · 1 source |
| Metric row, no trust score yet | {n} facts · {m} sources *(trust segment absent — never "—")* |
| Trust score first-contact gloss (hover/aria on the stat) | Trust score {t} of 100 — how strongly your answers are backed by your documents. Quoted from your trust scorecard. |
| Connection chip — none | `NOT CONNECTED` (aria: "Not connected — no app is using this graph yet") |
| Connection chip — connected, no traffic | `CONNECTED` (aria: "Connected — no requests served yet") |
| Connection chip — real traffic observed | `LIVE` (aria: "Live — serving answers to your app") |

The `LIVE` chip renders only when derived from real traffic — the same honesty rule as
Connect S2 (plan §3.4; REC-ADR-016).

### 1.1 HOME · EMPTY (no completed ingest)

Hero + one sentence + one CTA. Nothing else mounts — no meter, gates, triage, ledger,
scorecard, activity panel, or locked tiles (see Appendix A-7). One yellow primary.

| Element | Literal string |
|---|---|
| Headline | Turn your documents into answers you can check |
| Supporting sentence | Add a few documents. Restormel links the facts inside them into a graph — your documents, connected — so every answer can show exactly where it came from. |
| Primary CTA (yellow) | Add your documents → |
| Expectation line (small, muted) | Usually a few minutes from first document to first answer. |

### 1.2 HOME · INGEST RUNNING

Hero + one honest run-status block. One yellow primary. Status text lives in a
`role="status"` region.

| Element | Literal string |
|---|---|
| Status heading | Building your graph |
| Stage line (with real counts) | {Stage name} — {done} of {total} {units}. *(e.g. "Reading your documents — 214 of 500 pages.")* |
| Stage line (no counts yet) | {Stage name}… usually 1–3 minutes. |
| Background reassurance (muted) | You can leave this page — we'll keep working and show progress here. |
| Primary CTA (yellow) | View progress → |

### 1.3 HOME · BUILT, NOT CONNECTED

Hero (real counts) + next-step block + ask box (secondary styling — see Appendix A-6) +
Verify tile only when `flagged > 0` (§3 tile strings, always ghost). One yellow
primary: Connect.

| Element | Literal string |
|---|---|
| Headline | Try a question, then connect your app |
| Supporting sentence | Ask below to see your graph answer from your documents — then connect your app or AI agent so it can do the same. |
| Primary CTA (yellow) | Connect your app or agent → |
| CTA sub-line (muted) | Takes about two minutes — you get a key your app can use. |

**Ask box** (mounts from BUILT onward; submit is secondary-styled in BUILT, primary in LIVE):

| Element | Literal string |
|---|---|
| Field label (visible, above field) | Your question |
| Helper text (visible, below field) | Every answer comes with citations — links to the exact passages it came from. |
| Placeholder | *(empty — placeholders carry no instructions)* |
| Submit button | Ask |
| Loading | Searching your documents… usually a few seconds. |
| Answer citations chip | ↗ {source name} (aria: "Open the source passage in {source name}") |
| Nothing found (abstention) | We didn't find that in your {n} documents. Ask about something they cover, or add a document about it. |
| Nothing found, singular | We didn't find that in your 1 document. Ask about something it covers, or add a document about it. |
| Request failed | We couldn't get an answer — something failed on our side. Try again in a moment. |
| Failed-state action (secondary) | Try again |

### 1.4 HOME · LIVE

Hero (chip `LIVE` when real traffic; `CONNECTED` otherwise) + ask box promoted to primary +
Verify tile only while `flagged > 0` (ghost) + Connect tile (ghost) + activity panel
(this state only). One yellow primary: the ask box submit.

| Element | Literal string |
|---|---|
| Ask box heading | Ask your graph |
| Ask box submit (yellow primary) | Ask |
| Connect tile line | Connected · {n} connections ("· 1 connection" singular) |
| Connect tile link (ghost) | Manage connections |
| Activity panel heading | `RECENT ACTIVITY` |
| Activity row | {connection name} asked · {relative time} ago |
| Activity empty | No requests yet. When your app asks a question, it shows up here. |
| Activity loading | Loading activity… usually a few seconds. |
| Activity error | We couldn't load recent activity. Try again. |
| Activity error action (secondary) | Try again |
| Activity loaded announcement (visually hidden — the persistent `role="status"` region only; a11y skill: async completion must be announced) | Recent activity loaded. |

### 1.5 HOME · LOAD FAILURE (journey shell)

The flag-ON shell's workspace load can fail (hub payload unavailable, or the
scorecard read rejects). One error banner, one recovery action (ux-contracts §3
floor; error grammar §6.2 — say what happened, say the data is safe, say what
next). Added by PR-3's 5-lens review: these strings shipped in code first; this
row registers them per this pack's own "a string change is a change to this
document first" rule.

| Element | Literal string |
|---|---|
| Banner title | Workspace unavailable |
| Banner body | Could not load your workspace. Your data is unaffected — this is a load failure. |
| Recovery action (yellow primary) | Try again |
| Recovery action, in flight | Retrying… |

---

## 2. Build (M1)

Registry rows cited: Ingest run; Provider credential; [R1] Sources (noun retained for the
list card). One state-derived panel at a time (plan §3.2) — the strings below can never
co-exist as competing asks.

**Orientation eyebrow (plain-language, replaces "M1 · BUILD"):** mono-uppercase, one line,
computed from state. Shown **only on the two ask panels**; suppressed on launch, running,
and completion, where the CTA or tracker owns the frame (Appendix A-1). The four steps, for
reference: 1 provider key · 2 documents · 3 build · 4 ask.

| Panel | Eyebrow |
|---|---|
| Provider-key ask | `STEP 1 OF 4` |
| Sources ask | `STEP 2 OF 4` |
| Launch / running / completion | *(no eyebrow)* |

### 2.1 Provider-key ask (`!hasProviderKey`)

One field, one decision (skill §3.1/§3.2). Recommended models are pre-chosen. One yellow
primary, disabled until keyed, with a plain visible hint — no Skip.

| Element | Literal string |
|---|---|
| Headline | Add an AI provider key |
| Supporting sentence | Restormel uses an AI model to read your documents, and the model needs a key — a password-like code from a provider such as OpenAI or Anthropic. |
| Field label | Provider key |
| Helper text (below field) | Stored encrypted, shown masked, never logged. We only use it to build and answer from your graph — your documents, connected. |
| Where-to-get link (secondary) | Where do I get a key? ↗ *(opens a short help article; aria: "Where do I get a key — opens a help article")* |
| Models line (muted) | Recommended models are pre-chosen. Change them under Advanced. |
| Advanced disclosure label | Advanced — choose a model per stage |
| Primary CTA (yellow) | Save key → |
| Disabled-CTA hint (visible, muted) | Paste a key to continue. |
| Bad-key error (inline, input preserved) | The provider rejected this key — it may be expired or missing access. Check you copied the whole key, or create a new one and paste it here. |

### 2.2 Sources ask (`connectionCount === 0`)

Empty-state anatomy (§2.2): what lives here, why it's empty, one populating action.
"Upload files" is the single yellow primary; the connect-account actions are secondary.
The panel advances to the launch panel automatically once one source exists — no Continue.

| Element | Literal string |
|---|---|
| Headline | Add your documents |
| Supporting sentence | These are what your answers come from. Upload files, or connect Notion, Google Drive, or a code repository. |
| List card label | `YOUR SOURCES` |
| List empty line | Nothing added yet — add at least one document to continue. |
| Primary CTA (yellow) | Upload files → |
| Secondary actions | Connect Notion · Connect Google Drive · Connect a repository |
| Source row remove (aria) | Remove {source name} |
| Unreadable-file error | We couldn't read {file name} — it may be password-protected or scanned images. Fix the file and add it again. |

### 2.3 Launch panel (keyed + ≥1 source)

No eyebrow — the CTA owns the frame. One yellow primary. The CTA keeps the canonical
"Ingest" noun and pairs it with the registry outcome line verbatim (ux-craft §5 precedence).

| Element | Literal string |
|---|---|
| Headline (first run) | Ready to build |
| Headline (re-run) | Rebuild your graph |
| Meta line | {n} documents ready. ("1 document ready." singular) |
| Meta line (re-run) | {n} documents · last built {relative time} ago. |
| Outcome line | Turn your documents into cited answers. |
| Expectation line (muted) | Usually takes 1–3 minutes. |
| Primary CTA (yellow) | Run ingest → |
| Advanced disclosure label (on the sources page) | Advanced — full pipeline control |

### 2.4 Running (the tracker)

One honest per-stage tracker using the shared stage vocabulary (§0). Telemetry (heartbeat,
odometers, log, attribution) collapses into a single closed-by-default disclosure that
auto-opens on failure or rate-limit.

| Element | Literal string |
|---|---|
| Panel title | Building your graph |
| Stage rows | *(shared stage table: on-screen name + one-line description + `DONE`/`RUNNING`/`WAITING`/`FAILED` chip + real counts, e.g. "214 of 500 pages")* |
| Honesty footnote (muted) | Progress here is real — each count is work actually finished. |
| Background line (muted) | You can leave this page. We'll keep building, and Home shows progress. |
| Details disclosure label | Show details |
| Rate-limit banner (amber, `role="status"`) | The AI provider asked us to slow down. We're pausing and retrying automatically — nothing for you to do. |
| Stage-failure banner (coral, `role="alert"`) | {Stage name} stopped partway — the AI provider returned an error. Everything finished so far is saved. Retry to pick up where it left off. |
| Failure action (yellow primary in the failed state) | Retry run → |

### 2.5 Completion

Exactly one primary, always to the ask (M4 spine), never to Verify or Store. The Verify
secondary is plain muted text with an inline text link — no arrow, no button styling
(Appendix A-2). It renders only when `flagged > 0`.

| Element | Literal string |
|---|---|
| Headline | Your graph is built |
| Supporting sentence | We found {n} facts across {m} documents. Ask a question to see it work — every answer shows where it came from. |
| Supporting, singulars | We found 1 fact across 1 document. … |
| Primary CTA (yellow) | Ask your first question → *(lands on Home with the ask box focused)* |
| Verify secondary (muted plain text, only when flagged > 0) | {n} of the facts we found couldn't be fully matched to their sources. [Review them in Verify] whenever you like — your answers work either way. |
| Verify secondary, singular | 1 of the facts we found couldn't be fully matched to its source. [Review it in Verify] whenever you like — your answers work either way. |

*Square brackets mark the inline link text; the sentence renders as one muted line.*

### 2.6 Build strings registered by PR-5 (implementation deviations + additions)

PR-5 shipped these strings in code; this section registers them per this pack's own
"a string change is a change to this document first" rule (the §1.5 precedent). Each row
cites the governing rule.

**Deviations from §2.3/§2.4/§2.5, forced by honest absence (§0):**

| Element | Literal string | Why it deviates |
|---|---|---|
| Completion supporting sentence | We found {n} facts across your documents. ("We found 1 fact across your documents.") | The run payload carries no per-run document count `{m}` — the "across {m} documents" segment renders absent, never fabricated (§0). When the run reported no unit count the sentence is absent entirely; the second sentence ("Ask a question to see it work — every answer shows where it came from.") always renders. |
| Launch meta line, re-run | {n} documents ready. ("1 document ready." singular) | The §2.3 re-run variant's "last built {relative time} ago" has no honest source signal in the wizard payload — the first-run meta line renders in both launch states. |
| Stage-failure banner, unclassified errors | {Stage name} stopped partway. Everything finished so far is saved. Retry to pick up where it left off. | The §2.4 "— the AI provider returned an error" clause is reserved for provider-classified failures. An error the failure mapper can't classify must not assert a cause (REC-ADR-016); the raw error stays reachable below. |

**Journey run-console states (REC-ADR-016 — the h1 names the real run state):**

| Element | Literal string |
|---|---|
| Console h1, failed | Build stopped |
| Console h1, cancelled | Build cancelled |
| Console h1, completed preview (stub) run | Preview run finished |
| Starting line (`role="status"`) | Starting your run… |
| Failed banner title | Build stopped |
| Raw-error disclosure label (muted, inside the failure banner) | Raw error (for support) |
| Cancelled / preview restart secondary | Restart run |
| Persistent announcer, stage transition (sr-only `role="status"`) | {Stage name}… *(shared stage table names)* |
| Persistent announcer, terminal states | {Console h1}. *(e.g. "Your graph is built.")* |
| Persistent announcer, rate limit | *(the §2.4 rate-limit banner body, verbatim)* |
| Persistent announcer, stall | A stalled run is reclaimed automatically and resumes from the last checkpoint — nothing is lost. *(echoes the visible stall notice)* |
| Stage chip accessible names | done · running · waiting · failed with an error *(§0, verbatim)* |

**Build asides (store/domain/sources off the spine — plan §3.2 point 3):**

| Element | Literal string |
|---|---|
| Aside back link (store · domain · sources asides) | ← Back to Build |
| Breadcrumb trail | Home › Build › {Configure store · Domain packs · Sources} |
| Domain aside kicker | Advanced · domain packs |
| Domain aside title | Define how documents become a graph *(reuses the registry Domain step title)* |
| Domain aside lede | A built-in pack is already applied for you — nothing here is required. Design or import your own pack only if your domain needs a different shape. |
| Sources manage aside (explicit `?step=sources` visit with documents selected) | *(reuses §2.2 headline + supporting sentence verbatim; no eyebrow — the visitor is past step 2)* |
| Sources page Advanced action (flag-ON) | Design a domain pack |
| Build shell h1 (flag-ON) | Build *(page title: "Build – Restormel Dashboard")* |

The provider-key panel's field-level §2.1 strings ("Provider key", "Save key →",
"Paste a key to continue.") remain deferred to a panel-internals PR (PR-5 decision 8).

### 2.7 Build plug-points (shared by the sources Advanced disclosure + `/routes/ingestion`)

Registered ahead of the plug-point PRs, per the signed-off verification-engine placement
spec (founder decisions A–F, 2026-07-02; `restormel-ops`
`planning/verification-ui-placement-spec.md`). One derivation, one renderer, two hosts
(decision C): the sources-page "Advanced — full pipeline control" disclosure (§2.3) and its
operator twin `/routes/ingestion`. Reveal predicate: disclosure open — otherwise zero
pixels; the default path stays pixel-identical and novices see nothing new. Flag:
`m1PlugPoints`. Curated options are the CLEARED set only (REC-GOV-022 §d); BLOCKED and
AMBIGUOUS component names never appear in any string, menu, or derivation output. Slot rows
reuse the §0 stage-table names verbatim (Reading your documents · Making it searchable ·
Checking against sources) — a reference, not new strings. Store is never a slot row — the
`?step=store` aside owns it. No string in this section introduces a yellow primary; both
hosts keep their shipped primaries.

**Slot row anatomy** (identical strings on both hosts):

| Element | Literal string |
|---|---|
| Row label | *(§0 stage-table on-screen name, verbatim)* |
| Current-choice line | {option name} |
| Change affordance (secondary, per row) | Change (aria: "Change the model for {stage name}") |
| Recommended tag on the default option (list order: recommended first) | `RECOMMENDED` (aria: "the recommended default") |
| Option selection mark | *(reuses §4.5's "■ selected · □ select" — glyph + word; selection is never carried by colour or fill alone, R3-A3)* |
| Preset annotation (muted, only while the current choice comes from an applied preset) | Part of {preset}. |

**Outcome lines — one per curated option.** Written fresh for this pack (the wireframe
exemplar was struck as a transplant — placement spec §3.1). Trade-offs are named as
outcomes — accuracy, speed, where your documents go — never as licences, tiers, benchmark
scores, or cost figures (economics render only on §2.8's surfaces).

| Stage (§0 name) | Curated option (REC-GOV-022 §d) | Outcome line |
|---|---|---|
| Reading your documents | PaddleOCR-VL *(recommended default)* | The recommended reader. Handles most documents well and keeps the exact position of every fact, so citations can highlight the source passage. |
| Reading your documents | Mistral OCR 4 | The most accurate on difficult documents — scanned pages, dense tables, many languages. Runs as a hosted service, so your pages leave your infrastructure. |
| Reading your documents | PaddleOCR PP-OCRv5 | The fastest on plain, cleanly laid-out pages — a good fit for large volumes of simple documents. Less accurate on difficult ones. |
| Making it searchable | BGE-M3 *(recommended default)* | The recommended choice. Strong search across many languages, and it can run entirely on your own infrastructure. |
| Making it searchable | Qwen3-Embedding-8B | The strongest search quality — the pick when questions keep missing facts you know are there. Needs more computing power, so builds take longer. |
| Making it searchable | voyage-4-lite | A hosted option with nothing to run yourself. Light and quick; search quality sits a step below the recommended choice. |
| Making it searchable | Voyage domain models (legal · finance · code) | Tuned for legal, financial, or code documents — stronger search in those fields. Hosted, so your text leaves your infrastructure. |
| Checking against sources | Granite Guardian *(recommended default set)* | The recommended check. Clear cases pass quickly, unclear ones get a stronger look, and anything still uncertain waits for your verdict. |
| Checking against sources | Frontier hosted model (Claude, Gemini, or GPT) | The most thorough check for high-stakes work — a model from a different maker re-checks each fact. The slowest option, and facts go to that provider. |
| Checking against sources | HHEM-2.1-Open | The lightest check — fast, and it runs on your own infrastructure. It settles fewer cases on its own, so more facts wait for your verdict. |

Option display names come from the PR-1 derivation; a menu change is a change to
REC-GOV-022 first, then to this table, then to code.

**Incompatibility reason line (decisions B + D — absent-with-reason).** Incompatible
options are never offered — absent from the list, never disabled-and-teasing (ux-craft
§2.4). The reason renders once, as a muted line in the affected slot row, only when the
current selections exclude at least one cleared option. Stage-table language; the word
"checker" never appears in user copy (decision D). BLOCKED/AMBIGUOUS components get no
reason line — they are simply absent (REC-GOV-022). One string, replacing both clusters'
drafts:

| Element | Literal string |
|---|---|
| Reason line (muted, in the slot row) | Some options aren't offered with your current choices. The stage that checks against sources always uses a different maker from the stage that reads your documents, so the check stays independent. |

**Deployment preset (`/routes/ingestion` only — decision A).** Exactly one writable preset
surface exists: `/routes/ingestion`, where this field extends the shipped "Reset to
recommended" bulk action into a four-way choice — one mechanism, not two. Choosing "Fully
managed (recommended)" *is* the shipped reset. `/projects` stays purely storage; no
Settings nav string changes (§5.1 holds). A preset rewrites `bundle`; slot rows re-derive
and carry the "Part of {preset}." annotation above.

| Element | Literal string |
|---|---|
| Field label | Where your pipeline runs |
| Helper text (below field) | One choice swaps the whole vetted setup. You can still adjust individual stages below. |
| Option — recommended default | Fully managed (recommended) |
| Outcome line | Hosted services do the work — nothing to run yourself. The recommended starting point. |
| Option | Highest accuracy |
| Outcome line | The strongest reading, search, and checking available. Builds run slower, and your documents go to hosted providers. |
| Option | Regional residency |
| Outcome line | Your documents are processed only inside your chosen region. |
| Option | Self-host air-gapped |
| Outcome line | Everything runs on your own infrastructure — nothing ever leaves it. You provide the computing power. |
| Confirm dialog body (extends the shipped reset confirm; blast radius in numbers, ux-craft §3.5) | Switch to {preset}? This swaps {n} stages to that setup. Your graph and answers stay as they are — the new setup applies from your next build. |
| Confirm dialog body, singular | Switch to {preset}? This swaps 1 stage to that setup. … |
| Confirm / cancel buttons | Switch setup · Keep it |
| Applied announcement (`role="status"`) | Setup switched to {preset}. |

*Helper deviation, recorded:* the placement spec drafted the helper ending "…under
Advanced." while placement was still disputed; decision A landed the field on
`/routes/ingestion`, where the stage rows render on the same page below the field —
"under Advanced" would point at the other host. Registered with "below".

**Launch-panel receipt (predicate: `bundle ≠ default`).** The default bundle renders
nothing — no receipt, no summary, no per-row teasers (§0 honest absence; REC-ADR-020).

| Element | Literal string |
|---|---|
| Receipt line (muted, on the §2.3 launch panel) | Runs your customised pipeline. [Review choices] |
| Customisation summary (inside the disclosure, same predicate) | {n} stages changed from the recommended default. |
| Customisation summary, singular | 1 stage changed from the recommended default. |

*Square brackets mark the inline link text (§2.5 convention); [Review choices] opens the
sources-page "Advanced — full pipeline control" disclosure.*

**Withdrawal / revert notice (decision F — one converged string).** Rendered once by the
slot renderer, in the affected slot row, only when `reverted === true`; the withdrawn name
is absent from menus thereafter. Never licence or counsel language (D-2026-07-02-1);
verdict consequences flow only through the existing triage counts — §3.2/§3.4 strings
unchanged.

| Element | Literal string |
|---|---|
| Notice (`role="status"`, §6.2) | {name} is no longer available — {stage} is back on the recommended default. Your graph and answers are unaffected. |

`{stage}` renders the §0 stage-table on-screen name; `{name}` the withdrawn option's
display name.

**Save states (registered by PR-2 — the slot-rows render PR).** Choosing an option
persists it to the graph's bundle; these are the three strings that interaction needs.
The pending word replaces the option's selection word while the save runs (the list also
carries `aria-busy`); the failure line follows §6.2 (what happened + what to do next,
adjacent to the control, state preserved); the confirmation is announced on the slot
renderer's persistent polite `role="status"` region (§6.3 — async completion is announced,
never silent). `{stage}` renders the §0 stage-table on-screen name; `{name}` the chosen
option's display name.

| Element | Literal string |
|---|---|
| Save pending (in the chosen option's selection-mark position) | saving… |
| Save failure (adjacent to the slot row, `role="alert"`, §6.2) | We couldn't save that choice — your pipeline is unchanged. Try again. |
| Save confirmation (`role="status"` announcement) | {stage} now uses {name}. |

### 2.8 Economics (Metrics + run console)

Verification-economics strings (placement spec §3.3; decision E assigns them this
section). Exactly two render surfaces: rows on the Metrics page (`/analytics`) and one
summary line inside the run console's existing "Show details" disclosure (§2.4) — the line
exists only inside the opened disclosure. Never a cost figure on Home, on a Build panel,
or on any journey surface; no tier or cache vocabulary anywhere; weekly-CI-gate views stay
internal. Every count is a real counted unit; the populations are independent and are
never summed into a single total (REC-ADR-016).

The Metrics section heading reuses the §0 stage-table on-screen name **Checking against
sources** — a reference, not a new string (same convention as §2.7's slot-row labels;
registered here by PR-8, the first PR to render this section).

| Metrics row label | First-contact gloss (hover/aria on the row) |
|---|---|
| Facts checked | How many facts were checked against the documents they came from. |
| Re-used from earlier builds | Results carried over from an earlier build instead of being checked again. |
| Sent for a closer look | Facts the quick check couldn't settle, passed to a stronger check. |
| Awaiting review | Facts waiting for your verdict in Verify. |
| Spend | What the checks cost to run, across providers. |

| Element | Literal string |
|---|---|
| Per-run summary line (run console "Show details") | Checked {n} facts · {m} re-used from earlier builds · {k} sent for a closer look · {j} awaiting your review · {spend} spent. |
| Segment singulars | Checked 1 fact · 1 re-used from an earlier build · 1 sent for a closer look · 1 awaiting your review |

**Honest absence, restated (§0 — load-bearing here):** a measurement the run or corpus
didn't record renders its row or segment **absent** — never `0`, never `—`. Each segment
of the per-run line renders independently on the same rule; a run with no recorded
economics renders no summary line at all.

---

## 3. Verify (M2)

Registry rows cited: [R1] Claims (D2 — "claims" defined inline at first contact, below);
Operator verdict (Supported / Weak / Unsupported — "Rejected" retired); Trust scorecard.
Driven by `resolveM2Surface(signals) → hidden | triage | ready`.

**The priority rule (novice-lens requirement, plan §3.3):** when more than one gate needs
attention, the hub leads with the **earliest gate in pipeline order — Sources, then
Searchable, then Review** — expanded alone; the others collapse. The reason is stated on
screen: each later check depends on the one before it. There is never more than one
expanded gate.

Gate names and one-liners:

| Gate | On-screen name | One-liner |
|---|---|---|
| Sources | `SOURCES` | Every fact needs a source. |
| Embed | `SEARCHABLE` | Every fact needs to be findable when you ask. |
| Validate | `REVIEW` | Facts we weren't sure about need your verdict. |

### 3.1 Hidden (`!graphBuilt`) — the `/verify` route only

Zero Verify pixels on Home (the nav tab is the only wayfinding). The route renders one
dashed empty card:

| Element | Literal string |
|---|---|
| Headline | Nothing to check yet |
| Body | Once your graph — your documents, connected — is built, anything we couldn't fully match to your documents appears here for a quick review. |
| CTA (yellow primary) | Go to Build → |

### 3.2 Triage (built + verify work outstanding)

Queue-led. Gates that don't need the user collapse to **one combined receipt line**
(Appendix A-3). One yellow primary.

| Element | Literal string |
|---|---|
| Trust line (quotes the scorecard) | Trust score {t} of 100 — how strongly your answers are backed by your documents. |
| Headline (exactly ONE gate needs you — `n` is that gate's own counted population) | {n} facts need your review ("1 fact needs your review" singular) |
| Headline (2+ gates need you) | Facts need your review *(countless — the Sources and Review populations are independent per-unit fields that can overlap, so no single honest total exists; the per-gate receipt lines below carry the real numbers. REC-ADR-016; registered by PR-6's 5-lens review per the §1.5 precedent.)* |
| Definition sentence (first contact for "claim") | Each one is a claim — a fact we found in your documents — that we couldn't fully match to its source. |
| How-it-works sentence | Check each claim against the passage shown. It usually takes under a minute each. |
| Priority lead-in (only when 2+ gates need attention) | Start with {gate name} — each check depends on the one before it, so this one comes first. |
| Lead-gate detail receipt — Sources (mono, inside the expanded gate card) | {n} need a link *(pre-existing PR-D string, registered now that it renders on this surface)* |
| Lead-gate detail receipt — Review (mono) | {n} flagged of {m} |
| Queued-gate receipt line (a later gate that ALSO needs you) | {Gate name} — {detail}. *(e.g. "Review — 47 flagged of 1,204.")* |
| Still-working stage line — Searchable (§0 stage grammar) | Making it searchable — {done} of {total} facts. |
| Still-working stage line — Sources (scorecard still being read) | Reading source links… *(defence-in-depth only: the `/verify` shell resolves a built graph with an unreadable scorecard to the §1.5 load-failure state, never this line — a failed read is named, not dressed as progress.)* |
| Quiet still-working headline (nothing needs you, a gate still runs) | Building your graph |
| Verdict buttons | Supported · Weak · Unsupported |
| Verdict help line (muted, once above the queue) | Supported — the passage backs it. Weak — partly backed. Unsupported — the passage doesn't back it. |
| Queue row source line | From {source name} |
| Saving chip | `SAVING…` |
| Saved announcement (`aria-live="polite"`) | Saved. {n} left. ("Saved. 1 left." / "Saved. All done.") |
| Primary CTA (yellow) — Review leads | Review the first claim → |
| Primary CTA (yellow) — Sources leads | Link facts to sources → *(destination: the graph Tools workspace's "Link sources" step — `?workspace=tools`, a live explorer param; the label follows the lead gate so the frame's one action names the work its lead-in just prioritised.)* |
| Scorecard disclosure (muted text toggle, closed by default, below the queue) | Show the full scorecard |

### 3.3 Ready (built + nothing outstanding)

`ready` is asserted only when the spine's verify stages are clear **and** the scorecard's
Sources signal is clear (no units still needing a link): the body's "matched to sources"
claim must be backed by the same signal the disclosure's scorecard renders — never
contradicted one click away (REC-ADR-016; PR-6 5-lens review).

| Element | Literal string |
|---|---|
| Headline | Everything checks out |
| Body | All {n} facts are matched to sources, searchable, and reviewed. Your graph is ready for real questions. ("All 1 fact is matched to sources, searchable, and reviewed. …" singular) |
| Primary CTA (yellow) — INTERIM until the mark-ready recompute ships (PR-J) | Back to Home → *(the three rows below are the target strings; shipping them on a plain Home link would claim a recording that never happens — a fabricated action, REC-ADR-016. They activate together with the PR-J backend.)* |
| Primary CTA (yellow) — target, PR-J | Mark your graph ready → |
| CTA sub-line (muted) — target, PR-J | This records the graph as reviewed and takes you back to Home. |
| Post-action toast — target, PR-J | Marked ready. |
| Scorecard disclosure | Show the full scorecard |

### 3.4 Home tile strings (triage / ready only — never in hidden)

Ghost styling always; no status dot — the text carries the state (Appendix A-3).

| State | Tile line | Tile link (ghost) |
|---|---|---|
| triage | {n} facts couldn't be matched to a source yet. ("1 fact couldn't be matched to a source yet.") | Review {n} facts ("Review 1 fact") |
| ready | All facts are matched to sources. | Open Verify |

### 3.5 Verify dossier first-contact lines

Registered per the signed-off placement spec (§3.2; decision E assigns them this section).
Predicate: **dossier open AND `judge !== null`**. One novice-register line renders above
the shipped operator block (`judgedBy`, the JUDGE chip, the judgment-history disclosure) —
no new fields, no second disclosure, never a "CHECKED BY" label, and the word "checker"
never appears in user copy (decision D: stage-table language for novices; the shipped
JUDGE vocabulary stays the operator layer). Exactly one of the three variants renders per
dossier, selected by judge type / abstention.

| Element | Literal string |
|---|---|
| Independence gloss (machine verdict) | Checked against its source on {DD Month YYYY} by a model independent of the one that read your documents. |
| Human-verdict variant (the verdict is your recorded Operator verdict) | Reviewed by you on {DD Month YYYY}. |
| Abstention line (claim still awaiting your triage) | We couldn't fully match this claim to its source — it's waiting for your verdict. |

The abstention line echoes the §3.4 tile vocabulary ("couldn't be matched to a source")
and the §3.2 definition sentence; verdict labels stay the registry's Supported / Weak /
Unsupported. Dates render DD Month YYYY (§6.5). Component withdrawal has no Verify-side
variant — §2.7's converged notice is the only withdrawal string (decision F).

**Passage fidelity + citation resolution.** Tier names never appear in UI. A spatial span
renders exactly as today, with no note — the note's presence is the only signal, and it is
carried by text, never by colour alone (R3-A3).

| Element | Literal string |
|---|---|
| Textual-fidelity note (in-dossier, only when `fidelity === "textual"`) | Source passage shown as text — this document type doesn't support a visual highlight. |
| Unresolvable citation (ux-craft §4.1, registered here) | Source passage no longer available. |

---

## 4. Connect (M4)

Registry rows cited: [R1] Agents (MCP wiring vocabulary); CTA grammar (key-handling copy:
"your key", masked, never logged). Three states: S0 locked · S1 guided fork · S2
list-plus-nudge (framing per Appendix A-5).

### 4.1 S0 — locked (no completed ingest)

Nothing else renders. This page is also the click-through destination for the dimmed
Connect nav item (§5). One yellow primary, pointing at the spine.

| Element | Literal string |
|---|---|
| Headline | Nothing to connect yet |
| Body | Connect is where your app or AI agent gets access to your answers. First, add some documents so there's something to answer from. |
| Primary CTA (yellow) | Add your documents → |

### 4.2 S1 — first connection (ingest done, `connections = 0`)

A deliberate guided fork: two goal cards + prefilled name field + Create. The existing
StateChip cue bar stays with its shipped strings (not restated here). One yellow primary:
Create connection. Method cards are user goals, not protocols — the protocol is the chip.

| Element | Literal string |
|---|---|
| Headline | What do you want to connect? |
| Supporting sentence | Both get a secure key that can read your answers. You can add more connections later. |
| Card 1 title (MCP, listed first) | Connect an agent |
| Card 1 description | For Claude, ChatGPT, or any agent that supports MCP (the connector most AI agents use). |
| Card 1 chip | `MCP` |
| Card 2 title (REST) | Connect your own code |
| Card 2 description | For your app or backend — a simple web API your code can call. |
| Card 2 chip | `REST API` |
| Name field label | Connection name |
| Name field prefill | agent *(agent card)* / backend *(code card)* |
| Name helper text (below field) | Anything that helps you recognise it later — the suggestion works fine. |
| Read-only line (muted) | Your first connection is read-only — it can look things up but can't add, change, or delete anything in your graph. |
| Project chip (only when 2+ projects and no default) | `PROJECT` {project name} · Change |
| Primary CTA (yellow) | Create connection → |

### 4.3 S1 — success (display-once key)

| Element | Literal string |
|---|---|
| Headline | Connection created |
| Key box label | Your connection key |
| Display-once warning | This is the only time the full key is shown. Copy it now and store it somewhere safe. |
| Copy actions | Copy key · Copy (endpoint) — announce "Copied." |
| Endpoint label | Endpoint |
| Setup hint (MCP) | Paste the endpoint and key into your agent's MCP settings. |
| Setup hint (REST) | Call the endpoint with your key in the Authorization header. |
| Primary CTA (yellow) | Ask a question → *(lands on Home's ask box)* |
| CTA sub-line (muted) | See what your app sees — every answer with its citations. |

### 4.4 S2 — connections manager (`connections ≥ 1`)

List-plus-nudge. No yellow primary in the steady state — nothing demands action
(Appendix A-5). "Add connection" is the sole secondary action.

| Element | Literal string |
|---|---|
| Row anatomy | {type icon} {name} · `READ` or `READ + WRITE` · {endpoint} · Copy |
| Live chip (only with real observed traffic) | `LIVE` (aria: "This connection has served requests recently") |
| Suggestion row (only when exactly one read-only connection exists; the full stop sits INSIDE the link so no detached glyph trails the link's inline box) | Need your app to add or update facts in your graph too? [Add a read + write connection.] |
| Add action (secondary) | + Add connection |
| Page load error | We couldn't load your connections. Try again. |
| Error action (secondary) | Try again |

**Row detail view** (delete lives here, never inline in the list):

| Element | Literal string |
|---|---|
| Detail affordance (per row, `aria-expanded`) | Details |
| Delete action | Delete this connection |
| Confirmation (blast radius) | Delete {name}? Your app loses access immediately — any code using this key stops working. This can't be undone. |
| Confirm / cancel buttons | Delete connection · Keep it |

### 4.5 Strings registered by PR-7

These shipped in code with the Connect PR and are registered here per this pack's own
"a string change is a change to this document first" rule (the §1.5 / PR-3 precedent).
All follow the pack's grammar rules (§6.2 errors say what happened + what next; §0 one
yellow primary per state).

| Element | Literal string |
|---|---|
| S1 disabled-CTA hint (visible, muted — mirrors §2.1's "Paste a key to continue.") | Choose one to continue. |
| S2 add form — access line, read (the §4.2 first-connection line is first-run-specific) | New connections start read-only — they can look things up but can't add, change, or delete anything in your graph. |
| S2 add form — access line, read + write (opened from the §4.4 suggestion row) | This connection is read + write — it can look things up and also add or update facts in your graph. |
| Create failed (inline, `role="alert"`, input preserved; server detail shown when supplied) | We couldn't create the connection — something failed on our side. Try again in a moment. |
| Create failed — workspace has no project (inline `role="alert"`) | We couldn't create the connection — this workspace has no project yet. Create a project first. |
| Delete completed (polite announcement — row removal is the visible signal) | Connection deleted. |
| Delete failed (rendered inline in the row's delete confirmation, next to its retry action — ux-contracts §3 recovery floor — AND announced politely) | We couldn't delete the connection. Try again. |
| Copy succeeded (visible button toggle + polite announcement — one form everywhere) | Copied. |
| Copy failed (polite announcement) | We couldn't copy — select the text and copy it manually. |
| In-flight CTA labels (visible while the request runs; the §1.5 "Retrying…" precedent) | Creating… · Deleting… |
| Method-card selection mark (visible chrome pairing glyph + word; state also carried by `aria-pressed`) | ■ selected · □ select |
| Page load error banner title (body + action are §4.4's) | Connections unavailable |

The S2 add form otherwise reuses §4.2's strings verbatim (headline, cards, name field,
project chip, Create CTA) — one form, two entry points ("+ Add connection" → read; the
suggestion row → read + write).

---

## 5. Nav and titles

Founder decision (plan §4, decision 2): **STRIPPED nav.** Plain text items; unreachable
items render dimmed with no dots, no badges, no inline lock reasons. The reason lives
behind the click. The nav never carries a CTA — Home owns the primary action.

### 5.1 The four labels

| Slug | Label |
|---|---|
| home | Home |
| build | Build |
| verify | Verify |
| connect | Connect |

The Settings group (present from S1 — empty workspace — onward, collapsed, never promoted;
founder decision 3) keeps its label **Settings** and its existing item nouns (Providers,
Store, Routes, Audit log, Metrics). No Settings-item strings change in RES-113.

### 5.2 Verify tab appearance (monotonic)

The Verify item is **absent** (not dimmed) until real state first warrants it
(flagged / low-trust claims to triage). Once shown it **persists for good** — it never
flickers out when the count returns to zero. This is a recorded UX choice, not an
ADR-derived requirement (founder decision 4). It appears with no badge and no count.

### 5.3 Dimmed-item click-through explanations

Dimmed items stay clickable. Clicking navigates to the surface's locked state, which *is*
the explanation — one mechanism, no popover chrome. Today exactly one item can be dimmed:

| Item | When dimmed | Click-through destination + strings |
|---|---|---|
| Connect | No completed ingest | Connect S0 (§4.1): "Nothing to connect yet" / "Connect is where your app or AI agent gets access to your answers. First, add some documents so there's something to answer from." / "Add your documents →" |

If an implementation ever needs an in-place explanation instead of navigation (e.g. a
future locked item with no page), the template is one sentence + one link, no heading:
"**{Item} unlocks once {plain condition}.** [{Spine action}]" — instance for Connect:
"Connect unlocks once you've added documents. [Add your documents]".

### 5.4 `PATH_TO_TITLE` values (journey branch only)

"Operator home" is retired on this branch.

| Route | Topbar title |
|---|---|
| Home | Home |
| Build | Build |
| Build → run console | Build · Run |
| Verify | Verify |
| Connect | Connect |

Sub-surfaces title as `{Section} · {Sub}` (mirrors the shipped `Connect · Runs` pattern).

### 5.5 Signed-out layout

The stale "Sources → Runs → Claims / Foundation" tour copy is deleted. One sentence + the
canonical auth CTA (ux-contracts §2 CTA grammar):

| Element | Literal string |
|---|---|
| Sentence | Restormel turns your documents into answers you can check. |
| CTA | Sign in with GitHub |

---

## Appendix A — spec resolutions recorded by this pack

Copy-adjacent NEEDS-REVISION findings from plan §3, resolved here as PR-1 was designated to.

1. **Build eyebrow suppression (visual, §3.2 fix 1).** The eyebrow renders only on the two
   ask panels (`STEP 1 OF 4`, `STEP 2 OF 4`) and is suppressed on launch, running, and
   completion, where the CTA or tracker owns the frame. Steps 3 and 4 exist (build, ask)
   so the "of 4" count stays honest even though their eyebrows never render.
2. **Build completion secondary demotion (visual, §3.2 fix 2).** The conditional Verify
   line is plain muted text with an inline text link — no arrow, no button styling. The
   arrow glyph is reserved app-wide for the single yellow primary per state (§0).
3. **Verify tightening (visual, §3.3 items 1/3/4).** (1) Home tiles drop the status dot —
   the text carries the state. (3) Collapsed gates render **one combined receipt line**,
   not one line per gate — no checklist beside the CTA. (4) The scorecard + K4 ledger sit
   behind a single closed-by-default **muted text** disclosure below the queue — visually
   subordinate to the primary CTA.
4. **Verify priority rule (novice, §3.3).** Pipeline order — Sources, then Searchable,
   then Review; lead with the earliest gate needing the user, expand only that one, and
   say why on screen ("each check depends on the one before it").
5. **Connect framing (visual, §3.4).** S1 is acknowledged as a **guided fork** (two goal
   cards + name field) with one yellow primary (Create connection); S2 is a
   **list-plus-nudge** manager with no yellow primary — a steady state demands nothing.
   The single-CTA austerity claim is dropped; the one-yellow-max rule (§1.1) is what holds.
6. **Home Ask/Prove + activity panel (visual, §3.1).** The ask box mounts from BUILT
   onward (a graph exists — 02_IA_AND_NAV.md §3; not gated on a connection) but its submit
   is **secondary-styled in BUILT** and becomes the yellow primary only in LIVE. The
   activity panel renders only inside LIVE. The "nothing else mounts" framing is replaced
   by "exactly one yellow primary per state".
7. **Home EMPTY locked-Connect tile dropped (visual, §3.1).** EMPTY renders hero +
   sentence + CTA only. The lock explanation lives behind the dimmed Connect nav item
   (→ Connect S0), consistent with the founder's stripped-nav decision — one lock-reason
   mechanism, not two.
8. **Hero metric noun.** "facts" replaces the handoff's "ideas" (registry-backed: the
   Claims row's own gloss is "key facts we found in your documents"). The trust stat is
   absent when the scorecard reports none — never a placeholder.
9. **CTA unification.** §3.1's "Add your sources →" and §3.5's "Add your documents →"
   resolve to **"Add your documents"** everywhere the M1 entry is offered (Home EMPTY,
   Connect S0, dimmed-nav template). "Sources" remains the noun for added items inside
   Build (`YOUR SOURCES`), per the registry.
10. **Noun ramp.** Home and Build say "facts"; Verify introduces "claims" with an inline
    definition and uses it operationally from there. Verdict labels are the registry's
    Supported / Weak / Unsupported everywhere.
11. **Stage-name honesty.** Both the Home run line and the Build tracker draw from the one
    shared stage table (§0); unmapped stages render "Getting ready" — engineering
    vocabulary never leaks (REC-ADR-016).

**Out of scope, tracked:** REC-ADR-021's first-run "ask a shared demo graph" M0 hero —
deferred per plan §4; no strings here pre-empt it.

---

**Append-only in spirit:** implementation PRs consume these strings verbatim. Change a
string here first, citing the governing registry row or skill rule, then in code.
