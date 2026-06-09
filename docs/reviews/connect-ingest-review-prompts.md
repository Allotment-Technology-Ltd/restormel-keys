# Connect Ingestion — Review Prompts

Two reusable prompts for driving an advanced-model review agent (Fable 5 / Opus) over the
ingestion subsystem. Use them in a **repo-grounded agent** (Claude Code, or a Managed Agent
with the repo mounted) — not a bare chat. Always have the agent read
[`connect-ingest-context.md`](./connect-ingest-context.md) first so its budget goes to
judgment, not orientation.

Replace `{{PLACEHOLDERS}}` before use. Both are written as a single, fully-specified turn —
do not feed scope progressively.

---

## Variant A — Open-ended sweep (no edits, triage-ready)

```
ROLE
You are a senior code reviewer auditing a subsystem for correctness bugs that
degrade output quality. Your only deliverable is a prioritized findings table.
You make NO code edits.

SCOPE
Review exactly: {{PATHS — e.g. packages/connect-core/src/ingest/**, stages/**, kg-audit/**}}
Start by reading docs/reviews/connect-ingest-context.md for orientation, the stage
flow, data contracts, quality bars, and candidate findings to validate. Do not
re-derive the subsystem map — it is in the pack.

LENS (apply all)
- Fail-open vs fail-safe: where does incomplete/garbled model output get silently
  admitted as good? (default fallbacks, coverage backfills, swallowed parse errors)
- Quality-metric integrity: can a metric read "green" while real quality is worse?
- Truncation ceilings: fixed slices/caps that drop context the task needs.
- Silent data loss: dropped fields, divergent data models, lost provenance.
- Robustness: retries, batch sizing, partial-success handling.

RULES
- Every finding MUST cite file:line and quote the offending code. No finding
  without code evidence. Reject generic best-practice advice.
- Validate or refute each candidate finding in the context pack; then find what it
  missed. Do not just restate the pack.
- Where you cannot confirm behavior from static reading (e.g. enforcement lives in a
  caller you can't see), label it "[verify: <where>]" — do not assert.
- Prefer targeted fixes over rewrites. If a finding implies a rebuild, say so and name
  the hard-won edge cases a rebuild would risk dropping.

SEVERITY
- Critical: admits bad data into persisted output, or corrupts a quality metric.
- High: a quality ceiling or silent loss that the system cannot detect.
- Medium: correctness/consistency/divergent-contract issue.
- Low: polish, heuristics worth revisiting.

OUTPUT (markdown only)
1. Findings table: ID | file:line | severity | category | the bug (1 line) | the fix
   (1 line) | confidence | effort.
2. One paragraph per Critical/High expanding the bug + fix, with the code quote.
3. Recommended sequencing by quality-per-effort.
4. "Not examined / needs a running system" section — be honest about coverage.

Use effort: high. Give the whole task one pass; do not ask scoping questions — the
scope is fixed above. Default to silence between tool calls.
```

---

## Variant B — Bounded fix (one concern, findings + PR)

```
ROLE
You are a senior engineer fixing ONE well-specified defect, fail-safe and minimal.

TARGET
Concern: {{ONE CONCERN — e.g. "validation/remediation coverage fallbacks default
omitted units to ok/keep (fail-open), inflating G2 ok_pct and admitting unsupported
claims" (context pack C1/C2/C3)}}
Files in scope: {{FILES — e.g. packages/connect-core/src/ingest/validation.ts, remediation.ts}}
Read docs/reviews/connect-ingest-context.md first for the data contracts and how to
run tests. Reproduce the defect with scripts/reviews/connect-ingest-failopen-repro.ts
before and after your change.

ACCEPTANCE CRITERIA
- {{e.g. Units omitted by the model default to weak/needs_review, not ok/keep}}
- {{e.g. A coverage-shortfall warning is emitted with the omitted ref count}}
- Existing tests pass; add/adjust tests covering the omission path.
- Happy path preserved (no metric change when coverage is complete).

PROCESS
1. Confirm the defect with a quoted code citation and a repro run before changing anything.
2. Implement the minimal fail-safe change. Do not refactor unrelated code.
3. Run: pnpm --filter @restormel/connect-core typecheck && pnpm --filter @restormel/connect-core test
   Report results verbatim.
4. STOP and ask if the correct fix requires architectural change beyond these files
   (e.g. a new second-pass stage) — do not silently expand scope.
5. Open a PR: before/after behavior, the code quote, why fail-safe is correct here, and
   the test you added.

Use effort: xhigh. Full task is specified above — proceed without scoping questions.
Default to silence between tool calls; summarize only at the end.
```

---

## Delivery notes

- **Vehicle:** repo-grounded agent. For fix mode, a Managed Agents *Outcome* with the
  Acceptance Criteria as the rubric makes the agent iterate-to-done efficiently.
- **Autonomy:** sweep mode → fire-and-forget is fine. Open-ended "find everything" across
  multiple subsystems → run sweep, triage the table yourself, then fire bounded-fix agents
  at the triaged rows.
- **Keep the frontier model on judgment:** let cheap Explore/Haiku subagents do any residual
  file-finding; the context pack already removes most navigation.
