# changelog-updater

Update CHANGELOG.md for meaningful repo changes without noise.

## Purpose

Record user- or contributor-visible changes in a consistent format (e.g. Added / Changed / Fixed) so the changelog stays useful and avoid cluttering it with trivial or internal-only edits.

## When to use

- After a meaningful change (e.g. new workflow, new script, new doc set, phase milestone, config change that affects users or contributors).
- When preparing a release or phase gate and the changelog is stale.

## Inputs

- Description of the change(s) to record.
- Current CHANGELOG.md (especially Unreleased / latest version section).

## Workflow

1. Read CHANGELOG.md and the repo’s convention (e.g. Keep a Changelog style).
2. Decide if the change warrants an entry (meaningful to users/contributors vs internal tweak).
3. Add or extend the Unreleased (or current version) section with one or more bullets: Added / Changed / Fixed / etc., as appropriate.
4. Keep entries short and factual; link to docs or PRs if helpful.
5. Do not duplicate long descriptions; avoid noise (e.g. “fixed typo” unless it was user-facing).

## Outputs

- Updated CHANGELOG.md with new entries.
- Optional: one-line summary of what was added.

## Done criteria

- CHANGELOG reflects the change in the right section with consistent formatting; no duplicate or vague entries.

## How it saves credits or reduces mistakes

- Single place and format for “what changed,” so release notes and communication stay consistent. Reduces forgotten or duplicated changelog edits.
