---
id: REC-ADR-018
title: "Job-led Connect — one area, many connection shapes"
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
related: [REC-ADR-005, REC-ADR-013, REC-ADR-014, REC-ADR-015, REC-ADR-016, REC-ADR-017, REC-ADR-019, REC-PLAN-017]
---

# ADR: Job-led Connect — one area, many connection shapes

## Status

**Approved as the product direction — founder steer, 2026-06-27:** the Claude Design onboarding handoff is the hard-won, iterative *direction of travel for the product — stick as close to it as possible*. This record’s decision stands as approved; the capture note below is retained for context, and faithful-realisation tensions (e.g. trust-meter/EBV honesty, M3/M4 backend) are tracked in the RES-113 review, not in this decision.

**Draft — design intent captured from the onboarding handoff, pending product confirmation.**
This ADR records a design decision surfaced during the Restormel onboarding design session and
handed off in `docs/design/onboarding-handoff/`. It captures intent; it does **not**
authorise or specify a build. Tracked by **RES-113** —
https://huly.allotmentology.tech/workbench/allotment-pm/tracker/RES-113.

## Context

"Connecting" a finished graph to a customer's apps and agents (milestone **M4 Connect** —
*"my product can use it"*) was, in the pre-redesign product, scattered across several separate
notions: **Prove**, **Agents**, and **Gateway-keys** (plus a "publish routes" ceremony). The
onboarding session found this fragments one concept into three places, makes the user assemble the
mental model themselves, and leaks infrastructure jargon (MCP, OAuth scopes, "publish") onto a
person who has just earned their first cited answer and does not yet have that model.

Two further facts shaped the decision:

- **Serving has many shapes, but it is one job.** A chat widget, an MCP connection for an agent, a
  REST API for a backend, an SDK call, and a GraphQL query are all the same underlying act — *let
  my app, agent, or site ask the graph questions and answer from its knowledge*. The differences
  are surface and access, not concept.
- **Real users hold several connections at once.** A typical estate is a read-only agent *and* a
  read+write backend that contributes back — so the area must persist a *list* a user grows over
  time, not a single one-shot setup. (The handoff's Advanced persona even starts with two
  connections already present.)

The handoff therefore reframes Connect around the user's job ("what are you building?" /
"let your app ask it questions"), not the mechanism ("turn your graph on (MCP)").

## Decision

**Connect is ONE area that holds a list of connections** — the single home for serving a graph,
consolidating what was previously split across Prove, Agents, and Gateway-keys.

Within that one area:

- **Each connection is a TYPE** — chat widget · MCP · REST API · SDK · GraphQL — shown as
  **icon cards, not single-letter avatars** (a specific session note that single letters read
  poorly).
- **Each connection has an ACCESS LEVEL** — **read** vs **read+write** — explained in **plain,
  human language**: *"look things up"* vs *"look up **and** contribute back"* — never OAuth /
  scope / capability jargon.
- **Each connection carries its OWN key.** Keys are *not* centralised into one shared screen;
  per-connection keys are a deliberate reversal of an earlier "all keys in one table" treatment.
- **The first connection uses a 3-step wizard — Type → Access → Name** — with a live preview panel
  that builds up as the user chooses, leading with the aha ("my app can reach my graph") and
  deferring everything else.
- **After the first connection it becomes a manager** — a list of connection rows (type icon,
  name, READ / READ+WRITE badge, endpoint + copy, status) with **add / configure / delete**
  (delete in a danger zone) and a per-connection detail view.
- **Connections are persistent and plural.** A user can hold many, indefinitely.

## Rationale

- **One concept, one place, one mental model.** Collapsing Prove/Agents/Gateway-keys into a single
  Connect area means the user learns *connections* once and applies it to every shape, instead of
  reconciling three vocabularies (`01_CONCEPT.md` §5.4).
- **Job-led, not jargon-led.** Leading with "what are you building?" and naming access in human
  terms keeps the milestone on the aha and off the infrastructure — consistent with the whole
  bundle's rule of headlining outcomes, not nouns (`01_CONCEPT.md` §2, §5.5).
