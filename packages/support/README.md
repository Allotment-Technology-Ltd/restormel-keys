# `@restormel/support`

**Restormel Support** — doc-grounded chat runtime for suite hosts. First host: [`apps/dashboard`](../../apps/dashboard) (`POST /keys/dashboard/api/support-chat`).

## Behaviour

- Uses the same offline index as MCP `docs.search` (`searchDocs` from `@restormel/mcp`).
- Default model adapter: OpenAI via `ai` + `@ai-sdk/openai` (`gpt-4o-mini` unless `RESTORMEL_SUPPORT_MODEL` is set).
- **Auth and rate limits** are enforced by the host; this package is session-agnostic.

## Public API

- `supportChatToTextStreamResponse({ messages, openaiApiKey, model? })` → `Response` (text stream).
- `parseSupportMessages`, `createSupportRateLimiter`, `isSupportRuntimeConfigured`, `supportModelFromEnv`, `searchRestormelDocumentation`.

## Env (host)

| Variable | Role |
|----------|------|
| `OPENAI_API_KEY` | Required for default adapter |
| `RESTORMEL_SUPPORT_ENABLED` | Set to `false` to disable |
| `RESTORMEL_SUPPORT_MODEL` | Optional model id |

## Docs

- Product / governance: [docs/architecture/RESTORMEL-SUPPORT.md](../../docs/architecture/RESTORMEL-SUPPORT.md)
- Production checklist: [docs/runbooks/restormel-support-production.md](../../docs/runbooks/restormel-support-production.md)

## Publish

Tag **`support-v*`** → [`.github/workflows/publish-support.yml`](../../.github/workflows/publish-support.yml) (after `pnpm` version bump in this `package.json`).
