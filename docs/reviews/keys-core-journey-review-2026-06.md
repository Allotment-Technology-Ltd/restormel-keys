# Keys core journey review — June 2026

**Date:** 2026-06-11 · **Brief (product owner):** review of the Restormel Keys dashboard
functionality, including the ability to create and save gateway keys, set up saving of provider
keys, and setting up and saving of ingestion routes — ensuring there is a coherent experience to
pull all of the keys and connect functionality together. *Now that the primary use-case is
Connect, Keys is a core component to ensure that the Connect module actually delivers for users.*

**Method:** code-level journey tracing of the four credential/config journeys end to end —
every UI surface, BFF endpoint, and data-layer function on each path, with file:line break
points. Cross-referenced against
[`dashboard-functionality-review-2026-06.md`](dashboard-functionality-review-2026-06.md)
(**FUNC**), [`dashboard-ux-review-2026-06.md`](dashboard-ux-review-2026-06.md) (**UX**),
[`docs/design/dashboard-world-class-roadmap.md`](../design/dashboard-world-class-roadmap.md) (**W-stages**),
[`docs/architecture/keys-routing-contract.md`](../architecture/keys-routing-contract.md), and the
`restormel-keys-routing` skill. Findings are marked **NEW** (not in either prior review) or
**DEEPENS** (sharpens a prior finding with new evidence). Review only; **no code changed**.

