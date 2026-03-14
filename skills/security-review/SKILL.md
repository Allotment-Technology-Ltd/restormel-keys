# security-review

Focused pass on security for BYOK, secrets, trust boundaries, logging, privacy, auth, and data minimisation before or after security-sensitive changes.

## Purpose

Apply the Restormel Keys security baseline (docs/security-baseline.md, docs/threat-model-starter.md) to specific changes so BYOK and key-handling risks are caught early. No product implementation; review and recommendations only.

## When to use

- Before or after changes that touch: keys, secrets, auth, logging of sensitive data, trust boundaries, or storage of credentials.
- When preparing for Phase 01 or a release that introduces key-handling or hosted components.

## Inputs

- Set of files or areas changed (diffs, file paths, or short description).
- docs/security-baseline.md and docs/threat-model-starter.md as reference.

## Workflow

1. Read docs/security-baseline.md and docs/threat-model-starter.md.
2. Review the changed files/flows for: committed secrets, raw key logging, unsafe placeholders, missing redaction, trust-boundary violations, over-retention or over-collection of sensitive data.
3. Check for BYOK-specific risks: key exposure in logs/analytics, insecure examples, over-trusting provider calls, scoping mistakes.
4. Produce a short list of findings and concrete recommendations (no raw secrets in output).
5. If no issues: state that the change aligns with the baseline for the reviewed scope.

## Outputs

- List of findings (file/location, issue, recommendation).
- Optional: one-line summary (e.g. “Aligns with baseline” or “N findings to address”).

## Done criteria

- All changed sensitive paths reviewed against the baseline; findings are actionable; output contains no secrets.

## How it saves credits or reduces mistakes

- One checklist-driven pass instead of generic “review for security.” Reduces the chance of committing secrets or normalising unsafe patterns by tying the review to the documented baseline and threat model.
