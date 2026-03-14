# Architecture

High-level architecture summary. **Single entry point** for structure; details live in [docs/](docs/) and [docs/decisions/](docs/decisions/).

**Product shape:** Headless core (`@restormel/keys`) = product. UI: Svelte (reference), Elements, React, CLI. Later: dashboard, site, billing, hosted.

**Repo shape:** Monorepo (pnpm). `packages/` (core, svelte, elements, react, cli), `apps/` (dashboard, demo-next, site), `docs/`, `scripts/`, `prompts/`, `skills/`, `subagents/`.

**Phase 00:** Scaffolding and governance only. No provider, routing, billing, or hosted logic.

**Trust/security:** BYOK-first. [docs/security-baseline.md](docs/security-baseline.md), [docs/threat-model-starter.md](docs/threat-model-starter.md).

---

*Record decisions in docs/decisions/. Keep this file as summary only.*