- **Wizard for the first, manager for the rest** matches how the surface is actually used: the
  first time needs hand-holding to a single decision; subsequent use is curation of a growing set.
  A persistent list is required because holding several connections is the normal case, not an
  edge case.
- **Per-connection keys preserve least-privilege and honest blast radius** — a read-only agent and
  a read+write backend should not share a credential; centralising keys would have blurred that and
  was explicitly reversed.
- **Icons over letters** is a concrete legibility fix recorded in-session, not a style preference.

## Source artefact

- `docs/design/onboarding-handoff/designs/M4 Connect.html` — the first-connection 3-step
  wizard (Type → Access → Name), live preview panel, type icon cards, plain-language read vs
  read+write. Screenshot: `screenshots/07-m4-connect.png`.
- `docs/design/onboarding-handoff/designs/M4 Connections.html` — the connections manager: the
  list of many connections (type icon, access badge, endpoint, status), add / configure / delete
  (danger zone), and the connection detail view; canonical source for the icon set. Screenshot:
  `screenshots/08-m4-connections.png`.
- `docs/design/onboarding-handoff/designs/Connect Redesign.html` — the "before → after"
  redesign study: the consolidation of Prove / Agents / Gateway-keys into the single Connect area
  and the reframing of "publish routes" into letting the graph be asked. Screenshot:
  `screenshots/14-connect-redesign.png`.