**In-flight boundary:** W1.5 (route/policy publish un-stranding) and W2.1 (explorer URL
contract, PR #253) are being delivered by other agents. This review works **around** them:
findings that W1.5 will partially close are marked, and the Wave K stages declare dependencies
on them rather than duplicating their scope.

**Verdict in one line.** Each journey works at the *storage* layer (keys hash-stored,
credentials AES-256-GCM encrypted, routes versioned and stage-bound) — but the *assurance*
layer is hollow: labels are an illusion, "Verify now" verifies nothing, the one prerequisite
that most often breaks a first Connect run (provider→project binding) is checked by a readiness
endpoint **no UI consumes**, and once a run does execute, nothing records which route served
it. Keys stores credentials well; it cannot yet *prove to the user that Connect will work*.

---

## 1. Journey maps

### 1.1 Gateway keys: create → label → save → copy-once → use → rotate → revoke

| Step | What happens | Break point |
|---|---|---|
| Create | `access/+page.svelte:53-62` POSTs `api/projects/[id]/keys` — **with no request body at all** | The label field's value is never sent (BP-1) |
| | Server `createApiKey(projectId, userId)` accepts no label (`api/projects/[id]/keys/+server.ts:21`; `lib/server/neon.ts:894-927`); `api_keys` row = id, prefix, hash, created_at | No `label` column (BP-1) |
| Label | UI writes label to `localStorage["rk_key_labels"]` keyed by **prefix** (`access/+page.svelte:83-86`) | Per-browser illusion; duplicated verbatim in `ConnectAgentSetup.svelte:127-132` (BP-1, BP-2) |
| Save / copy-once | New-key box, copy / .env-snippet / "Use in MCP setup" (`access/+page.svelte:168-183`); raw key handed to MCP setup via consume-once sessionStorage (`lib/connect/connect-gateway-key-storage.ts`) | Works well — the one deliberately designed Keys⇄Connect seam. `savedAt` is stored but never TTL-checked on consume (BP-3) |
| Use | `verifyGatewayKey` authenticates resolve/Connect v1 calls **and updates `api_keys.last_used_at`** (`neon.ts:826`) | `listApiKeys` doesn't SELECT `last_used_at` (`neon.ts:864-869`) and the page load drops even `createdAt` (`access/+page.server.ts:32-37`) — the data exists and is thrown away twice (BP-4) |
| Rotate | — | **No rotate affordance exists.** Manual create-new + revoke-old, with no created-at/last-used shown to even judge a key's age, and no overlap guidance (BP-5) |
| Revoke | Hard `DELETE` with `confirm()` (`access/+page.svelte:126-140`, `neon.ts:930-950`); audit events on create + revoke ✅ | No grace window / undo; fine for now |
| Audit | `/access/audit` fixed 50 rows | FUNC P2-5, unchanged |

Also: the access load is an N+1 (`listApiKeys` per project in a loop,
`access/+page.server.ts:29-39`).

### 1.2 Provider / BYOK credentials: add → encrypted storage → verify → dependents → rotate/remove

| Step | What happens | Break point |
|---|---|---|
| Add | `integrations/+page.svelte:125-160`: **Hosted API key** (encrypted) or **credential reference** (non-secret vault label) | Two modes with radically different *capabilities*, presented as equivalent (BP-6) |
| Encrypted storage | Migration `024_provider_credential_encryption.sql`: AES-256-GCM ciphertext + IV + auth tag + display suffix; `server_misconfigured` 503 when `RESTORMEL_CREDENTIALS_ENCRYPTION_KEY` unset (`api/integrations/+server.ts:66-71`) | Solid — honest failure when encryption is unconfigured ✅ |
| Verify | "Verify now" (`integrations/[id]/+page.svelte:188-193`) → `runIntegrationVerificationProbe` (`lib/server/integration-verify.ts:15-33`) | **The probe is a stub.** It never calls any provider: any stored credential → `"pending"` + "Credential is stored…"; the only `"failed"` is *no credential at all*. A typo'd key "verifies" (BP-7) |
| Dependents | Project bindings listed with confirm-on-remove ✅ | No view of *routes/steps* or *Connect stages* that resolve to this provider; delete confirm says "all bindings will be removed" but not what stops working (BP-8) |
| Rotate | — | None: delete + recreate, losing bindings (FUNC P2-4) — and now also silently losing the Connect ingest dependency (BP-9) |
| Other | "Model discovery … not yet wired" stub block (`integrations/[id]/+page.svelte:266-272`) | FUNC P2-4, unchanged |

**The capability split (BP-6) is the sleeper:** Connect ingest, hosted runtime invoke, and the
Testing judge all require a **decryptable hosted key** —
`findDecryptedApiKeyForResolvedProvider` (`lib/server/runtime-invoke.ts:28-63`) and
`bootstrapRestormelTestingIntegration` (`lib/server/testing-bootstrap.ts:40-42`, filters
`hasEncryptedCredential`). A credential-reference connection satisfies every readiness count in
the product (`integrationsCount` in `evaluateConnectModelsReady`,
`lib/server/connect/stage-routing.ts:216-240`; the hub's `ai_keys` step) yet can execute
nothing. No surface says so.

### 1.3 Ingestion routes: create → steps/fallbacks → bind to Connect stages → save → publish → observe

| Step | What happens | Break point |
|---|---|---|
| Create | `connect/models` per-stage "Create route" POSTs `workload: ingestion, stage: ingestion_*`, then jumps into the visual builder with a return-bar (`connect/models/+page.svelte:129-165`; `ConnectBuilderReturnBar`) | Good — the side-task return pattern is the strongest UX idea on the seam ✅. Duplicate `(workload, stage)` 409 handled with a human message ✅ |
| One-click path | "Reset to recommended" → `applyRecommendedIngestionRoutes` (`lib/server/connect/apply-recommended-routes.ts:167-274`): creates routes, sets cross-family steps, **publishes server-side**, binds route ids into the workspace routing config | Strong — but it deletes **all** existing steps per stage route (`:139-142`); the confirm copy does say "overwritten" ✅ |
| Steps / fallbacks | Builder supports rich steps per the routing contract (`fallbackOn`, `switchCriteria`, pools) | — |
| Bind to stages | Workspace routing config: `project_id` + `environment_id` + per-stage route ids (`stage-routing.ts`); saved from `connect/models` or by apply-recommended | Connect defaults to `routing.project_id ?? projects[0]` (`connect-models-load.ts:50`) — often the auto-provisioned Testing project, by *coincidence* the only project that gets provider bindings (see 1.4) |
| Publish (manual path) | Builder banner: "Publish from version history…" (`projects/[id]/routes/[routeId]/+page.svelte:1618-1621`) — a screen that doesn't exist (FUNC P0-1, **W1.5 in flight**) | `connect/models` shows **"Draft — publish to use"** (`connect/models/+page.svelte:167-174`) with **no publish control on that page either** — the instruction dead-ends on both sides of the seam (BP-10) |
| Observe | Run console shows stage progress + log lines | **Nothing records which route/step/model served a stage.** `callResolvedChat` discards the resolved route metadata after each call (`stage-route-generate.ts:75-180`); job telemetry (migration 044) stores logs/progress only; the sole persisted attribution is the validation judge's model id on claim judgments (`ingest-full-runner.ts:197`) (BP-11) |
| Observe (logs) | — | Connect ingestion resolves **server-side** via `resolveRouteForExecution` — it never passes the HTTP resolve endpoint, which is where `insertRequestLog` lives (`api/projects/[id]/resolve/+server.ts:120-263`). **Connect traffic is invisible in Keys Logs and Usage** (BP-12) |

### 1.4 The Keys⇄Connect seam: "I want verified context" → keys + credentials + routes correctly set up

The execution chain a first Connect run actually needs (from
`stage-route-generate.ts:95-167` + `runtime-invoke.ts:28-63`):

```
workspace → routing config (project+env) → published stage route (chat + embedding)
  → resolve picks provider/model → provider BINDING on that project for that provider
  → integration has DECRYPTABLE hosted key → encryption key configured on deployment
```

What the journey actually checks before letting you run:

- **Hub ledger `ai_keys` step** (`connect-journey.ts:155-164`; `connect-hub-load.ts:96-131`):
  published chat + embedding routes AND `integrations.length > 0`. It does **not** check
  hosted-vs-reference credential, provider binding on the routing project, or whether the
  bound providers cover the route steps' providers.
- **Launch gate** (`ConnectPipelineReviewLaunch.svelte:36`): `documents > 0 && packId &&
  modelsReady` — same blind spots.
- **Binding creation paths:** exactly two in the codebase — the manual "Add binding" form on
  the integration detail page (`api/integrations/[id]/bindings/+server.ts:32`) and the
  **Testing-project-only** bootstrap (`testing-bootstrap.ts:35-77`). **Nothing on the Connect
  path creates or verifies a provider binding.** If the routing project is the auto-created
  Testing project, the run works by coincidence; if the user picked their own project, every
  stage call fails `Provider credentials missing (no_provider_binding)` after up to 12 resolve
  attempts per call (`stage-route-generate.ts:141-154`), surfacing only as a raw `job.error`
  string with no fix link.
- **The check that would catch all of this already exists** —
  `GET api/projects/[id]/readiness` (`api/projects/[id]/readiness/+server.ts`) returns
  status/issues/recommendations including `no_provider_bindings` (high), `no_routes` (high),
  `routes_without_enabled_steps` (medium), policy coverage (low). Repo-wide grep: its only
  reference is a docs bullet (`routes/keys/docs/cloud-api/+page.svelte:362`). **Zero dashboard
  consumers.**
- **Wizard prerequisite surfacing:** the `returnTo` side-task loop (models page ⇄ wizard ⇄
  builder) is genuinely coherent ✅. But the two top-level checklists are disjoint worlds: the
  Overview checklist is pure Keys-routing (project → connection → gateway key → route → sandbox
  request → logs, `activity/+page.svelte:81-89`) and its "first request" step points at the
  sandbox, which cannot exercise a gateway key or route (FUNC P1-3); the Connect ledger
  (store → keys → sources → run → agents) never mentions gateway keys until the optional
  "agents" step. Neither references the other (UX IA-3).
- **Cross-model validation** — the reason "keys is a core component" — exists only as ranking
  logic: `model-guidance.ts:73-89` routes validation to a different provider family and flags
  `sameProviderFallback` when it can't. The flag surfaces as a small chip on `connect/models`
  rows; no readiness surface ever says "you have one provider family — add a second to get
  cross-model validation," and nothing counts *decryptable families* anywhere.
- **Readiness views that do exist:** the hub `setupHealth` (graphStore / routesReady /
  encryptionReady / documentsReady — `connect-hub-load.ts:182-189`) and the *graph* readiness
  wizard (catalog/link/embed/validate — `graph-readiness.ts`, post-ingest). There is **no**
  view answering the brief's question — "gateway key ✓, 2 provider families ✓, stage routes ✓"
  — anywhere.

---

## 2. Findings

### P0 — trust-destroying or first-run-breaking

**K-P0-1 · "Verify now" verifies nothing — a credentials product with a placebo verify button.**
**NEW** (FUNC graded integrations "solid"; the stub was not caught).
`runIntegrationVerificationProbe` (`lib/server/integration-verify.ts:15-33`) makes no network
call: any stored credential returns `"pending"` with "Credential is stored. … automated probes
are not enabled for this type yet"; the UI top-line still reads "Status & verification" with a
"Verify now" button and reports "Verification updated." A typo'd or revoked API key passes
"verification" and fails 10 minutes into the user's first ingest run — inside a 12-attempt ×
multi-stage retry loop (`stage-route-generate.ts:91-177`) that makes the failure slow and
opaque. The sandbox already proves per-provider key validation is implementable client-side;
the server holds the decrypted key and can do it properly.
**Fix:** real per-provider probes (cheapest authenticated endpoint, e.g. model-list) using the
decrypted hosted key; `verified / failed / pending` become honest states; credential-reference
mode gets explicit "cannot be verified or executed by Restormel" copy. (Wave K2.)

**K-P0-2 · The most likely first-run breaker — provider→project binding — is created nowhere
and checked nowhere on the Connect path, while the endpoint that detects it has no UI.**
**NEW.** Full chain in §1.4. Three compounding facts: (a) Connect run execution requires a
`provider_bindings` row matching the routing project + resolved provider
(`runtime-invoke.ts:40-48`); (b) the only automatic binding creation is Testing-project
bootstrap (`testing-bootstrap.ts`), so Connect-on-own-project fails by default; (c)
`GET api/projects/[id]/readiness` flags exactly this (`no_provider_bindings`, severity high)
and is consumed by zero UI. The hub `ai_keys` step and the launch gate both report ready.
**Fix:** launch preflight + one-click "bind provider to this project" + readiness surface
(Wave K3/K4); `applyRecommendedIngestionRoutes` should ensure bindings for the providers it
just wired, mirroring the Testing bootstrap.

**K-P0-3 · Publish stranding spans the seam — both sides of the instruction dead-end.**
**DEEPENS FUNC P0-1 / W1.5 (in flight).** W1.5 adds the Versions tab + publish button to the
*builder*. But the Connect side has its own dead end this review found: `connect/models` rows
show **"Draft — publish to use"** (`connect/models/+page.svelte:167-174`) with no publish
control or link to one — and until W1.5 merges, nowhere it could link *to*. A user who edits a
recommended route (e.g. swaps the validation model) silently demotes that stage to a draft that
ingestion will never use, while the only working publish paths are server-side
(apply-recommended) or raw API.
**Fix (after W1.5):** the stage row's "Draft — publish to use" becomes a link to the builder's
Versions tab (or an inline publish action calling the same endpoint). Declared as a W1.5
follow-up inside Wave K4, **not** a duplicate of W1.5.

### P1 — major gaps vs "Keys makes Connect deliver"

**K-P1-1 · Gateway-key labels aren't just localStorage-only — the UI silently drops them, and
the metadata to do better already exists in the database.** **DEEPENS FUNC P1-5 / W3.7.**
New evidence beyond FUNC: (a) the create POST sends **no body** (`access/+page.svelte:59-62`)
and the server accepts none (`keys/+server.ts:21`) — the label input is theatre; (b)
`api_keys.last_used_at` is **already written on every key use** (`neon.ts:826`) but never
SELECTed for the UI (`neon.ts:864-869`); (c) `createdAt` is returned by the data layer and
dropped by the page load (`access/+page.server.ts:32-37`); (d) the localStorage-label pattern
is duplicated in `ConnectAgentSetup.svelte:127-132`, so the MCP setup shows different labels
than a teammate's Access page. **The right contract:** `label` is a server-side column set at
create (body `{ label?: string }`) and editable later; list returns `label`, `createdAt`,
`lastUsedAt`; localStorage map read once as a legacy fallback and offered for one-click
migration; prefix-keyed client labels deprecated. This sharpens W3.7's acceptance criteria
(below).

**K-P1-2 · Neither credential class can be rotated.** **DEEPENS FUNC P2-4 + §4 gap 8.**
Gateway keys: no rotate flow (create + revoke as unguided manual steps, with no age/last-used
visible — K-P1-1 — to even decide). Provider credentials: re-entering a key means delete +
recreate, destroying bindings (`integrations/[id]/+page.svelte:111-130`) and now also the
invisible Connect dependency (K-P0-2). For a product whose pitch includes credential hygiene,
rotation is table stakes: re-enter-credential-in-place for integrations; guided
create-replacement → copy → revoke-old for gateway keys.

**K-P1-3 · Credential-reference connections count as "ready" everywhere and can execute
nothing.** **NEW.** `evaluateConnectModelsReady` counts `integrations.length`
(`stage-routing.ts:237`), the hub `ai_keys` detail counts "N connection(s)", apply-recommended
gates on `integrations.length === 0` — none distinguish `hasEncryptedCredential`. Every
execution path (Connect ingest, runtime invoke, Testing judge) requires the decryptable hosted
key and fails `credential_unavailable` at run time. **Fix:** readiness counts use *decryptable*
integrations; reference-mode rows get a "reference only — not executable" badge in Connections
and `connect/models`.

**K-P1-4 · A run cannot answer "which route/model served this?", and Connect traffic is
invisible in Keys observability.** **NEW.** Evidence in §1.3 (BP-11/12). The product sells
provenance for *claims* while its own pipeline has none for *infrastructure*: post-run you
cannot confirm cross-model validation actually used a different family (the core promise),
and Logs/Usage show nothing for ingest. **Fix:** persist per-stage resolved
`{routeId, stepId, provider, modelId, attempts}` into job progress/telemetry; render a
"Served by" line per stage in the run console; tag server-side resolves into request logs
(`source: connect_ingest`) or a dedicated attribution table. (Wave K5; feeds UX 3.5
"prove it" and pairs with W3.3 logs.)

**K-P1-5 · The readiness primitive exists server-side and is wasted.** **NEW.**
`GET api/projects/[id]/readiness` already returns status/issues/recommendations in exactly the
shape a setup hub needs (§1.4) — zero UI consumers, not even the route builder or project
page. This is the cheapest high-leverage mount in the product. (Wave K4 builds on it; FUNC §3's
missing-UI table missed this endpoint.)

**K-P1-6 · Two disjoint onboarding spines, and the Keys spine ends in a sandbox that can't
test Keys.** **DEEPENS UX IA-3 + FUNC P1-3.** Overview checklist (`activity/+page.svelte:81-89`)
vs Connect ledger (`connect-journey.ts:106-243`) — no shared steps, no cross-references,
different definitions of "ready". Gateway keys appear in the Keys spine as step 4 and in the
Connect spine only inside the optional agents step. The unifying fix is the coherence thesis
(§3), not another checklist.

**K-P1-7 · Cross-model validation has no readiness signal.** **NEW.** The differentiator that
justifies "keys is a core component" — validation by a second provider family — is invisible as
a state: `sameProviderFallback` (`model-guidance.ts:81`) surfaces only as a chip on
`connect/models` rows; no surface says "1 provider family connected → validation will be
same-family; add Anthropic/Google/Together to enable cross-model checking", and the trust
scorecard never discloses which family validated. **Fix:** a "provider families" readiness row
(count of *decryptable* families; ≥2 ⇒ cross-model ✓) in the K4 hub, and family disclosure on
the run quality report.

### P2 — polish / debt on these journeys

**K-P2-1 · Raw failure codes leak into `job.error` with no fix path.** `Provider credentials
missing (no_provider_binding)` / `(credential_unavailable)` / "not OpenAI-compatible …"
(`stage-route-generate.ts:147,132`) reach the console as bare text (UX B-P0-1's missing error
recovery). Map known codes → human copy + fix link (Connections / bindings / connect-models).
Pairs with W1.4; subsumed by K3.

**K-P2-2 · Two diverging create-key implementations.** `access/+page.svelte` and
`ConnectAgentSetup.svelte` duplicate the create/copy-once/label logic with drift already
visible (the access page does `invalidateAll`, the agent panel maintains a `localKeys` shadow
list). Extract a shared component when K1/W3.7 land.

**K-P2-3 · Access page load is an N+1 and drops fields** (`access/+page.server.ts:29-39`).
Single workspace-scoped query; return `createdAt`/`lastUsedAt` (with K-P1-1).

**K-P2-4 · sessionStorage key handoff never checks `savedAt`.**
`consumePendingGatewayKeySession` (`connect-gateway-key-storage.ts:33-45`) stores a timestamp
and ignores it; add a short TTL (e.g. 10 min) so an abandoned tab doesn't hold a raw key for a
whole session. The consume-once design is otherwise right.

**K-P2-5 · Integration delete confirm names bindings, not blast radius.** With K-P1-4's
attribution and K-P0-2's checks in place, the confirm should say which routes/stages stop
resolving ("Used by 5 ingestion routes in project X").

**K-P2-6 · `connect/models` "Reset to recommended" deletes all custom steps per stage route**
(`apply-recommended-routes.ts:139-142`). The confirm copy does say "overwritten" — adequate —
but after W1.5 the previous version will be one rollback away; link to it in the success copy.

### Credit where due (patterns to keep and extend)

The `returnTo` side-task loop (`ConnectBuilderReturnBar`, `withReturnTo`) is the best seam
pattern in the product. The consume-once sessionStorage key handoff is a thoughtful
copy-once-compatible bridge. `applyRecommendedIngestionRoutes` is the right shape for
one-click setup (create + step + publish + bind in one transaction-ish sweep) — it just needs
to finish the job (provider bindings, K-P0-2). The 409 on duplicate `(workload, stage)` routes
with a human message, the audit events on key create/revoke, and the honest
`server_misconfigured` 503 when encryption is unset are all correct foundations.

---

## 3. Coherence thesis: one readiness spine — "Ready to verify"

The incoherence is not a missing page; it is that **five partial readiness models exist and
none owns the question** the user actually has — *"will my next Connect run produce verified
context?"*:

1. Overview checklist (Keys-routing world, `activity/+page.svelte:81-89`)
2. Connect ledger journey (`connect-journey.ts`)
3. Hub `setupHealth` (`connect-hub-load.ts:182-189`)
4. Launch gate (`ConnectPipelineReviewLaunch.svelte:36`)
5. `GET api/projects/[id]/readiness` (server-only, unconsumed)

**Proposal: a single shared readiness module + one visible ledger.** Concretely — grounded
entirely in code that exists:

- **A `connect-verified-readiness` server module** composing checks that are all already
  implemented somewhere: gateway key exists (+ last-used, `countApiKeysByWorkspace` /
  `listApiKeys`), **decryptable provider families** count (`listProviderIntegrations` filtered
  by `hasEncryptedCredential`, grouped by canonical family — ≥2 ⇒ "cross-model validation ✓"),
  stage routes published+enabled (`computeConnectModelsReady`, per-stage rows), **provider
  binding on the routing project covering the providers used by the stage routes**
  (`listProviderBindingsByProject` × step providers — the K-P0-2 check, and most of
  `api/projects/[id]/readiness` verbatim), encryption configured
  (`isCredentialEncryptionConfigured`), graph store + documents (existing `setupHealth`).
  Each row returns `{status, evidence, fixHref}` — the brief's
  "gateway key ✓ · 2 provider families ✓ · stage routes ✓" made real, with two more rows the
  brief didn't know it needed (binding ✓, encryption ✓).
- **One ledger, three mounts, zero new models:** (a) a **"Ready to verify" panel on the
  Connect hub** replacing the `ai_keys` step's vague detail string (neo-brutalist ledger rows,
  every row a receipt with a fix link — same idiom as UX signature 3.3); (b) the **launch
  preflight** — the wizard's START RUN gate consumes the same rows, so "ready" in the ledger
  and "runnable" in the wizard can never disagree; (c) **run-failure explanations** — worker
  error codes (`no_provider_binding`, `credential_unavailable`, …) map back to the same rows,
  so a failed run says "Readiness row 4 regressed: provider binding missing → [Fix]" instead
  of leaking a code.
- **The Overview defers to it.** The Keys checklist keeps its routing steps but its Connect
  entry becomes the readiness ledger's summary chip ("Connect: 4/6 ready"), resolving the
  two-homes split (UX IA-3 / W2.6) for the keys-and-credentials half of the story.
- **Why this is the unifying experience:** every journey in this review terminates in the same
  ledger. Create a gateway key → row 1 flips. Add a second provider family → row 2 flips and
  the copy says what you just unlocked ("validation will now cross-check Anthropic against
  OpenAI"). Publish your embedding route → row 3. The ledger is also the *teaching* surface —
  it's where a user first learns that bindings and hosted keys exist, *before* the run fails
  rather than after. Keys stops being a parallel product and becomes Connect's visible
  foundation.

---

## 4. Wave K — proposed roadmap stages

Sized like the W-stages: one agent run → one reviewable PR each. Numbering continues the
world-class roadmap; dependencies on in-flight W-stages are explicit. Suggested order:
**K2 → K3 → K4 → K5 → K6**, with K1 amending W3.7 whenever that fires. K2/K3 may run in the
same batch (disjoint files); K4 needs K3; K5 is independent; K6 needs K1+K2.

### Stage K1 — Gateway-key metadata contract *(amends W3.7 — fold these criteria into it)*

```
ROLE
Senior engineer closing K-P1-1: gateway-key labels are silently dropped (the create POST
sends no body; the server accepts none) and last_used_at is already written on every key
use but never surfaced. W3.7 already owns "team-shared key metadata"; this stage sharpens
its acceptance criteria with the journey review's evidence — do not run both separately.

TARGET
Server-side label + created/last-used on gateway keys, shown on Access and in Connect
agent setup; localStorage labels become a one-time migration source.

FIRST
- docs/reviews/keys-core-journey-review-2026-06.md §1.1 + K-P1-1 (POST with no body at
  access/+page.svelte:59-62; createApiKey signature neon.ts:894; last_used_at written at
  neon.ts:826, never selected at neon.ts:864-869; createdAt dropped at
  access/+page.server.ts:32-37; duplicate label logic ConnectAgentSetup.svelte:127-132).
- Migration pattern from apps/dashboard/migrations/ (additive ALTER, COMMENT, no
  backfill needed).

ACCEPTANCE CRITERIA
- Migration: api_keys.label TEXT NULL. createApiKey accepts label; POST body
  { label?: string } validated (length-capped, trimmed); PATCH (or PUT) to rename.
- listApiKeys returns label, createdAt, lastUsedAt; Access list renders all three
  (relative "last used 2h ago" mono line); ConnectAgentSetup shows the server label.
- One-time client migration: when rk_key_labels has an entry for a server-label-less key
  the user owns, offer "Save N local labels to your workspace" (single batch action);
  never auto-write silently.
- Fix the N+1 in access/+page.server.ts (workspace-scoped query) in passing (K-P2-3).
- Tests: data layer (label round-trip, lastUsedAt selected), endpoint body validation.
- Scope fence: no shared create-key component refactor (K-P2-2 notes it; do it only if
  trivially extractable), no audit-log changes.

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
PR: before/after of the key list. Use effort: high.
```

### Stage K2 — Real provider verification + capability honesty

```
ROLE
Senior engineer closing K-P0-1 and K-P1-3: "Verify now" is a stub that never contacts a
provider, and credential-reference connections count as ready everywhere while being
unable to execute anything.

TARGET
Per-provider live verification probes using the decrypted hosted key; honest
verified/failed states; an explicit "reference only — not executable" capability badge
wherever integrations are counted.

FIRST
- lib/server/integration-verify.ts (the stub), runtime-invoke.ts:28-63 (decryption
  path), lib/server/runtime-openai-chat.ts + stage-route-generate.ts:294-307 (the
  provider base-URL tables to reuse for probe endpoints).
- K-P1-3 consumer list: evaluateConnectModelsReady (stage-routing.ts:216-240),
  connect-hub-load.ts aiKeysDetail, apply-recommended-routes.ts:175-176,
  integrations list/detail pages.
- restormel-high-risk-security skill — this touches credential decryption; probes must
  never log key material and must use the cheapest authenticated read-only endpoint
  (e.g. GET /models) per provider.
- LIVE-KEY BOUNDARY: probes spend nothing beyond a list call but DO use the user's key —
  verify stays a user-initiated button (never automatic on page load); agent tests stub
  all provider HTTP.

ACCEPTANCE CRITERIA
- Probe registry: openai, anthropic, google/vertex, mistral, voyage, together (+
  openrouter/portkey/vercel when gatewayProviders on) hit their list/models (or
  equivalent) endpoint with the decrypted key; 401/403 → "failed" with provider status
  text (sanitized); success → "verified" + lastVerifiedAt; unknown provider types keep
  "pending" with the current honest copy.
- Reference-mode integrations: verify returns a distinct state ("reference — cannot be
  verified or executed by Restormel") and the detail/list pages badge it.
- Readiness counts split: anywhere integrationsCount gates behavior, executable
  (hasEncryptedCredential) count is used; copy updated (connect/models "Provider keys"
  card, hub ai_keys detail, apply-recommended no_providers error).
- Tests: probe outcome mapping per provider family (mocked fetch), readiness-count split,
  no-secret-in-logs assertion on the probe error path.
- Scope fence: no rotation (K6), no binding changes (K3), no scheduled re-verification.

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
PR: screenshots of verified/failed/reference states. Live verify exercised by the
key-holder post-merge. Use effort: xhigh.
```

### Stage K3 — Connect run preflight: bindings, credentials, fix-forward errors

```
ROLE
Senior engineer closing K-P0-2 and K-P2-1: the most likely first-run breaker (no provider
binding on the routing project) is created nowhere and checked nowhere on the Connect
path, and when it fires it surfaces as a raw code in job.error.

TARGET
(1) A preflight check shared by the wizard launch gate and the runs API: stage routes'
step providers each have a binding on the routing project with a decryptable credential.
(2) One-click repair: "Bind <provider> to <project>" creating the provider_bindings row.
(3) applyRecommendedIngestionRoutes ensures bindings for the providers it wires.
(4) Known worker failure codes render as human copy + fix link in the run console.

FIRST
- keys-core-journey-review §1.4 (the execution chain) and K-P0-2 (evidence:
  runtime-invoke.ts:40-48 binding lookup; testing-bootstrap.ts:35-77 the only auto-bind;
  api/integrations/[id]/bindings/+server.ts:32 the only manual path;
  ConnectPipelineReviewLaunch.svelte:36 the gate that misses it).
- api/projects/[id]/readiness/+server.ts — reuse its no_provider_bindings logic; prefer
  extracting a shared check function over duplicating SQL.
- W1.4 (run console recovery) if merged — render fix-forward errors inside its
  BrutalErrorBanner pattern; otherwise add the minimal banner and note the W1.4 merge.
- Depends on: K2's executable-credential distinction (soft — can land before, using
  hasEncryptedCredential directly).

ACCEPTANCE CRITERIA
- Preflight module returns per-provider rows {provider, hasBinding, credentialExecutable,
  fixHref}; launch panel shows failing rows above START RUN with a "Bind now" action
  (POST the existing bindings endpoint); gate blocks until clear (override checkbox for
  legacy-env-key setups where llmReady is true without routes).
- applyRecommendedIngestionRoutes creates missing provider_bindings for applied
  providers (idempotent, mirroring testing-bootstrap), and reports them in `applied`.
- Worker error mapping: no_provider_binding, credential_unavailable,
  integration_not_found, "not OpenAI-compatible", embedding-provider-unsupported render
  as plain-language console errors with links (Connections / connect/models / wizard
  store step). Raw code preserved in a <details> for support.
- Tests: preflight matrix (binding × credential states), apply-recommended binding
  idempotency, error-mapping unit tests.
- Scope fence: no readiness hub UI (K4), no run attribution (K5).

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
PR: recording of preflight catching a missing binding and fixing it in one click.
Use effort: xhigh.
```

### Stage K4 — "Ready to verify": the Connect readiness hub

```
ROLE
Senior product engineer building the coherence thesis (§3): one readiness ledger
answering "will my next Connect run produce verified context?" — gateway key ✓,
N provider families ✓ (cross-model validation), stage routes ✓, provider binding ✓,
encryption ✓, store & documents ✓.

TARGET
A connect-verified-readiness server module composing existing checks, rendered as a
ledger panel on the Connect hub (replacing the ai_keys step's detail string) and as a
card on the project detail page (mounting api/projects/[id]/readiness at last); the
Overview checklist's Connect entry becomes the ledger's summary chip.

FIRST
- keys-core-journey-review §3 (the row list and the three mounts) and K-P1-5/6/7.
- Inputs that all exist: countApiKeysByWorkspace / listApiKeys (K1 fields if merged),
  listProviderIntegrations × hasEncryptedCredential × canonical family
  (canonical-provider.ts), computeConnectModelsReady stage rows, K3's preflight module
  (REQUIRED dependency — same checks, no drift), isCredentialEncryptionConfigured,
  connect-hub-load setupHealth.
- Depends on: K3 (shared preflight), W1.5 MERGED for the stage-route fix links ("Draft —
  publish to use" → builder Versions tab; close K-P0-3's connect/models dead-end here).
- Relationship to W3.2 (request tester): complementary — K4 proves *setup*, W3.2 proves
  *traffic*. The ledger's final row links to the tester when W3.2 exists ("Send a test
  request →"); do not build invoke UI here.
- restormel-neu-brutalist-ui skill: ledger rows as receipts (cap + body, mono evidence,
  fix link per row); ux-contracts §3 states for the panel.

ACCEPTANCE CRITERIA
- Module returns rows {id, status: ok|warn|fail, evidence (e.g. "2 families: openai,
  anthropic — cross-model validation on"), fixHref}; unit-tested per row.
- Hub panel renders all rows; ai_keys ledger step consumes the same summary (no second
  model); single-family state shows the K-P1-7 coaching line ("add a second provider
  family to enable cross-model validation") linking to Connections.
- Project page card consumes api/projects/[id]/readiness (issues + recommendations
  rendered; the endpoint finally has a UI consumer).
- Overview checklist Connect chip ("Connect: 4/6 ready") links to the hub panel —
  coordinate copy with W2.6 if it has merged; do not rebuild the Overview.
- Run quality report (run-quality-report.ts) gains the validating family disclosure line
  when attribution data exists (graceful absent-state until K5).
- Tests: row computation matrix; panel render states.
- Scope fence: no new checks beyond §3's list; no notifications/webhooks.

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
PR: screenshot of the full ledger in mixed states + the single-family coaching state.
Use effort: xhigh.
```

### Stage K5 — Run attribution: which route served this run

```
ROLE
Senior engineer closing K-P1-4: a Connect run cannot say which route/step/model served
each stage, cross-model validation is unprovable post-run, and server-side resolves are
invisible in Keys Logs/Usage.

TARGET
Per-stage resolved {routeId, routeName, stepId, provider, modelId, attempts} persisted in
job telemetry; a "Served by" block per stage in the run console; ingest resolves recorded
into request logs tagged source=connect_ingest so Logs/Usage see Connect traffic.

FIRST
- stage-route-generate.ts callResolvedChat/embedViaRoute (the resolved object is in hand
  at :114 and :231 and currently discarded), knowledge_ingest_jobs.progress JSONB
  (migration 044) as the cheapest persistence slot, ingest-full-runner.ts:197 (the
  existing judge-model precedent), insertRequestLog shape at
  api/projects/[id]/resolve/+server.ts:120-263.
- Coordination: W3.1 (SSE) may be touching the console — additive markup only, rebase
  late; W3.3 (logs) should fire AFTER this so its filters include the new source tag —
  note it in the PR.
- Security: attribution carries no key material; never log credentials (existing rule).

ACCEPTANCE CRITERIA
- Each stage call appends/updates attribution in job progress (last successful attempt +
  attempt count; bounded size); restart-safe (checkpointed runs append, not clobber).
- Run console: per-stage "Served by <model> · <provider> · route <name> (step N) ·
  K attempts" mono line, linking route name to the builder; validation stage additionally
  asserts same/different family vs extraction (feeds K4's disclosure).
- Resolve attempts from ingest write request-log rows (status resolved/failed,
  routeId, source=connect_ingest); Logs page rows render the source tag (full filter UX
  stays in W3.3).
- Tests: attribution persistence across a mocked 2-attempt fallback; request-log row
  shape; console render with/without attribution (legacy runs).
- Scope fence: no SSE, no logs filters/export, no cost computation.

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
PR: console screenshot showing per-stage attribution incl. a fallback (attempts > 1).
Use effort: xhigh.
```

### Stage K6 — Rotation: credentials and gateway keys

```
ROLE
Senior engineer closing K-P1-2: neither credential class can be rotated — provider
credential changes destroy bindings; gateway keys offer only unguided create+revoke.

TARGET
(1) Re-enter credential in place on the integration detail page (same id, bindings
intact, re-verify after save). (2) Guided gateway-key rotation: create replacement →
copy-once → revoke old, as one flow with state.

FIRST
- K-P1-2 + FUNC P2-4; integrations/[id]/+page.svelte (mount point under Status &
  verification), api/integrations/[id]/+server.ts (extend PATCH/PUT for apiKey
  re-encryption — reuse createProviderIntegration's encryption path), K2's verify (run
  automatically after a successful re-enter), K1's key metadata (label/createdAt power
  the rotate UX: "replaces <label>, created 90d ago").
- Depends on: K1 (or W3.7) and K2 merged.
- restormel-high-risk-security skill before PR (credential write path).

ACCEPTANCE CRITERIA
- Integration detail: "Replace credential" reveals a hosted-key input
  (readonly-until-focus autofill guard like the create form), PUTs new
  ciphertext/iv/tag/suffix on the same row, clears verificationStatus, triggers K2
  verify, leaves bindings untouched; audit event credential_rotated.
- Gateway keys: per-key "Rotate" creates a new key for the same project (copying the
  label with " (rotated)" default), shows copy-once, then offers "Revoke old key now"
  with the old prefix named — old key keeps working until explicitly revoked (no silent
  cutover); audit events on both halves.
- Tests: rotation endpoint (re-encrypt + bindings intact), rotate-flow state machine,
  audit events.
- Scope fence: no scheduled/forced rotation policies, no expiry.

PROCESS
pnpm --filter dashboard check && pnpm --filter dashboard exec vitest run src/lib.
PR: recording of both rotations. Live provider verify by key-holder post-merge.
Use effort: high.
```

### Dependency summary

| Stage | Depends on | Coordinates with |
|---|---|---|
| K1 | — (amends/absorbs **W3.7** — do not run both) | ConnectAgentSetup (K-P2-2 noted) |
| K2 | — | security skill review |
| K3 | K2 (soft), **W1.4** (console banner pattern) | W1.5 (fix links target its Versions tab once merged) |
| K4 | K3 (required), **W1.5 merged** (publish links; closes K-P0-3 residue), K1 (soft) | **W3.2** (complementary: links to it, never builds invoke UI), W2.6 (Overview copy) |
| K5 | — | **W3.1** (console markup, rebase late), **W3.3** (should fire after K5) |
| K6 | K1, K2 | security skill review |

---

## 5. What was verified

- Every break point above was traced in code on this branch (`origin/main` @ 97a24d6) with
  the cited file:line; no findings are inherited untested from the prior reviews — FUNC P0-1
  (dead publish banner), P1-2 (`RouteResolutionPreview` imported by nothing), P1-3, P1-5 and
  UX IA-3 were re-verified by grep/read before being marked DEEPENS.
- Zero-consumer claims (`api/projects/[id]/readiness`, `RouteResolutionPreview`) verified by
  repo-wide grep over `.svelte`/`.ts` excluding self/docs.
- Binding-creation paths verified exhaustively: `createProviderBinding` has exactly two
  callers (`api/integrations/[id]/bindings/+server.ts`, `testing-bootstrap.ts`).
- Request-log writers verified exhaustively: `insertRequestLog` is called only from the HTTP
  resolve endpoint and runtime invoke.
- Not executed: live runs (no seeded auth/database in the worktree) — runtime behaviour of the
  12-attempt retry loop and the binding failure mode is code-traced
  (`stage-route-generate.ts:91-177`), consistent with the Stage 1.5 perf review's runtime
  observations of the same loop.
