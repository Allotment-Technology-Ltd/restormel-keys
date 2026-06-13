# Docs archive externalisation — plan (deferred)

**Status:** Deferred — owner investigating the store choice first (2026-06-13).
This is a ready-to-execute plan to move the **superseded archive out of git** while keeping
engineering canon in-repo.

## Why
`docs/archive/` holds **129 superseded/flag-off docs** (the 2026-06-13 audit). They are
**traceability-only**, never authoritative, never agent-read at runtime, never CI-checked —
pure repo bloat. Moving them to a non-git cold store shrinks the working tree without losing
history (git history also retains them).

## Decision rule (what may leave git)
A doc leaves git **only if it is NOT** any of: agent-read at runtime, CI-checked, or
same-link-coupled to the product (per [doc-governance](../../.cursor/rules/01-doc-governance.mdc),
which *requires* stable in-repo paths for agents). Therefore:

| Set | Disposition |
|-----|-------------|
| ~150 **active** docs (product, architecture, guides, reference, runbooks, infra, governance, design, decisions, api, schemas) | **Stay in git** — engineering knowledge base |
| **`docs/archive/` (129 files)** | **Move out of git** (recommended) |
| Small **business/strategy** subset (Innovate-UK appendix, founding-pro promo, startup credits, GTM, ChatGPT brief) | **Optional** external KB (Notion) — currently low-friction in-repo, so optional |

## Store options (both connected via MCP)
| Store | Best for | Trade-offs |
|-------|----------|-----------|
| **Google Drive** *(recommended)* | Cold archive | Simplest/cheapest; "retrieve if ever needed"; not richly searchable |
| **Notion** | Browsable archive + business KB | Searchable, non-engineer friendly; more setup; per-page import |

## Execution steps (when un-deferred)
1. Confirm store (Drive vs Notion) and target folder/database.
2. Snapshot the current `docs/archive/` tree (preserve the group sub-folders).
3. Upload all 129 files to `restormel-keys/docs-archive/<group>/…` via the chosen MCP
   (Drive: `create_file`; Notion: `notion-create-pages`), preserving the group structure.
4. Verify upload (count + spot-check a few files).
5. Replace `docs/archive/` in the repo with a **single pointer**: rewrite `docs/archive/README.md`
   to "Archived material now lives at <link>" + keep the what-replaced-what map; `git rm` the
   129 files in one commit.
6. Update the `docs/README.md` Archive section to point at the external link.
7. Confirm no active doc/code links into `docs/archive/*` files (grep) — re-point or drop.

## Reversal
`git revert` the removal commit, or re-download from the store. History is preserved either way.

## Notes
- This is **outward-facing** (publishing to an external service) — get explicit go-ahead and
  the store choice before executing.
- Keep this in-repo as the canonical record so the task can be picked up cold.
