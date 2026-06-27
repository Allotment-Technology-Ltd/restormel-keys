# 02 · Information architecture & navigation

This documents the **final, simplified** navigation — the result of the ruthless-efficiency pass
that cut the IA from ~13 destinations down to a tight spine. This is the shipped model in
`Restormel Prototype.html`.

---

## 1. The problem we fixed

The original IA exposed ~13 destinations across three groups (Work: Home, Sources, Runs, Claims,
Prove, Agents · Foundation: Connections, Gateway keys, Routes, Projects, Model catalog · Observe:
Logs, Usage). Too many, and several **blurred together** — Prove / Agents / Connections /
Gateway-keys all sounded like "connect". The nav didn't mirror how people actually use the app.

## 2. The principle

**Navigation should mirror the user's actual loop, aligned to the ahas:**

> **Build** (it's my knowledge) → **Verify** (I can trust it) → **Connect** (my app uses it)

…hung off a persistent **Home**, with all opt-in depth and occasional config **tucked away, not
promoted**.

## 3. The final navigation

### Primary nav (always visible) — the aha spine

| Slug | Label | Maps to | Purpose |
|---|---|---|---|
| `home` | **Home** | — | Persistent dashboard. Graph status + the one sensible next action. Also where you *ask/prove* your graph. |
| `build` | **Build** | M1 | Add sources, choose models (advanced disclosure), run ingestion, view run history. The ingest loop. |
| `verify` | **Verify** | M2 | The make-ready hub: three trust gates + claim triage. |
| `connect` | **Connect** | M4 | The connections manager: every app/agent connection (widget / MCP / API / SDK / GraphQL), each with access + key. |

Four items. That's the whole primary nav.

### Settings / Advanced (tucked — a collapsed group or a `/settings` area)

| Slug | Label | Was | Notes |
|---|---|---|---|
| `providers` | **Providers** | "Connections" (inbound) | Inbound provider integrations — the LLM/embedding providers ingest & serving run on (Together, Voyage, Anthropic, or the user's own keys). |
| `store` | **Store** | M3 / "Projects" | The graph's storage: Restormel-managed by default, or the user's own database. **Advanced** — this is the M3 destination, deliberately not in the primary spine. |
| `routes` | **Routes** | "Routes" | Saved query configurations the connections expose. Occasional config. |
| `audit` | **Audit log** | "Logs" | Request-level history. |
| `metrics` | **Metrics** | "Usage" | Tokens / requests / cost. |

### What got folded away (and where it went)

- **Runs** → a tab/section *inside* **Build** (it's the history of the ingest action, not a
  separate place).
- **Prove** → an action on **Home** (ask/prove your graph), not its own destination.
- **Agents** + **Gateway keys** → merged into **Connect** (each connection carries its own key;
  "agents" are just MCP-type connections).
- **Model catalog** → reached contextually from **Build** (the per-stage model picker) and
  surfaced in Settings if a standalone catalog is needed.
- **Projects** → the workspace switcher already in the top bar; no separate nav item.
- **Observe (Logs/Usage/Health)** → **Audit log** + **Metrics** under Settings.

### Naming: verbs, not nouns

Primary sections are **action verbs** (Build / Verify / Connect) because they name what the user
is *doing* and reinforce the aha. Home stays "Home". Settings items stay nouns (they're things,
not steps).

## 4. The persistent Home (the hub)

Home is a dashboard of **status tiles**, one per area the user can act on. Each tile has:

- a **status dot** — `idle` (grey, not started / not yet relevant), `todo` (the next action
  lives here), `ok` (done / healthy);
- a **name** (Sources, Verify, Models, Store, Connect, Routes);
- a one-line **status** (e.g. *"1,204 ideas from 3 sources · last ingest 2d ago"*, *"trust 88 ·
  6 flagged"*, *"no app connected"*);
- a single **action** (e.g. *+ Add docs*, *Review →*, *Connect app →*) — the primary next action
  is the only one filled yellow.

Above the tiles sits the **graph hero**: graph name (`starter-graph` before ingest, `acme-graph`
after), key metrics (ideas · trust · sources), and a **live indicator** (Not connected / Live).

Locked tiles (e.g. Connect before any ingest) show a reason, not just a disabled state.

**This home is the single most important screen to get right** — it's where the user lands every
session after the first, and it carries the "opinionated but not trapping" balance.

## 5. Routing & state coupling

- Each primary section and settings item is a **route** (`/`, `/build`, `/verify`, `/connect`,
  `/settings/providers`, `/settings/store`, …). In SvelteKit these are folders under
  `src/routes`.
- The journey position is **derived from graph state**, not a separate wizard router: e.g. if
  `progress.m1` is false, Home's primary action is "Ingest →" pointing at Build; once true, it
  becomes "Connect app →" (or "Review →" for Learning/Advanced personas with flagged claims).
- The mapping milestone→section is: `m0→home, m1→build, m2→verify, m3→store, m4→connect`.

See `05_STATE.md` for the exact state object and transitions, and `06_SVELTE.md` for how to wire
this into the existing nav config.

## 6. Reference file

`designs/Navigation Model.html` — the annotated artifact showing the rail↔home coexistence, the
revisitable areas, and the "redoable actions → where they live" map. `Restormel Prototype.html`
is the working implementation of this nav.
