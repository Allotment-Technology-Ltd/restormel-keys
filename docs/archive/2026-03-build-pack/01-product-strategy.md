# Restormel Keys — Product strategy (current truth)

This repo previously carried a “hosted key storage / paste provider keys into Restormel” strategy doc. That framing is **not** the v1 default proposition.

## Canonical sources

- `STATUS.md` — current phase/state and active product surface
- `ARCHITECTURE.md` — current repo/app architecture and system contracts
- `/keys/docs/guides/*` — integration-first docs published in the single SvelteKit app

## v1 positioning (integration-first)

- Restormel Keys is a **library-first + dashboard-backed control layer** for AI provider access.
- Restormel issues its own **Gateway/Restormel API key** for control-plane access.
- Provider credentials live in your **gateway vendor** (OpenRouter / Vercel AI Gateway / Portkey) or your own **env/secrets manager** by default.
- A hosted provider-secret vault is **future/optional**, not the default story.

Legacy planning material is kept **local-only** under `internal/strategy/archive/` (not published in the public repo).
