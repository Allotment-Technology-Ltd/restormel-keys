# Runbooks

Early operational notes. **Single place** for procedures; expand when hosted components exist. Principles: [reliability-standards.md](reliability-standards.md).

**Doc journey & links:** All runbooks and reference docs must use the same canonical product URLs: **Dashboard** → [restormel.dev/keys/dashboard](https://restormel.dev/keys/dashboard), **Sign in** → [restormel.dev/keys/dashboard/login](https://restormel.dev/keys/dashboard/login). See [documentation-strategy.md](documentation-strategy.md).

**Phase 00:** No production services. Stub for: incident response and escalation, deployment and rollback, secret rotation and access, health/readiness checks (when applicable).

### Linked runbooks and manual steps

| Doc | Purpose |
|-----|---------|
| [reference/phase-3-manual-steps.md](reference/phase-3-manual-steps.md) | Phase 3 manual actions required (GCP, Firebase, Paddle, Cloudflare, DNS, Zuplo); template from 09-prompt-pack-phase-3. |
| [runbooks/firestore-to-neon-migration.md](runbooks/firestore-to-neon-migration.md) | Switch dashboard storage from Firestore to Neon Postgres. Schema (001_initial.sql), connection string (Neon MCP or Console), env (USE_NEON_DB, DATABASE_URL), optional data migration. |
| [runbooks/zuplo-setup.md](runbooks/zuplo-setup.md) | Zuplo API gateway for Keys cloud API (restormel-keys-gateway, routes to Cloud Run, policies, developer portal). Quick Start + value table; §8: Deployment checklist and policies.json troubleshooting. §9: CLI/config-as-code. §10: Connecting to GitHub (optional). |
| [runbooks/zuplo-launch-cli.md](runbooks/zuplo-launch-cli.md) | **Single-path launch:** CLI execution order (main then working-copy), launch-checklist script, portal-only steps. |
| [runbooks/staging-and-ci-setup.md](runbooks/staging-and-ci-setup.md) | **Staging and CI:** Non-production Restormel project/env, Gateway Key, GitHub Actions secrets, nightly validate/smoke, post-deploy options; phased minimum setup. |
| [runbooks/neon-user-subscription-view.md](runbooks/neon-user-subscription-view.md) | **Neon: user subscription view.** Subscription level, renewal/expiry, plan_ended_at; view `user_subscription_overview` in Neon Console (workspaces only, no user table). |
| [runbooks/zuplo-config-reference/](runbooks/zuplo-config-reference/README.md) | Reference `routes.oas.json` and `policies.json` for agent-driven or scripted Zuplo setup. |
| [runbooks/aaif-implementation-workflow.md](runbooks/aaif-implementation-workflow.md) | Integrate AAIF runtime helper with `@restormel/keys` for routing + cost. |
| [runbooks/mcp-implementation-workflow.md](runbooks/mcp-implementation-workflow.md) | Implement Restormel MCP tool surface (stdio server + agent workflow). |
| [runbooks/restormel-dogfood-issue-implementation.md](runbooks/restormel-dogfood-issue-implementation.md) | **Dogfood relay:** triage and implement `[Dogfood]` issues; Cursor prompt; optional **CI draft PR** agent (`dogfood-agent-open-pr` workflow + script); links to `github-dogfood-feedback.md`. |
| [api/openapi.yaml](api/openapi.yaml) | Canonical OpenAPI spec for Keys cloud API; import into Zuplo Developer Portal for launch-ready docs. |
| [zuplo-gateway/](../zuplo-gateway/README.md) | In-repo Zuplo project (config-as-code). Deploy with `pnpm run deploy` and `ZUPLO_API_KEY`; set `KEYS_BACKEND_URL` and `KEYS_BACKEND_API_KEY` in Zuplo. |

Keep procedures here or in linked docs; avoid duplicating across files.
