---
id: REC-ADR-017
title: "Non-destructive, reversible store switch (M3)"
class: decision
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-27
last-reviewed: 2026-06-27
review-interval: P12M
approved-by: founder
approved-on: 2026-06-27
retention: permanent
related: [REC-ADR-013, REC-ADR-014, REC-ADR-015, REC-ADR-016, REC-ADR-018, REC-ADR-019]
---

# ADR: Non-destructive, reversible store switch (M3)

## Status

**Approved as the product direction — founder steer, 2026-06-27:** the Claude Design onboarding handoff is the hard-won, iterative *direction of travel for the product — stick as close to it as possible*. This record’s decision stands as approved; the capture note below is retained for context, and faithful-realisation tensions (e.g. trust-meter/EBV honesty, M3/M4 backend) are tracked in the RES-113 review, not in this decision.

**Draft — design intent captured from the onboarding handoff, pending product confirmation.** This record *captures* a design decision made during the Restormel onboarding design session; it does not authorise or specify a build. It is one of seven ADRs (REC-ADR-013..REC-ADR-019) drawn from `docs/design/onboarding-handoff/`. Tracked under **RES-113** — https://huly.allotmentology.tech/workbench/allotment-pm/tracker/RES-113. Supersede with a new ADR if product confirmation changes the decision; do not rewrite this one.

## Context

M3 "Store" is the fourth aha in the onboarding spine — *"it runs on MY infra."* It is **advanced-only**: the Initial and Learning personas never see it (the Restormel managed store is fine for them), and the mandatory spine for everyone is M0 → M1 → M4 (`01_CONCEPT.md` §3). A graph already lives in the Restormel managed store by the time a user reaches M3; "owning your stack" means pointing Restormel at the user's own database (SurrealDB graph+vector, Neo4j, Postgres+pgvector, or a bring-your-own URL).

The session surfaced a hard-won lesson (`01_CONCEPT.md` §5.7): **a step that touches a customer's own production database must never feel like it could read in, copy over, or destroy their data.** Two failure modes were named to avoid:

1. **Connecting being mistaken for a data move.** Entering a connection URL/namespace/credentials reads as "Restormel is now writing into my DB," when in fact the connect step only needs to confirm reachability.
2. **A non-empty target DB triggering a silent, automatic overwrite or merge.** When the user's DB already holds a graph, an automatic decision about what happens to that data — or to their managed copy — is unacceptable for an advanced user who put real data there.

This ADR captures how the design resolves both: by separating *reach* from *data*, and by making the data outcome an explicit, reversible, non-destructive choice.

## Decision

**The M3 store switch is non-destructive and reversible by design. Connecting your own database only proves Restormel can _reach_ it — nothing is read in, copied, or overwritten at connect time — and any decision about existing data is an explicit, reversible choice framed with a safety guarantee.**

Concretely, the captured design holds three commitments:

1. **The connect step is a read-only verify handshake (step 1a).** Choosing an engine and entering connection URL / namespace / database / encrypted credentials performs a **read-only reachability check only** — "we only confirm we can reach it. Nothing is written." The data decision is deferred to a *separate, explicit* step (1b). The screen states plainly that the graph still lives in the Restormel managed store and that connecting does not move it.

2. **A non-empty target DB yields a non-destructive, three-way choice (step 1b).** When the verify handshake finds the target DB already contains a graph, Restormel **inspects it, states plainly what is there** (e.g. "Connected to SurrealDB · acme/prod_graph · 4,210 nodes, last write 3 days ago") and offers an explicit choice — **never an automatic overwrite**:
   - **Use the graph that's already here** — serve the existing nodes; the managed graph stays as a separate, untouched copy.
   - **Add my managed graph alongside it** — copy the managed graph in next to the existing data; nothing is overwritten, duplicates are flagged not merged.
   - **Keep them separate** — leave the existing graph alone and place yours in a new namespace.
   If the DB is empty, this collapses to a single line ("Empty — we'll copy your graph in").

3. **Destructive-sounding actions carry an explicit safety guarantee.** The choice is presented under an explicit, reassuring guarantee: **"Nothing is deleted or overwritten. Your managed copy remains until you confirm the switch — and you can switch back at any time."** The framing makes clear the user is only *choosing where reads come from* — a reversible binding, not a destructive migration. Production keys, set in the subsequent step (step 2), are framed forward-looking ("what the models run on") rather than as a retroactive table.

## Rationale

