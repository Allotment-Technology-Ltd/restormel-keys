# Restormel Support (`@restormel/support`)

**Purpose:** Topic owner for the **Restormel Support** in-product assistant (Horizon **Theme M**). Describes behaviour, trust boundaries, and links to implementation — not a duplicate of OpenAI or Vercel docs.

**Status:** Canonical for **Restormel Support** product narrative in this repo. Runtime API: [`packages/support/README.md`](../../packages/support/README.md). Dashboard host: [`apps/dashboard/README.md`](../../apps/dashboard/README.md) (environment table).

**Horizon:** [HORIZON-PLATFORM-PROGRAMME.md §5](./HORIZON-PLATFORM-PROGRAMME.md) (Theme M).

## What it is

- A **signed-in-only** assistant on `https://restormel.dev` (FAB + drawer), grounded on the **offline doc index** shared with MCP `docs.search`.
- **Not** human support: no SLAs; escalate via **Send feedback** or GitHub issues.

## Trust boundaries

- **Session-only** HTTP API: `POST /keys/dashboard/api/support-chat` rejects non-session auth (same rule as feedback).
- **No raw keys** in UI copy; users must not paste Gateway or provider secrets into the chat.
- **Server:** Do not log full prompts or API keys. Use host secrets store for `OPENAI_API_KEY` (e.g. Vercel).
- **Rate limit:** Per user id, in-memory sliding window on the server (see route handler).

## Related

- Security: [docs/governance/security-baseline.md](../governance/security-baseline.md) (Restormel Support subsection).
- Production env + dogfood: [docs/runbooks/restormel-support-production.md](../runbooks/restormel-support-production.md).
