# architecture-recorder

Record architecture and governance decisions in the right canonical place (confirmed vs provisional).

## Purpose

Put decisions where they belong (e.g. docs/decisions/, ARCHITECTURE.md, or a specific canonical doc) with clear status (confirmed vs provisional) so the repo has a single source of truth for “why we did it this way” and no duplicate or scattered rationale.

## When to use

- An architecture or governance decision has been made or formalised (e.g. monorepo layout, rule set, security boundary, tech choice).
- Someone asks “where do we record this decision?”

## Inputs

- The decision (what was decided and why, in short form).
- Status: confirmed vs provisional.
- Optional: existing docs/decisions/ or ARCHITECTURE.md content.

## Workflow

1. Choose the right place: docs/decisions/ (one file per decision or theme), ARCHITECTURE.md (high-level summary and pointers), or a topic-owned doc (e.g. docs/governance/security-baseline.md for a security decision).
2. Write a short entry: decision, rationale, status (confirmed/provisional), date or context.
3. If updating ARCHITECTURE.md, keep it a summary with links to docs/decisions/ or other canonical docs; do not duplicate long text.
4. Do not duplicate the same decision in multiple docs; link from ARCHITECTURE or index to the owning doc.

## Outputs

- New or updated file in docs/decisions/ or the chosen canonical doc, plus any ARCHITECTURE.md summary update.
- One-line note: where it was recorded and status.

## Done criteria

- Decision is recorded in one canonical place with status; ARCHITECTURE.md (if updated) stays a summary; no duplicate truth.

## How it saves credits or reduces mistakes

- Single place per decision reduces “where did we say that?” and avoids conflicting rationales. Clear confirmed vs provisional reduces treating provisional as final.
