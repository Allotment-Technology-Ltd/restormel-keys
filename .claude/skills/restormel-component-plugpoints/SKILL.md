---
name: restormel-component-plugpoints
description: >-
  Enforceable standard for wiring ANY external model/vendor component (extractor,
  verifier tier, embedder, reranker) into connect-core (restormel-keys repo) under
  the D-2026-07-02-1 at-risk posture: one port contract per slot, config-selected
  adapters, a shared conformance suite, removability as a hard merge gate, the
  REC-GOV-022 BLOCKED/AMBIGUOUS exclusions, per-adapter rollback runbooks, and
  per-adapter credential rules. Use when building or reviewing an adapter, when a
  PR touches packages/connect-core ports/adapters/selection config or the verdict
  cache, or when a new model/vendor is proposed — not for route/pool mechanics
  (restormel-keys-routing), secret-store mechanics (restormel-high-risk-security),
  or plug-point dashboard UX (ADR build step 5, out of near scope).
---

# Restormel component plug-points

**Target repo: `restormel-keys`.** Every path, grep, and command in this skill resolves from the root of the `restormel-keys` application repo — that is where `packages/connect-core`, `apps/`, `docs/`, `planning/`, and all five canonical references live, and where this file must reside (`.claude/skills/restormel-component-plugpoints/SKILL.md`, so the relative links below resolve). Running these checks in any other repo (e.g. `restormel-ops`) yields vacuous zero-hits and proves nothing.

Canonical references:

- **REC-ADR-023** — [docs/decisions/ingest-connector-architecture-adr.md](../../../docs/decisions/ingest-connector-architecture-adr.md) (dual-mode engine, four invariants, connector contract, build sequence 1A/1B→5)
- **REC-TECH-014** — [planning/spikes/ingest-connector-extraction-spike.md](../../../planning/spikes/ingest-connector-extraction-spike.md) (the `extract()` contract, provenance tiers A/B, swap test §Scope 4)
- **REC-PLAN-023** — [planning/ingest-cost-architecture-report-a.md](../../../planning/ingest-cost-architecture-report-a.md) (cheap→expensive cascade, exact-match verdict cache, unit-economics instrumentation)
- **REC-GOV-022** — [planning/component-licensing-menu-report-b.md](../../../planning/component-licensing-menu-report-b.md) (**the authoritative CLEARED / BLOCKED / AMBIGUOUS list** — nothing else is authority)
- **D-2026-07-02-1** — [planning/horizon/strategic-review-2026-07-01-decisions.md](../../../planning/horizon/strategic-review-2026-07-01-decisions.md) (proceed-at-risk posture; ROLLBACK is the mitigation; scope bound on BLOCKED + AMBIGUOUS)

Every rule below is checkable against a diff, a grep, or a test run. Component wiring proceeds AT RISK ahead of counsel (D-2026-07-02-1), and the founder's stated mitigation is rollback — so **clean removability is the merge gate, not an aspiration**, and the licensing scope bound is absolute because rollback cannot cure a licence breach.

## Severity and gate

| Severity | Meaning | Gate |
|---|---|---|
| Blocker | Licensing-grep hit, failed excise test, unregistered adapter in conformance suite, missing rollback runbook, shared/global credential, vendor type in a port or persisted schema, missing applicable PR evidence section | **BLOCK** |
| Major | Missing swap-test evidence for a default/alternative pair, tier-A declaration without 100% spatial-locator coverage in the suite, cache key missing adapter id+version | **BLOCK** unless a founder waiver is logged as a dated `D-` entry in [planning/horizon/strategic-review-2026-07-01-decisions.md](../../../planning/horizon/strategic-review-2026-07-01-decisions.md) naming the PR and the waived rule |
| Minor | Naming-convention drift, missing file-header rationale comment | PASS with follow-up ticket |

**Enforcement split (what runs where):** CI runs the conformance suite and the BLOCKED/AMBIGUOUS licensing grep on every PR touching `packages/connect-core` — a red check is a Blocker. The excise dry-run and swap test are manual but **evidenced, never honor-system**: the PR description must carry the named sections `## Excise dry-run` (scratch-worktree `pnpm build && pnpm test` output) and `## Swap test` (outcome-delta table + empty spine-diff output) whenever those checks apply, and `## Rollback rehearsal` (staging log link, or `pending` until first production use). A missing applicable section is a Blocker.