- **Trust is the whole point of M3.** An advanced user connecting their own production DB is the most exposed moment in the journey. A single perceived risk of data loss negates the "it runs on MY infra" aha. Separating *reach* from *data* removes the ambiguity that creates that fear.
- **Honesty by default is a standing product principle** (`01_CONCEPT.md` §5.6/§5.7): no silent magic, no automatic overwrite, name exactly what is there and what will happen. The three-way choice makes the system's behaviour legible instead of magical.
- **Reversibility lowers the cost of the decision.** Because the managed copy is retained until the user confirms and they can switch back, the store switch becomes a low-stakes, explorable action rather than an irreversible commitment — consistent with the broader "redoable actions, persistent home" model (`01_CONCEPT.md` §4).
- **Plain, non-jargon framing** of a destructive-sounding action mirrors the same plain-language discipline applied to access levels elsewhere in the journey (`01_CONCEPT.md` §5.5).

## Source artefact

- **Design mock:** `docs/design/onboarding-handoff/designs/M3 Flow.html` — the 3-step own-your-store flow (Connect → Data → Keys), the read-only verify handshake (step 1a), and the non-destructive use/add/separate choice with the "nothing is deleted, switch back anytime" guarantee (step 1b).
- **Screenshot:** `docs/design/onboarding-handoff/screenshots/06-m3-flow.png`.
- **Concept lesson:** `01_CONCEPT.md` §5 lesson 7 ("Safety framing for destructive-sounding actions").
- **Artefact guide:** `08_ARTEFACTS.md` §B (`M3 Flow.html` entry) and the provenance map ("Non-destructive, reversible DB switch → `M3 Flow.html` → `01` §5.7").
- **Build prompt (intent, not authorisation):** `07_PROMPTS.md` prompt 8 (settings/store: Connect → Verifying → Found → Keys, "the data choice is non-destructive and clearly reversible; advanced persona only").

## Consequences

- **A read-only verify path is the realisation surface, not a new build mandated here.** The worktree already carries a read-only connectivity-test path that fits this intent: the `graph-store-config/test` endpoint (`apps/dashboard/src/routes/keys/dashboard/api/connect/pipeline/graph-store-config/test/+server.ts`) tests draft or saved config via `adapter.healthCheck()` (`testGraphStoreConfigDraft` / `testSavedGraphStoreConfig` in `apps/dashboard/src/lib/server/connect/graph-store-config.ts`) without writing — the natural home for the step-1a handshake. Config save/clear (`saveWorkspaceGraphStoreConfig` / `clearWorkspaceGraphStoreConfig`, migration `051_workspace_graph_store_config.sql`) is where the reversible "switch back" guarantee would land. Whoever builds M3 should preserve the *intent* and adapt the *mechanic* (`08_ARTEFACTS.md` "keep the intent, adapt the mechanic").
- **Connect must be read-only and side-effect-free.** The reachability check must never write, copy, or migrate; any deviation breaks the captured guarantee and would need a superseding ADR.
- **The managed copy must be retained until the user explicitly confirms a switch**, and a path back to it must remain — the reversibility promise is load-bearing copy, not decoration.
- **Inspecting a non-empty target DB is itself a read of customer data** (node counts, last-write timestamps); when this is built it touches keys/credentials/Connect/Postgres and therefore routes through the **`restormel-high-risk-security`** review, and any read/storage of customer-store metadata is assessed against the records/data-handling norm (potential DPIA/RoPA touchpoint).
- **Engine breadth** (SurrealDB / Neo4j / Postgres+pgvector / BYO URL) is named by the mock but the supported set at build time is a build decision, not fixed by this record.

## Scope boundary — what this does NOT decide

- **This ADR captures intent; it does not authorise or specify the build.** No code, schema, endpoint, or UI is mandated here. The build is gated on product confirmation and the relevant review gates.
- **Plan A (the journey + persistent home) MVP only.** Plan B "Autopilot" is explicitly out of scope (`01_CONCEPT.md` §7) — including its "non-destructive data choice as an operator pause"; this record says nothing about it.
- **It does not decide** the exact engine list, the merge/dedup semantics for "add alongside" (the mock says duplicates are *flagged, not merged* — the algorithm is undecided), credential-encryption mechanics, the production-keys binding model (a separate M3 step / its own decision), data-residency/region selection, or any migration/copy implementation for the eventual "switch" itself.
- **It does not decide** which personas beyond Advanced may ever reach M3, nor M3's placement in the IA beyond "advanced-only, under Settings → Store" as captured in the nav model.

---

*Append-only record. If the decision changes, supersede it with a new ADR that references this id (REC-ADR-017) and links from RES-113 — do not rewrite this file.*