- `01_CONCEPT.md` **§5.4** ("Connect is one concept with many shapes") and **§5.5** ("Use plain
  language for access").
- `08_ARTEFACTS.md` **§B** (the `M4 Connect.html` / `M4 Connections.html` per-milestone studies),
  **§D** (the `Connect Redesign.html` redesign study, "the seed of lesson 4"), and the
  provenance map ("Connect = one area, many shapes" → `Connect Redesign.html`,
  `M4 Connections.html` → `01_CONCEPT.md` §5.4).
- Build framing: `07_PROMPTS.md` **prompt 6** (M4 Connect — wizard + manager, "keep each
  connection's own key model — don't centralise keys").

## Consequences

- **An IA consequence follows.** What were separate destinations (Agents, Gateway keys) and
  notions (Prove, publish-routes) collapse into the single Connect spine item — the merge that
  `07_PROMPTS.md` prompt 2 anticipates ("merge Agents + Gateway keys into Connect"). This ADR
  captures the *Connect-internal* shape; the four-item nav spine itself is recorded separately.
- **Two distinct surfaces share one area:** an empty/first-run wizard and a populated manager. The
  build must branch on "zero vs ≥1 connection," and the manager must scale to many rows with
  per-row state (status, endpoint, copy, configure, delete).
- **Per-connection keys imply per-connection lifecycle** — creation, display-once/rotation, and
  deletion (danger-zone) all attach to a single connection, not to a global key table. This touches
  keys/credentials and a server connections surface, so the actual build is in scope for the
  `restormel-high-risk-security` review before any PR — out of scope for this captured decision.
- **Plain-language access must map onto real authorisation.** "Look things up" / "look up and
  contribute back" is the user-facing label for what is, underneath, a read vs read+write scope on
  a key; the mapping (and its enforcement) is a build/security concern this record does not specify.
- **The icon set becomes an asset dependency** (chat / MCP-plug / API / SDK / GraphQL), sourced
  from `M4 Connections.html` — not single letters.
- **Realisation surface already partly exists.** The repo already carries a `connect` area shell
  (`apps/dashboard/src/routes/connect/`), a connections API (`apps/dashboard/src/routes/keys/v1/
  connections/` incl. `[connectionId]`), and Connect components under
  `apps/dashboard/src/lib/components/connect/` (e.g. `ConnectAgentSetup.svelte`). The decision's
  intent is that *this one area* is Connect's home — naming the surface, not designing its
  implementation.

## Scope boundary

What this ADR does **not** decide:

- **It does not authorise or design a build.** This is **captured intent, not an implementation**;
  the artefacts encode the decision (order of steps, the framing of access, the per-connection-key
  reversal, icons-not-letters), and where the real API forces a different mechanic, the intent is
  preserved and the mechanic adapted (`08_ARTEFACTS.md`, "How to treat these artefacts").
- **It scopes to Plan A only.** Plan A — the guided journey + persistent home — is the MVP. **Plan B
  ("Autopilot") is explicitly out of scope** (`01_CONCEPT.md` §7) and this decision must not be read
  as endorsing it.
- It does **not** specify the connection **data model, storage, key format, rotation policy, or
  scope-to-label mapping**, nor the exact **icon assets** — those are build/security decisions.
- It does **not** decide the other milestones (M0 Explore, M1 Build, M2 Verify, M3 Store) or the
  overall navigation spine; those are captured in their own records in this set.
- It does **not** stand in for the mandatory `restormel-high-risk-security` review that any
  keys/credentials/Connect/server-route work will require before a PR.

---

## Addendum — M4 requirements pinned (founder, 2026-06-27)

These founder decisions refine *how* M4 is realised; they bind the build without changing the
captured design intent above. Grounded in the RES-113 review, **REC-PLAN-017** (verified-context
market positioning — the strategic basis) and the live code surface.

1. **MVP connection types = MCP + REST only.** Of the five designed type cards, the MVP ships
   **MCP** — the strategic hero (Door-1 verified-retrieval, lowest-friction distribution per
   REC-PLAN-017 §5) — and **REST** (non-MCP consumers via AAIF / Connect v1, which already exists).
   **Chat widget, SDK and GraphQL are deferred**: they have no backend and are on no plan or
   backlog. Show them as "coming soon" or omit them. The "five equal type cards" mock is
   re-weighted to MCP-first / REST-second; this is a faithful adaptation, not a contradiction
   (`08_ARTEFACTS.md`: keep the intent, adapt the mechanic).

2. **Access level is an ENFORCED scope, not a cosmetic label.** "Read" genuinely restricts to
   retrieve; "read+write" gates `connect.memory.write`. Today keys are workspace-scoped with
   identical read+write permissions, so this is a real authorisation change — key-side scope
   metadata + an auth gate + a migration + a mandatory `restormel-high-risk-security` review. The
   plain-language framing ("look things up" vs "look up *and* contribute back") sits on top of a
   real scope, so the badge means what it says (honesty principle).

3. **The MCP connection serves BOTH doors.** Door-1 (first-party): connect an agent to the
   verified-retrieval MCP of the graph the user just built — the onboarding aha. Door-2 (verifying
   proxy): wrap the user's own / a commodity MCP server into verified envelopes — **REC-ADR-005**
   and the in-flight W-series backlog (RES-16/17/27). M4's Connect area surfaces **both**, pulling
   Door-2 into onboarding rather than leaving it a separate distribution-only play. (Exact
   sequencing against the W-series is a build/roadmap call, not a requirement; REC-PLAN-017 §5
   sequences Door-1 before Door-2.)

4. **A connection is not a separate entity over a generic gateway-key pool — the key _is_ the
   connection.** Move away from "gateway keys" as a generic, purpose-free credential. A key is
   minted **purpose-bound**: created for a specific function and **directly tied to what it
   facilitates** — carrying its connection **type** (MCP / REST), **access level** (read /
   read+write) and **target** (the graph/workspace it serves), plus label and status. Realisation
   extends the key record itself (purpose/type/access/target/status on `api_keys`) rather than a
   separate `serving_connections` table that FK-references a key table. The design's "each
   connection has its own key" becomes **"each connection *is* a purpose-built key"**; per-connection
   lifecycle (create / display-once / rotate / revoke) attaches to that purpose-bound key.

These resolve the RES-113 review's M4 open questions (the MVP-type scope, Q16–Q19); the review is
updated to mark them resolved and to carry the same answers.

> Pinned by founder via the RES-113 requirements Q&A, 2026-06-27. Recorded as an append-only
> addendum; supersede with a new ADR if these change.

---

**Append-only.** This record is append-only. If this decision changes, **supersede it with a new
ADR** that references this id — do not rewrite this file in place.