## Plug-point architecture — one contract per slot

| Rule | Pass criteria |
|---|---|
| One port interface per capability slot (extractor, verifier tier, embedder, reranker), owned by connect-core in `src/ingest/ingest-ports.ts` / `src/ports.ts`; domain types are Restormel's, from `@restormel/contracts/connect` | Port signature contains zero vendor SDK types; new slots add an interface before any adapter PR |
| No vendor SDK import outside that vendor's adapter directory; credentialed/network implementations live in the host app, mirroring the GraphStore port pattern | Grep below returns hits only under the adapter's own directory and the composition root |
| Adapter selection is config-driven at a single composition root, keyed `providerId:modelId`; adapters carry `readonly id = "<vendor>" as const` discriminants | One config entry fully selects the adapter; no `if (provider === "x")` branches in the spine |
| Extraction adapters implement the REC-TECH-014 contract verbatim: `extract(source_document) -> { document, text_units }` with **verbatim text (no LLM reshaping)** and a `source_locator` (spatial or textual). This row enforces the extraction boundary; locator survival through chunking→embedding→retrieval→verification is owned by the chunker rule below, not re-asserted per adapter | Conformance suite asserts (a) byte-exact round-trip of `text` against source and (b) locator re-resolution at the extraction boundary; tier A is mechanical, not declarative — the suite asserts a spatial locator (bbox) on **every** text unit of the conformance corpus, otherwise the adapter declares tier B |
| Chunking stays Restormel-owned (REC-ADR-023 §2); adapters never normalize, clean, or re-order stored canonical text (offset-preserving transforms only, per 2026 provenance practice) | Diff shows no post-extraction text mutation outside the Restormel-owned chunker |
| One shared contract-conformance suite per port, parameterised over every registered adapter: output shape, named-error-class taxonomy, timeout, empty/oversize input, and determinism wherever the verdict cache depends on it | `pnpm --filter @restormel/connect-core test` runs the suite against all adapters — in CI on every connect-core PR; an adapter present in config but absent from the suite registry fails the build |
| Swap test (REC-TECH-014 §Scope 4) is **provable, not asserted**: same indicative corpus through default + curated alternative, both via the identical contract | (a) `git diff` of verification-spine files between runs is empty; (b) span-anchoring + verification outcomes compared, with the outcome-delta table and the empty spine-diff output in the PR's `## Swap test` section |

**Conflict resolved (registry pattern):** 2026 practice recommends Vercel AI SDK `createProviderRegistry`; the repo record wins — keep connect-core's ports-and-DI idiom (`ai` stays an optional peer, never a core dependency). Adopt only the `providerId:modelId` config-key convention from the research.

**How to verify:** `grep -rnE "from ['\"](@mistralai|voyageai|@huggingface|paddle|@ibm-granite|@anthropic-ai|openai)" packages/connect-core/src --include='*.ts' | grep -v 'adapters/'` → zero hits; run the conformance suite; for swaps, diff the spine files between the two runs and attach the outcome-delta table in `## Swap test`.

## Removability — the hard gate (the D-2026-07-02-1 mitigation)

Reviewer-executable checklist. Every item must pass before an at-risk adapter merges.

| # | Check | Pass criteria |
|---|---|---|
| 1 | **Excise test**: in a scratch worktree, `git rm -r` the adapter directory, delete its config entry and its secret name | `pnpm build && pnpm test` green; no other package touched; command output attached in the PR's `## Excise dry-run` section |
| 2 | **No orphaned imports/ids**: grep the adapter/vendor id across `packages/` and `apps/` | Hits only in the (now-deleted) adapter dir, its config entry, its runbook, and its own tests |
| 3 | **No vendor shapes persisted**: cache keys are `hash(claim + source-span + source-version-hash + checker-version)` (REC-PLAN-023) with a neutral adapter id — no vendor payload fields in `@restormel/contracts` or DB schemas | Schema diff shows only neutral ids and versions |
| 4 | **Derived artifacts purgeable**: verdicts and embeddings are keyed by adapter id+version with a `checker-version → entries` index, so one component's outputs are selectively deletable | A purge-by-checker-version query exists and is exercised in a test — a legally tainted model's *verdicts* must be removable, not just its code |
| 5 | **No UI tendrils**: plug-point UX is ADR step 5 and out of near scope — no dashboard code names an adapter | Grep adapter id under the SvelteKit app → zero hits |
| 6 | **Rollback runbook exists** (see below) | File present, all six fields filled (the rehearsal-log field may read `pending` until the staging rehearsal, which must precede first production use) |

