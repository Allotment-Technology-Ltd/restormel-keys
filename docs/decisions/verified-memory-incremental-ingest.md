# ADR: Verified memory — claim identity, temporal validity, incremental re-ingest

**Status:** Provisional — **pending review. No implementation has been done.** (Verified
Context roadmap Stage 3.1; builds on the approved
[Evidence-Bound Verification ADR](evidence-bound-verification.md) and the Layer-1
primitives in PR #194.)

## Context

Connect ingestion today is batch-shaped and identity-free. `GraphWriter.writeSource` creates
a source row per run; units exist only as per-store records keyed by run-local ids; parsed
document text is stored on `connect_source_documents` with **no version concept**; re-running
ingest over the same documents re-extracts everything and writes a new generation of records
with no relationship to the old ones. There is consequently no way to say "this claim is the
same claim as last week's, re-verified against the new source version", no way to supersede a
claim when its source changes, and no way to answer "what did the graph hold as of date X?".

The verified-memory pivot (P3) requires exactly those capabilities — and the EBV work just
gave us the right anchor: every claim now carries (or will carry, post-1.0c wiring) an
**evidence span pinned to a source-version content hash**. Identity and validity can hang off
that anchor instead of being invented separately.

Constraint carried from production: the **readiness-runs cohort invariant** — Surreal unit-id
format must remain consistent across services — so nothing here may change how unit records
are keyed in BYO Surreal stores.

## Decision (proposed)

### 1. Claim identity & versioning — evidence-anchored, deterministic

A **claim** is a stable identity; a **claim version** is one (text, evidence span, source
version) instantiation of it.

- `claim_key = hash(source_document_id + normalized(evidence_quote))` — the same
  normalization the Layer-1 binder uses (whitespace/quote/dash/case folding). Two extractions
  that quote the same supporting text in the same document are the same claim, whatever minor
  rewording the extractor applied to the claim text.
- Matching is **deterministic only** in v1: same `claim_key` ⇒ same claim; no embedding
  similarity, no LLM matcher. (A fuzzy identity layer can be added later; starting
  deterministic keeps identity auditable, which is the whole point of this product.)
- A new extraction whose `claim_key` matches an existing claim creates a **new version** if
  text or span or source hash differ, else is a no-op. Versions form a chain:
  `superseded_by` on the old version, provenance recorded on both ends.
- Unit records in the stores keep their existing ids (cohort invariant untouched); identity
  and version metadata live alongside (see §4).

### 2. Temporal validity

Each claim version carries `valid_from` (created) and `valid_to` (set when superseded or
when its source document version is replaced/removed); `superseded_by` links forward.
**Verification state is per-version**: a version's `supported` status is valid exactly as
long as its source-version hash is the live one — which the Layer-1 read-time re-check
already enforces mechanically. Nothing "re-opens" old verdicts: a superseded version keeps
its recorded verification history (audit), it just stops being current.

Retrieval default: **current versions only**. `as_of` queries (Stage 3.3) filter on
`valid_from ≤ t < valid_to`; superseded content is available only behind an explicit audit
flag.

### 3. Incremental re-ingest contract

Per source document, at re-ingest time:

1. Parse → `contentHash(text)`. **Hash unchanged ⇒ skip the document entirely** (assert in
   tests: zero model calls, zero writes beyond a `last_seen_at` touch).
2. Hash changed ⇒ extract THIS document only. For each extracted unit:
   - bind evidence (Layer 1) against the new source version;
   - compute `claim_key`;
   - **match** → existing claim: if text + span content unchanged (span offsets may move),
     carry the version forward: re-pin the span to the new hash via the deterministic
     re-bind, keep verification state, no re-judging. If changed → new version → validate
     (Layer 2 / current judge) only this version;
   - **no match** → new claim, full verification;
   - claims of this document whose `claim_key` did not reappear → supersede (set
     `valid_to`, reversible like soft-exclude; **never hard-delete**).
3. G2/trust recompute from **current-version aggregates only** — a per-graph aggregate
   adjusted by the delta (or a cheap `WHERE valid_to IS NULL` re-aggregate); never a
   whole-graph re-validation pass.

Cost property to enforce in tests: re-ingest cost is O(changed documents), not O(graph).

### 4. Storage placement

- **Postgres spine (Restormel-owned):** one new side table,
  `connect_claim_versions (claim_key, unit_id, version_no, text, evidence_quote, span_start,
  span_end, source_hash, verification_state, valid_from, valid_to, superseded_by, judged_by,
  judged_at)` — deliberately the same side-table shape proposed at PR #194's STOP gate for
  evidence persistence; **these are one table, not two** (evidence + version + validity are
  the same record). Migration `055` covers both.
- **Surreal BYO (user-owned):** same opportunistic-field strategy as the 1.0c proposal —
  write `evidence`, `verification_state`, `valid_from/valid_to` fields to the user's unit
  records where the schema allows; keep the **version chain** in a Restormel-defined table
  (`restormel_claim_versions`) in the user's database, created by Connect (additive, never
  touches user tables' definitions). SCHEMAFULL user tables that reject fields degrade to a
  per-graph capability flag + documented `DEFINE FIELD` opt-in — never silent.

### 5. Explicitly NOT building (v1)

- No real-time conversational memory and no LOCOMO/LongMemEval benchmark chase — different
  product axis; ours is auditability (the write path for agent observations is Stage 3.4 and
  rides this same machinery).
- No cross-document claim dedup/merge (same fact asserted by two sources = two claims,
  linked later if ever; merging destroys per-source provenance).
- No embedding/LLM-based identity matching (deterministic-only, see §1).
- No edit-history UI; audit data is API/trace-level until there's buyer pull.

## Migration sketch

Backfill = each existing unit becomes claim version 1: `claim_key` from its (document,
evidence) when 1.0c backfill bound evidence, else a legacy key `legacy:(unit_id)` with
`verification_state = unverified` (visible, reviewable — consistent with the EBV migration
rule: never silently demote, never silently keep). `valid_from = ingested_at`,
`valid_to = NULL`.

## Alternatives considered

1. **Text-hash identity** (`hash(claim text)`) — rejected: extractor rewording breaks
   identity constantly; evidence quotes are far more stable than generated claim text.
2. **Embedding-similarity identity** — rejected for v1: non-deterministic, threshold-tuned,
   unauditable; exactly the kind of judgment-in-the-dark this product exists to remove.
3. **Full re-ingest with diffing after the fact** — rejected: O(graph) model cost per
   change, and verification states would churn even for untouched claims.
4. **Storing versions by mutating unit records in place** — rejected: destroys audit
   history; supersession must be additive.

## Open questions (for sign-off)

1. Surreal placement: is a Restormel-created `restormel_claim_versions` table in the user's
   BYO database acceptable, or must version chains live only in the Postgres spine even for
   Surreal graphs (split-brain risk)?
2. When the extractor re-quotes the *same sentence with slightly different boundaries*
   (one extra clause), `claim_key` changes and we get a new claim instead of a new version.
   Accept for v1 (deterministic, slightly over-creates claims) or add a bounded
   same-span-overlap rule (≥80% offset overlap ⇒ same claim)?
3. Embeddings: re-embed only new/changed versions (proposed) — confirm there is no consumer
   assuming one embedding per unit forever.
4. Does `valid_to` on supersession also exclude the old version from retrieval indexes
   immediately (proposed: yes), or after a grace window?

## Next step

Review and confirm §§1–4 and the open questions. On sign-off, Stage 3.2 implements the
incremental re-ingest contract; the `055` migration should be authored ONCE to cover both
this ADR's version table and PR #194's evidence persistence (same record).
