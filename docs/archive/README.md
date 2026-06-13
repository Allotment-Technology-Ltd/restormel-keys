# Archive

Material kept for **traceability only** — superseded by a canonical doc or a newer location.
Per [doc governance](../../.cursor/rules/01-doc-governance.mdc): **do not treat anything here
as authoritative.** Links inside archived files may be stale by design.

Reorganised 2026-06-13 (documentation audit). Map of what moved here and what now owns the topic:

| Folder | What it was | Canonical replacement (current truth) |
|--------|-------------|----------------------------------------|
| `2026-03-build-pack/` | The March 2026 "Master Build Pack" v3.0 — `00-master-index`, numbered strategy/architecture/infra/design/monetisation/roadmap (`01`–`06`), bootstrap plan + checklist. Pre-pivot, pre-Coolify; assumed GCP/Firestore/Cloudflare and a BYOK-library framing. | [`docs/README.md`](../README.md) (index), [`docs/product/positioning.md`](../product/positioning.md), root [`README`](../../README.md) / [`STATUS`](../../STATUS.md) / [`ARCHITECTURE`](../../ARCHITECTURE.md) / [`ROADMAP`](../../ROADMAP.md) |
| `suite-migration-status/` | Completed `PHASE0`–`PHASE10` suite-migration status snapshots, `PHASE1`/`PHASE2` extraction status, suite-migration local-setup, the phase-1/2 engineering agent prompts + extraction-scope, and the graph→sophia extraction artifacts. | [`docs/restormel/SUITE-ARCHITECTURE-MIGRATION.md`](../restormel/SUITE-ARCHITECTURE-MIGRATION.md) (programme), [`CHANGELOG`](../../CHANGELOG.md) |
| `reference/` | March pre-pivot reference: GCP/Vercel deploy options + phase manual steps, the "integration-first reframe" audit/summary (superseded narrative), SOPHIA dogfood findings/plans/handover/integration/revalidation, the repo-audit/gap-analysis, minimum-viable-refactor-path, platform-alignment review, onboarding copy, pricing-ux v2 note, routes-bridging, control-plane schema 004, open-GitHub-issues inventory. | [`docs/product/positioning.md`](../product/positioning.md), [`docs/infra/`](../infra/) (Coolify), [`docs/product/CONNECT-PRODUCT.md`](../product/CONNECT-PRODUCT.md) |
| `infra-superseded/` | GCP custom-domain mapping and Vercel monorepo build notes. | [`docs/infra/`](../infra/) (Coolify cutover + env inventory + sizing) |
| `zuplo-portal/` | Zuplo **developer portal** (zudoku) go-live, design constraints, UX-navigation, and the portal design prompt. The hosted dev portal is retired. | In-site API reference (Scalar) at `/keys/docs/api-reference`; gateway setup stays in [`docs/runbooks/zuplo-setup.md`](../runbooks/zuplo-setup.md) |
| `github-workflow/` | GitHub-issue-based dogfood feedback loop. | Repo is moving Forgejo-native — revisit before reinstating |
| `walkthrough-source/`, `integrations-walkthrough-source/` | The two parallel repo-markdown walkthrough trees. | The **in-app** docs are canonical: `/keys/docs/walkthrough` and `/keys/docs/integrations-walkthrough` (see `apps/dashboard/src/routes/keys/docs/`) |
| `testing/` | Restormel **Testing** product docs (42 files). Real product, **flag-OFF** in the MVP (`MVP_MODULE_DEFAULTS.testing = false`). | Restore from here when `restormel-module-testing` is re-enabled |
| `deferred-products/` | Flag-off product material: Graph enterprise-licensing one-pager, Graph↔SOPHIA consumer guide, and the hosted-runtime RFCs/spikes (`hosted-runtime/`). | Restore when the corresponding module flag is re-enabled |

**Pre-2026-06 note:** the original Phase-00 archive note is retained in git history; this index replaces it.