**Conflict resolved (kill switches):** 2026 practice mandates a flag service with second-level, no-deploy flips. The repo has no flag service, runs self-hosted K3s, and D-2026-07-02-1 applies only during the trial phase with **no external users** — so *disable* = edit the composition-root config entry + redeploy (minutes), and no flag-service dependency is added. What we do keep from the research: selection is evaluated **once** at the composition root (one edit kills the whole surface), and a missing/disabled adapter **fails closed** — labelled-unverified (annotated) or withheld (strict) per REC-ADR-023 Decision 3, never a silent pass (invariant 3). Revisit before external launch, when the gate reinstates in full.

**How to verify:** execute checks 1–2 literally in a scratch worktree (`git worktree add`) and attach the build+test output in `## Excise dry-run`; run the purge test for check 4; grep for checks 2 and 5.

## Licensing gate (REC-GOV-022 scope bound — absolute)

The authoritative list is REC-GOV-022 at [planning/component-licensing-menu-report-b.md](../../../planning/component-licensing-menu-report-b.md). HuggingFace `license:` tags and vendor marketing are **not** authority — 2026 empirical studies found ~96% of models lack required licence text; the LICENSE file in the model repo governs.

| Rule | Pass criteria |
|---|---|
| **BLOCKED — never wire; at-risk does NOT apply** (rollback cannot cure a licence breach, e.g. CC-BY-NC): **NV-Embed-v2, Patronus Lynx 8B/70B, Bespoke-MiniCheck-7B, all Jina weights** | Enforcement grep (below) returns zero hits under `packages/` and `apps/` |
| **AMBIGUOUS — fully excluded until counsel clears: lytang MiniCheck, Surya** | Same grep, zero hits |
| At-risk wiring applies **only** to the recommended/provisionally-CLEARED set: PaddleOCR-VL, Mistral OCR API pure-extraction mode, HHEM-2.1-Open, Granite Guardian, frontier verification APIs, voyage-context-4 | PR cites the component's REC-GOV-022 verdict line |
| Mistral OCR is **API-only** (pure-extraction mode, not the Document-AI schema tier); self-hosted weights = NEEDS COMMERCIAL LICENCE | Adapter calls the hosted API; any Mistral-OCR weight download/pull in code or manifests = Blocker |
| New component proposal: **default-deny.** Not in REC-GOV-022 CLEARED ⇒ excluded. Propose via a REC-GOV-022 amendment carrying: human-read LICENSE file verdict + SHA of the licence file; for hosted APIs, a dated ToS snapshot filed with the decision record, re-reviewed on adapter version bumps | Component appears in adapter config only in the same or a later PR than the merged REC-GOV-022 amendment |

**Conflict resolved (auto-pass):** 2026 practice allows OSI-clean (MIT/Apache-2.0/BSD) licences to auto-pass a default-deny policy. The repo record wins — **no auto-pass**: REC-GOV-022's decision rule requires tests 1–4 + 7 clean for any managed default/swap component (service-ambiguous = BYO-only), so even MIT components enter via an amendment.

**How to verify:**

```
grep -rniE 'nv[-_]?embed|patronus|lynx|bespoke[-_]?minicheck|minicheck|jina|lytang|surya' \
  packages/ apps/ --exclude-dir=node_modules \
  --include='*.ts' --include='*.js' --include='*.json' --include='*.yaml' --include='*.yml'
```

