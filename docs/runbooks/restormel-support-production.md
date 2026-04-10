# Restormel Support — production (restormel.dev)

**Purpose:** Configure and validate **Restormel Support** on the live dashboard deploy (`apps/dashboard` on Vercel or equivalent).

## 1. Environment (secrets UI only)

Set on the **production** project (no values in git):

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for the default chat adapter |
| `RESTORMEL_SUPPORT_ENABLED` | Optional | Set to `false` to disable (returns **503**) |
| `RESTORMEL_SUPPORT_MODEL` | Optional | Model id (default `gpt-4o-mini`) |
| `PUBLIC_RESTORMEL_SUPPORT_UI` | Optional | Set to `false` to hide the Support FAB for signed-in users |

`DATABASE_URL` and Neon Auth are unchanged; support does not add a new database.

## 2. Deploy

- Merge changes that include `packages/support` and the dashboard route/UI.
- CI must build `@restormel/mcp` → `@restormel/support` → `dashboard` (see root `.github/workflows/ci.yml`).
- Confirm **Node** runtime for serverless matches `nodejs20.x` (see `hooks.server.ts` and `support-chat/+server.ts`).

## 3. Dogfood checklist

After deploy:

1. **Signed in:** Open `/keys/docs`, `/testing/docs`, `/graph/docs`, and `/keys/dashboard` — **Support** FAB appears (bottom-right).
2. **Signed out:** No FAB; `POST /keys/dashboard/api/support-chat` returns **401** (e.g. from devtools with no session cookie).
3. Send a question (e.g. “Where is MCP documented?”) — reply should reference real `/keys/docs/...` paths when the tool returns hits.
4. **503:** With `RESTORMEL_SUPPORT_ENABLED=false` or missing `OPENAI_API_KEY`, API returns **503** and UI shows an unavailable message.
5. **Rate limit:** After many rapid requests, expect **429** (tune limits in code if needed).

## 4. Rollback

- Set `RESTORMEL_SUPPORT_ENABLED=false` and redeploy, or set `PUBLIC_RESTORMEL_SUPPORT_UI=false` to hide UI while leaving the route.
