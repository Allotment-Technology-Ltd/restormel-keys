# Ready-to-run: fix the validation/remediation fail-open cluster (C1–C3)

Hand this verbatim to a repo-grounded agent (Fable 5 / Opus) running via the CLI. It is the
bounded-fix prompt, pre-filled for the highest-impact finding — no placeholders to edit.

Context: [`connect-ingest-context.md`](./connect-ingest-context.md) §6 (C1, C2, C3).
Proof: `pnpm exec tsx scripts/reviews/connect-ingest-failopen-repro.ts`.

---

```
ROLE
You are a senior engineer fixing ONE well-specified defect cluster, fail-safe and minimal.

TARGET
The ingestion pipeline fails OPEN: when the model omits units from its JSON, coverage
finalizers silently admit them as good, which (a) lets unsupported claims into the graph
and (b) inflates the G2 ok_pct so the bug is invisible.

Defects (see docs/reviews/connect-ingest-context.md §6):
- C1  packages/connect-core/src/ingest/validation.ts  — finalizeValidationCoverage defaults
      model-omitted units to status "ok" ("Assumed supported").
- C2  packages/connect-core/src/ingest/remediation.ts — finalizeRemediationCoverage defaults
      model-omitted units to action "keep".
- C3  packages/connect-core/src/ingest/golden-eval.ts — computeG2Metrics counts those
      "assumed ok" units toward ok_pct.

FIRST
1. Read docs/reviews/connect-ingest-context.md (§3 data contracts, §5 commands).
2. Reproduce: pnpm exec tsx scripts/reviews/connect-ingest-failopen-repro.ts
   Confirm with quoted code that the C1/C2 defaults are as described before changing anything.

ACCEPTANCE CRITERIA
- C1: a unit the model did NOT return a verdict for must default to a NON-passing status
  ("weak") with a distinct coverage note (e.g. "coverage_gap: validator omitted this unit"),
  so it flows to remediation instead of into the graph as "ok". Do not change the status for
  units the model DID judge.
- C2: a unit the model did NOT return an action for must NOT silently default to "keep" (which
  persists a known-weak unit as if remediation succeeded). These inputs are already
  validation-flagged. Choose a fail-safe resolution and justify it in the PR. If the only
  correct fix needs a new review/hold state or an orchestrator change beyond these files,
  STOP and ask before implementing (do not invent a schema field unilaterally).
- C3: G2 ok_pct must no longer count never-judged units as "ok". After C1 this should follow
  automatically (they become "weak"); verify in golden-eval.ts and add a test that proves it.
- Happy path unchanged: when the model returns a verdict/action for every unit, behavior and
  metrics are identical to today.

PROCESS
1. Implement the minimal fail-safe change. Do not refactor unrelated code or restyle.
2. Add/adjust unit tests covering the omission path for validation and remediation, and a
   golden-eval test showing omitted units no longer inflate ok_pct.
3. Update scripts/reviews/connect-ingest-failopen-repro.ts so its C1/C2/H1 sections show the
   new fail-safe outcome (the repro should now demonstrate the fix, not the bug).
4. Run and report verbatim:
   pnpm --filter @restormel/connect-core typecheck
   pnpm --filter @restormel/connect-core test
   pnpm exec tsx scripts/reviews/connect-ingest-failopen-repro.ts
5. Open a PR: before/after behavior, the code quotes, why "weak"/your C2 choice is the
   correct fail-safe, and the tests added. Note any orchestrator follow-up C2 implies.

Use effort: xhigh. Proceed without scoping questions — the scope is the three files above
plus their tests and the repro. Default to silence between tool calls; summarize at the end.
```

---

**Why this is a safe first fire-and-forget.** Scope is three small pure-function files + their
tests + the repro; the change direction is fail-open → fail-safe (well-defined); and there is
an executable before/after. The one genuine judgement call (C2's resolution) has an explicit
STOP-and-ask gate, so the agent won't silently invent a schema change.