Gate: **zero hits = PASS; any hit = BLOCK** (if a legitimate identifier collides, rename it so the grep stays clean). "MiniCheck-class" as a capability description in `planning/`/`docs/` prose is fine, and the exemption is mechanical, not judgment: the command's path scope (`packages/`, `apps/`) and include list (code/config extensions only, no `*.md`) leave prose — and this skill file, which lives under `.claude/skills/` — outside it by construction. Never widen the path scope or add `--include='*.md'`. Run this from the `restormel-keys` root pre-PR, and it runs in CI alongside the conformance suite (see enforcement split above).

## Rollback procedure (counsel returns adverse)

Three tiers, all pre-tested, per D-2026-07-02-1's mitigation and 2026 rollback practice. Every at-risk adapter ships a runbook at `docs/runbooks/rollback-<adapter>.md` with six fields: config key, secret name, adapter id+version strings used in cache keys, purge commands, fallback adapter, and a rehearsal log (date, environment, tiers exercised, outcome — may read `pending` at merge; must be filled before first production use).

| Tier | Action | Target |
|---|---|---|
| 1. Disable | Remove the adapter's composition-root config entry; redeploy the host app. Verification falls back to the next CLEARED adapter for the slot, or fails closed (labelled-unverified / withheld per mode — never silent pass) | Same day |
| 2. Evict | Purge derived artifacts via the `checker-version → entries` index: delete its verdict-cache entries and embeddings (keyed by adapter id+version — this is why check 4 above is a Blocker); re-queue affected documents for re-verification through the replacement | Days |
| 3. Excise | `git rm -r` the adapter dir; delete config entry, conformance-suite registration, tests, runbook; delete the adapter's secret from Infisical; run the removability checklist; record the removal in the decisions file | Within the sprint |

Instrumentation continuity: every verification is tagged with adapter id and tier (REC-ADR-023 Decision 4 — cost/claim, cache-hit rate, tier distribution, abstention rate, latency per tier), so post-rollback deltas are visible in the weekly CI gate; the ≥90%/≤2% bar is **re-measured after any swap or rollback** via that gate (ADR invariant 4 — never assumed).

**How to verify:** runbook file exists and fills all six fields; the tier-1+2 staging rehearsal is recorded in the runbook's rehearsal log and linked from the PR's `## Rollback rehearsal` section before first production use of the adapter.

## Vendor credentials (per-adapter rules)

Secret-store mechanics, scanning, rotation cadence, and the gate decision belong to [restormel-high-risk-security](../restormel-high-risk-security/SKILL.md) — run the pre-PR gate per that skill; do not re-implement its checks. This skill adds the per-adapter rules:

