# 07 · Claude Code prompts (paste-ready, sequenced)

Run these **in order** in Claude Code, inside the Restormel Keys repo, with this handoff folder
available. Each is self-contained, names the design file to reference, and ends with acceptance
criteria. Wait for each to be green before the next.

Before starting, tell Claude Code:
> "Read `design_handoff_restormel_onboarding/README.md` and docs `01`–`06`. These HTML files are
> design references — recreate them as Svelte components in `apps/dashboard` using our existing
> tokens (`packages/keys-tokens`) and utility classes (`.btn`, `.card`, `.brut-*`). Do not copy
> the React or the prototype's inline CSS. Confirm our nav config, routes folder, and token
> package before editing."

---

### Prompt 0 — Recon
```
Explore apps/dashboard and packages/keys-tokens. Report: the router/routes structure, where the
sidebar/topbar shell lives, how navigation is configured (e.g. nav-config), and confirm the
design tokens and .btn/.card/.brut-* classes from 04_TOKENS.md exist. Don't change anything yet —
just give me the map and flag any gaps vs the handoff docs.
```

### Prompt 1 — State store + personas
```
Create lib/onboarding/graph.svelte.ts and personas.ts implementing the state model in
05_STATE.md (OnboardingState, PATHS, applyEffect, freshState) as Svelte 5 runes with localStorage
persistence, per 06_SVELTE.md §3. Add a tiny dev-only persona switch so we can demo Initial/
Learning/Advanced. Acceptance: I can read onboarding state anywhere, complete('m1') sets ideas=
1204/sources=3/flagged=6/trust=88 and persists across reload.
```

### Prompt 2 — Navigation + shell (the IA change)
```
Implement the simplified IA from 02_IA_AND_NAV.md. Primary nav = Home · Build · Verify · Connect.
Tuck Providers, Store, Routes, Audit log, Metrics under a Settings group. Update the nav config
and create the route folders (build, verify, connect, settings/*). Keep the existing sidebar/
topbar shell styling. Fold Runs into Build, Prove into Home, and merge Agents + Gateway keys into
Connect (just routing for now; screens come next). Acceptance: all routes resolve, nav matches
the 4-item spine + Settings, active states work.
```

### Prompt 3 — Home (persistent dashboard)
```
Build the Home route per 03_SCREENS.md (HOME) and the GraphHero + StatusTile components. Tiles:
Sources, Verify, Models, Store, Connect, Routes — each with status dot (idle/todo/ok), one-line
stat from onboarding.graph, and one action; only the first incomplete milestone in the persona
path is the yellow primary action, rest ghost. Show the graph hero (name, ideas·trust·sources,
live pill) and the post-launch "You're live" nudge. First-run variant leads with the M0 ask hero.
Reference Onboarding Journey.html. Acceptance: switching persona + completing milestones changes
which tile is primary and the hero metrics, live across reload.
```

### Prompt 4 — M1 Build: ingest wizard + run console + edge states  (most complex)
```
Build the Build route as the 4-step ingest flow in 03_SCREENS.md (M1): Sources → Configure →
Running → Done, with a stepper. Sources: editable source list with type icons + count. Configure:
one provider-key field + an "Advanced: choose a model per stage" disclosure (collapsed default,
open for Advanced persona) — models are chosen HERE, never retroactively. Running: the per-stage
run console (Extract/Relate/Group/Embed…) with done/active/queued states + progress bars. Done:
the ask-your-data UI (reuse AskGraph) answering from the user's graph with citations.

Implement ALL edge states from 05_STATE.md §7: stage-failure (coral row + named banner + Retry
run), rate-limit (amber auto-backoff banner), bad-key (caught on Launch, stay on Configure), and
empty states. Use a temporary fault toggle to demo them (dev-only). Reference Restormel
Prototype.html + M1 Flow.html + M1 Add Models.html. Acceptance: happy path runs to Done; each
edge state is reachable and matches the copy; completing sets graph per applyEffect.
```

### Prompt 5 — M0 Explore (first-run ask)
```
Build the AskGraph component and the M0 first-run hero per 03_SCREENS.md (M0): input + Ask, three
suggested-question chips, a brief searching state, then answer + citation chips. On the demo graph
pre-ingest it answers from demo data; reused in M1 Done for the user's graph. Reference Restormel
Prototype.html (m0). Acceptance: asking a suggested question shows a cited answer; the same
component works for both demo and user graph.
```

### Prompt 6 — M4 Connect (wizard + manager)
```
Build the Connect route per 03_SCREENS.md (M4). First-connection 3-step wizard (Type → Access →
Name) with a live preview panel: Type = widget/MCP/REST API/SDK/GraphQL as icon cards (icons from
M4 Connections.html, NOT big letters); Access = Read vs Read+write in plain language; Name = label
with per-type placeholder. After first connection, show the connections manager: list of rows
(type icon, name, READ/READ+WRITE badge, endpoint + Copy), add/configure/delete, supports many.
Advanced persona starts with two connections. Reference M4 Connections.html + Connect Redesign.html.
Acceptance: creating a connection adds it to the list and flips graph.connections; manager handles
multiple; access shown in plain words.
```

### Prompt 7 — M2 Verify (make-ready hub + triage)
```
Build the Verify route per 03_SCREENS.md (M2): trust meter (/100 + bar, "production-grade" at
all-clear), three gate cards (Sources/Embed/Validate) with honest states (done·auto / needs-you /
needs-review), and the claim triage (Accept/Weaken/Unsupported rows, one SAVING… state, count →
0 left, trust climbs 88→97). "Mark ready" returns to Home. M2 is opt-in (Initial persona skips).
Reference M2 Make Ready.html + M2 Sub-Screens.html. Acceptance: clearing all gates/claims sets
flagged=0, trust=97, and unlocks "Mark ready".
```

### Prompt 8 — M3 Store (advanced, safe DB move)
```
Build settings/store per 03_SCREENS.md (M3): Connect (engine picker + URL/namespace/db fields +
"read-only check, nothing written" + blue managed-store banner) → Verifying (read-only handshake)
→ Found ("This database isn't empty" + non-destructive use/add/separate choice + "nothing
deleted, switch back anytime" guarantee) → Keys (production keys, forward-looking framing). Add a
connection-failure edge state. Reference M3 Flow.html. Acceptance: walking it sets graph.stack=
'self'; the data choice is non-destructive and clearly reversible; advanced persona only.
```

### Prompt 9 — Polish pass
```
Across all onboarding screens: verify persona-aware paths (Initial m0→m1→m4, Learning +m2,
Advanced +m3) drive every "Next" CTA and Home primary tile; confirm empty/loading/error states;
add trust-meter + progress-bar transitions; honor prefers-reduced-motion; ensure 44px hit
targets and yellow focus rings; remove all dev-only demo affordances behind a flag. Acceptance:
all three persona paths complete end-to-end and match the prototype.
```

---

## Notes for the developer
- **Build order matters** — the store and shell unblock everything; M1 is the riskiest, do it
  early while context is fresh.
- Keep each connection's **own key** model (don't centralise keys into one screen — that was a
  deliberate reversal; see `01_CONCEPT.md` lesson 4).
- The **edge/honesty states are not optional polish** — they're a core product principle
  (`01_CONCEPT.md` lesson 6). Wire them to real ingest/connection errors, don't stub them out.
- **Do not build Plan B (Autopilot).** It's a future north star (`01_CONCEPT.md` §7).
