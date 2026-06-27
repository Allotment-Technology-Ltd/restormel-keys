# 03 · Screen specs

Per-screen layout, components, copy, and states. Pixel-exact colours/spacing come from the token
layer (`04_TOKENS.md`) — values below are named tokens, not raw hex, so you reuse the real ones.
For anything ambiguous, open the named design file beside you.

Shell (all screens): left **sidebar** (brand + primary nav + Settings group) · top **bar**
(section title, ⌘K search, workspace, account) · scrolling **content** column, max width ~960px,
generous padding. Reference: `Restormel Prototype.html`.

Common building blocks: `.card` (2px ink border, hard shadow, cream-white surface), `.btn` /
`.btn-primary` (yellow) / `.btn-ghost`, `.brut-kicker` (mono uppercase eyebrow), status dots
(teal/amber/coral/ink). Every screen has a **mono uppercase eyebrow** ("M1 · BUILD") and a
**Barlow Condensed display title**.

---

## HOME — persistent graph dashboard
**File:** `Restormel Prototype.html` (home state) · `Onboarding Journey.html` (first-run + returning frames)
**Purpose:** Land here every session. See graph health + the one next action; re-enter any area.

- **Graph hero** (top card): graph name (`starter-graph` → `acme-graph` after ingest), metric row
  (`1,204` ideas · trust `88` · `3` sources), live pill (`Not connected` grey / `Live` teal with dot).
- **Status tiles** (grid, ~2–3 col): one per area — Sources, Verify, Models, Store, Connect, Routes.
  Each: status dot (`idle`/`todo`/`ok`), name, one-line stat, one action link. Only the single
  most-important next action is filled yellow; the rest are ghost links. Locked tiles (e.g.
  Connect pre-ingest) show a lock + reason.
- **Live nudge** (after M4): a banner — *"You're live. Your app can answer from your graph.
  Everything below stays editable — revisit any area, any time."* + "Manage connections".
- **First-run variant:** before any ingest, Home leads with the **M0 explore** hero (ask the
  starter graph) instead of a full tile grid — minimise choices for a brand-new user.

## M0 — Explore the starter graph
**File:** `Restormel Prototype.html` (m0) · `M1 Flow.html`
**Purpose:** First aha. Ask a demo graph, get a cited answer. Zero setup.

- Eyebrow `M0 · EXPLORE · THE AHA`; title **"Ask the starter graph"**; desc explains you get a
  *grounded answer with citations* from a small demo knowledge base, no setup.
