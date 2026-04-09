# OSS license policy — Restormel Testing packages

**Current choice:** All publishable **`@restormel/testing-*`** packages in this monorepo use the **MIT License** (see each package’s `package.json` and the repository `LICENSE` where applicable).

## Apache-2.0 vs MIT (GA decision)

| Aspect | MIT | Apache-2.0 |
|--------|-----|------------|
| Patent grant | Implied / minimal explicit text | Explicit patent retaliation |
| Notice | Preserve copyright | Preserve NOTICE file + attribution |
| Compatibility | Very permissive | Common in foundations / CNCF-style stacks |

**Recommendation for GA (P3):** Pick **one** license for the Testing line and apply it consistently to **`@restormel/testing-*`** artefacts (npm, Action metadata, docs). If you need explicit patent language or corporate policy prefers Apache-2.0, **relicense in a semver-major** (or first stable `1.0.0`) with SPDX headers updated — do not mix licenses across peer packages without legal review.

## This repository

- **Keys** and **Testing** product code lives in the same repo; Testing packages are **MIT** today.
- **Do not** change `license` fields in a patch release without legal approval.

## Action / composite

The GitHub Action under `packages/testing-github-action` follows the same license as the npm package that ships it; consumers should read the tag / release they pin.