| Rule | Pass criteria |
|---|---|
| One secret per adapter, never shared across adapters or environments; conventional name `ADAPTER_<VENDOR>_API_KEY`, held in Infisical | Two adapters never reference the same secret name |
| Constructor/DI injection only — adapters never read `process.env` (anywhere, including presence checks); adapter PRs add **no new** `process.env` reads to connect-core (the spine's pre-existing config/tuning reads — batch sizes, base URLs — are grandfathered, not a licence to add more); credentialed implementations live in the host app per the ports idiom | `grep -rn "process\.env" packages/connect-core/src \| grep 'adapters/'` → zero hits; the PR diff adds zero `process.env` lines under `packages/connect-core/src` |
| Server-side only — no adapter id, endpoint, or key reaches the SvelteKit client bundle | Grep adapter/secret names under client code → zero hits |
| Error/log paths redact: named error classes carry codes and safe fields, never raw vendor responses or key material | Conformance suite asserts serialized errors contain no key pattern |
| The secret name is listed in the rollback runbook; deleting it is part of tier-3 excise (removability applies to credentials too) | Runbook field present; excise test includes secret removal |

**How to verify:** the greps above; the diff check for new env reads; conformance-suite redaction test; pre-PR security gate PASS per restormel-high-risk-security.

## Anti-patterns

- Vendor SDK imported into connect-core core "just for the types" — vendor types in a port signature are a Blocker.
- Semantic/fuzzy verdict-cache lookup "to lift hit rate" — disqualified for moat-core (REC-PLAN-023); a near-miss hit silently flips a verdict, the exact failure the product exists to prevent. Paraphrase reuse, if ever wanted, is candidate retrieval feeding a *fresh* check, in a separate audited layer with a measured FP rate.
- Declaring tier A when any text unit in the conformance corpus lacks a spatial locator — the suite's 100%-bbox assertion *is* the tier-A definition (REC-TECH-014); "usually emits bboxes" is tier B.
- Wiring an AMBIGUOUS component "temporarily, since we're at-risk anyway" — D-2026-07-02-1's scope bound excludes BLOCKED and AMBIGUOUS regardless.
- `if (provider === "x")` branches in the verification spine — breaks the swap test's zero-spine-diff criterion.
- Kill logic scattered across call sites instead of one composition-root selection point.
- Adding a feature-flag service dependency during trial phase to get runtime flips — resolved above: config + redeploy.
- Cache or embedding keys without adapter id+version — makes tier-2 eviction impossible and fails removability check 4.
- Treating a HuggingFace `license:` tag, a model card, or vendor marketing as licence clearance.
- Shared API key across adapters, or `process.env` reads inside an adapter.

## Workflow

1. **Before anything:** verify checkout freshness of `restormel-keys` (`git fetch` + compare `origin/main`), then confirm the component's verdict line in REC-GOV-022 and that it sits inside D-2026-07-02-1's at-risk scope. Not CLEARED → stop; propose an amendment (LICENSE-file verdict + SHA, or dated ToS snapshot).
2. Identify the port for the slot. No port yet → land the interface in connect-core (`ingest-ports.ts`/`ports.ts`) with its `@restormel/contracts/connect` types as its own PR first.
3. Implement the adapter in its own directory: file-header rationale comment, `readonly id` discriminant, string-literal-union codes, defensive parsing, named error classes, ESM `.js` import suffixes; credentialed implementation in the host app.
4. Register the adapter in the port's conformance suite; add the `providerId:modelId` config entry at the composition root; ensure cache keys carry the adapter id+version.
5. Write `docs/runbooks/rollback-<adapter>.md` (config key, secret name, cache-key ids, purge commands, fallback, rehearsal log).
6. **Pre-PR:** run the conformance suite; run the BLOCKED/AMBIGUOUS grep; execute the excise dry-run in a scratch worktree; run the swap test if this adapter is a slot default or curated alternative; capture the outputs for the PR evidence sections; run the pre-PR gate per restormel-high-risk-security.
7. **PR:** cite the REC-GOV-022 verdict line and mark the integration at-risk per D-2026-07-02-1; fill the evidence sections — `## Excise dry-run`, `## Swap test` (if applicable), and `## Rollback rehearsal` (staging log link, or `pending` with the before-first-production-use deadline noted).

## Related skills and docs

| Resource | Use |
|---|---|
| [restormel-high-risk-security](../restormel-high-risk-security/SKILL.md) | Pre-PR security gate, secret/BYOK mechanics, rotation, scanning — run it, don't restate it |
| [restormel-keys-routing](../restormel-keys-routing/SKILL.md) | *How* cascade-tier model calls get routed (routes/pools, resolve/simulate); this skill owns *what* the adapter/cascade must do |
| restormel-accessibility | Only when ADR build step 5 (plug-point dashboard UX) starts — out of near scope today |
| REC-ADR-023 / REC-TECH-014 / REC-PLAN-023 / REC-GOV-022 / D-2026-07-02-1 | Canonical references at top — cite by id + line in PRs |

## Staleness & upkeep

Update this skill when any of these land:

- A REC-GOV-022 amendment changes any component verdict (especially BLOCKED/AMBIGUOUS movements — the enforcement grep pattern must be regenerated from the amended list the same day).
- Counsel returns findings on REC-GOV-022: adverse → execute rollback runbooks and update the at-risk posture here; cleared → note it. Before any external-user launch the D-2026-07-02-1 gate **reinstates in full** — counsel CLEARED verdicts become a launch precondition again, and this skill's "trial phase" allowances (config+redeploy disable, at-risk wiring) must be re-reviewed.
- A new port/slot is added to connect-core, the composition-root selection mechanism changes, or a flag mechanism is introduced (revising the disable tier).
- ADR build step 2 (cascade-validation harness) or step 5 (plug-point UX) lands — steps 2 and 5 add new conformance and UI-tendril rules respectively.

Verify checkout freshness of `restormel-keys` (git fetch + compare origin/main) before treating cited file paths as current.