- **Ask card:** a labelled input ("Ask the demo knowledge base…") + yellow **Ask →**; three
  suggested-question chips below ("What is our data retention policy?", "Which plans include
  SSO?", "What is the API rate limit?").
- **Answer block** (after ask): a brief "thinking" state (spinner + *"Searching the graph…"*),
  then the **answer** text + a row of **citation chips** (↗ source name). Citations are the point —
  make them prominent.
- **Archetype note** at the bottom explaining how Initial/Learning/Advanced each read this screen.
- **Transition:** primary CTA after the aha → "Ingest your docs" (to M1).

## M1 — Build your graph (ingest)  ← most complex; build first
**Files:** `Restormel Prototype.html` (m1) · `M1 Flow.html` · `M1 Add Models.html`
**Purpose:** The conversion. Add sources → choose models → run ingestion (live) → ask your data.

A 4-step flow with a **stepper** (Sources · Configure · Ingest · Ask):

**Step 1 — Sources.** Title "Add your sources". A `.card` "Your sources" with a live **count
badge** and a list of source rows (icon by type — upload/Notion/Drive/repo — name, type label,
remove ✕). Buttons to add sources by type. Seeded per persona. Foot: **Continue →**.

**Step 2 — Configure (models + key).** Title "Choose models". A recommended-by-default setup:
one **"Paste a provider key"** field, and an **"Advanced: choose a model per stage"** disclosure
(collapsed by default; open by default for Advanced persona) listing each pipeline stage with a
recommended model. **Models are chosen *here*, at ingest — never retroactively.** Foot hint
adapts ("Paste a key to continue" → "3 sources · recommended models"); primary **Launch
ingest →** (disabled until keyed).

**Step 3 — Running (the run console).** Title "Building your graph". A **per-stage progress
tracker** — the named stages (Extract · Relate · Group · Embed …) each as a row with a state
(`done ✓` / `active` spinner+bar / `queued ○`), a label+description, a progress bar, and a meta
("done" / "running…" / "queued"). Honest-by-default footnote. Auto-advances to Done.

> **Edge / unhappy states (built in — see the `fault` control in the prototype):**
> - **Stage fails:** the active stage flips to a coral **failed** row (✕, "failed"), a coral
>   warn banner names the stage ("Relate failed. The provider returned an error mid-stage.
>   Earlier stages are saved — retry the run.") + a **↻ Retry run** button.
> - **Rate-limited:** an amber banner — *"Provider rate-limited. Backing off and retrying
>   automatically — no action needed."* The stage shows "rate-limited…" and resumes on its own.
> - **Bad key:** caught at Launch — stay on Configure, show a coral banner ("Provider rejected
>   this key. It's expired or lacks access…"), don't enter the run.
> - **Empty:** Runs/Sources with nothing yet show a dashed empty state pointing to the next action.

**Step 4 — Done (ask your data).** Title "Ask your own data". Same ask UI as M0, now answering
from the *user's* graph with *their* citations (Engineering wiki, runbook.md…). The aha:
*"that's my knowledge."* CTA → next milestone (Verify for Learning/Advanced, Connect for Initial).

## M2 — Verify (make it trustworthy)
**Files:** `Restormel Prototype.html` (m2) · `M2 Make Ready.html` (hub) · `M2 Sub-Screens.html` · `M2 Flow.html`
**Purpose:** Earn trust. Three gates → triage weak claims → production-grade.

- **Trust meter** (top): a big number `/100` with a progress bar; shows `▲ production-grade` when
  all gates clear. Starts at 88 after ingest, climbs to 97 when done.
- **Three gate cards** — *Sources* (every idea sourced), *Embed* (everything retrievable),
  *Validate* (weak claims triaged). Each shows a state: `done · auto` (teal, system did it),
  `needs you` (amber), `needs review` (coral), or a loading state, with a progress bar and an
  Open/View action. Honest about which gates the system cleared automatically vs which need the user.
- **Triage (Validate gate):** flagged-claim rows; for each, the claim + source, and a verdict
  choice — **Accept / Weaken / Unsupported** (A/W/U). One row can show a `SAVING…` state. As
  claims clear, the count drops to **0 left** and trust climbs. Reference the M2 sub-screens for
  the Sources/Embed/Validate detail screens.
- **End state:** "Production-grade — trust 97." → **Mark ready →** (returns to Home, flips graph
  to ready). M2 is **opt-in** — Initial persona skips it entirely.

## M3 — Store (own your stack)  ← advanced only
**Files:** `Restormel Prototype.html` (m3) · `M3 Flow.html`
**Purpose:** Move the graph onto the user's own database — safely.

A 3-step flow (Connect · Data · Keys):

- **Connect.** Title "Connect a database". A **blue info banner**: *"Your graph lives in the
  Restormel managed store today. Moving to your own DB doesn't move it — you'll decide next."*
  Engine picker (SurrealDB…), connection URL / namespace / database fields. Safety hint:
  *"Read-only check — we only confirm we can reach it. Nothing is written."* **Connect & verify →**.
- **Verifying.** A read-only handshake state (spinner + "Reaching {engine} · acme/prod_graph —
  writing nothing").
- **Found (the non-destructive choice).** Title **"This database isn't empty"**. Shows what was
  found ("4,210 nodes, last write 3 days ago"). A choice (radio): **use existing / add to it /
  keep separate** — each with a plain description and its own CTA. A **🔒 safety note**: *"Nothing
  is deleted or overwritten. Your managed copy remains until you confirm the switch — and you can
  switch back at any time."*
- **Keys.** Bring your **production keys** — framed forward-looking ("what the models run on"),
  not a retroactive model table.

## M4 — Connect your app
**Files:** `Restormel Prototype.html` (m4) · `M4 Connect.html` · `M4 Connections.html` · `Connect Redesign.html`
**Purpose:** Wire an app/agent to the graph. First-connection wizard, then a manager.

- **First connection — 3-step wizard** (Type → Access → Name):
  - **Type:** choose how the app connects — **Chat widget** (No code), **MCP** (agents/AI tools),
    **REST API**, **SDK**, **GraphQL** — each a card with an icon (chat bubble / plug / exchange
    arrows / code brackets / node-graph), short description, and a tag. *Not* big letters — icons.
  - **Access:** **Read** ("look things up") vs **Read + write** ("look up *and* contribute back"),
    in plain language with human-named capabilities. Note: *"Want one that looks up and one that
    also contributes? Make two — a read-only and a read+write are just separate connections."*
  - **Name:** a recognisable label (placeholder by type — `site-chat`, `agent`, `backend`…).
    **Create connection →**. A **live preview panel** builds up as you complete each step.
- **Connections manager** (after first, or for Advanced who starts with two): a **list** of
  connections — each row: type icon, name, **access badge** (READ / READ+WRITE), endpoint + Copy,
  status. Add / configure / delete. Users can hold many (e.g. `agent-readonly` + `site-chat`).
- **Connection detail:** endpoint, key (copyable), the MCP/API specifics, access, danger-zone delete.

## Plan B — Autopilot (reference only, not in scope)
**File:** `Plan B — Autopilot.html`. An annotated concept walkthrough (intro + 7 frames + A/B
contrast table) of the alternative "brief an operator" model. See `01_CONCEPT.md` §7. **Do not
build.**

---

## Other reference artifacts in `designs/`
> **For a full artefact-by-artefact guide — what each file is, the decision it captures, and
> _why_ — see `08_ARTEFACTS.md`** (with a rendered screenshot of each). Quick list:

- `Journey Storyboard.html`, `Onboarding Journey.html` — the journey mapped rung-by-rung to
  screens; first-run vs returning-user home.
- `Archetype Analysis.html` — per-screen "minimum to aha" + what each persona needs.
- `M1 Flow.html` / `M2 Flow.html` / `M3 Flow.html` / `M4 Flow.html` — earlier per-milestone
  flow studies (good for copy + state coverage).
- `Route Redesign.html`, `Connect Redesign.html` — the routes + connect detail studies.
