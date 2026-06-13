# Runbooks

Early operational notes. **Single place** for procedures; expand when hosted components exist. Principles: [reliability-standards.md](../governance/reliability-standards.md).

**Doc journey & links:** All runbooks and reference docs must use the same canonical product URLs: **Dashboard** → [restormel.dev/keys/dashboard](https://restormel.dev/keys/dashboard), **Sign in** → [restormel.dev/keys/dashboard/login](https://restormel.dev/keys/dashboard/login). See [documentation-strategy.md](../governance/documentation-strategy.md).

**Phase 00:** No production services. Stub for: incident response and escalation, deployment and rollback, secret rotation and access, health/readiness checks (when applicable).

### Linked runbooks and manual steps

| Doc | Purpose |
|-----|---------|
| [reference/phase-3-manual-steps.md](../archive/reference/phase-3-manual-steps.md) | Phase 3 manual actions required (GCP, Firebase, Paddle, Cloudflare, DNS, Zuplo); template from 09-prompt-pack-phase-3. |
| [runbooks/firestore-to-neon-migration.md](firestore-to-neon-migration.md) | Switch dashboard storage from Firestore to Neon Postgres. Schema (001_initial.sql), connection string (Neon MCP or Console), env (USE_NEON_DB, DATABASE_URL), optional data migration. |
| [runbooks/zuplo-setup.md](zuplo-setup.md) | Zuplo API gateway for Keys cloud API (restormel-keys-gateway, routes to Cloud Run, policies, developer portal). Quick Start + value table; §8: Deployment checklist and policies.json troubleshooting. §9: CLI/config-as-code. §10: Connecting to GitHub (optional). |
| [runbooks/zuplo-launch-cli.md](zuplo-launch-cli.md) | **Single-path launch:** CLI execution order (main then working-copy), launch-checklist script, portal-only steps. |
| [runbooks/staging-and-ci-setup.md](staging-and-ci-setup.md) | **Staging and CI:** Non-production Restormel project/env, Gateway Key, GitHub Actions secrets, nightly validate/smoke, post-deploy options; phased minimum setup. |
| [runbooks/neon-user-subscription-view.md](neon-user-subscription-view.md) | **Neon: user subscription view.** Subscription level, renewal/expiry, plan_ended_at; view `user_subscription_overview` in Neon Console (workspaces only, no user table). |
| [runbooks/service-admin-operators.md](service-admin-operators.md) | **Service operators:** waive subscription limits and Pro UI gates for Allotment dogfood (Neon Auth admin role, `RESTORMEL_SERVICE_ADMIN_USER_IDS`, or `service_admins` table). |
| [runbooks/zuplo-config-reference/](zuplo-config-reference/README.md) | Reference `routes.oas.json` and `policies.json` for agent-driven or scripted Zuplo setup. |
| [runbooks/aaif-implementation-workflow.md](aaif-implementation-workflow.md) | Integrate AAIF runtime helper with `@restormel/keys` for routing + cost. |
| [runbooks/mcp-implementation-workflow.md](mcp-implementation-workflow.md) | Implement Restormel MCP tool surface (stdio server + agent workflow). |
| [runbooks/restormel-support-production.md](restormel-support-production.md) | **Restormel Support:** production env on Vercel, deploy, dogfood checklist (`restormel.dev`). |
| [guides/restormel-environment-vocabulary.md](../guides/restormel-environment-vocabulary.md) | **Canonical** `RESTORMEL_*` names: Gateway key vs server token; site base vs control-plane vs evaluate URL; CI `*_STAGING`. Link from integrations instead of duplicating tables. |
| [keys-testing-onboarding.md](../guides/keys-testing-onboarding.md) | **Keys + Testing:** Connections (hosted encrypted provider keys), Restormel Testing hub, Gateway keys, CLI/`doctor` env; complements the vocabulary doc. |
| [guides/dashboard-routes-discovery.md](../guides/dashboard-routes-discovery.md) | **Dashboard:** where **Routes** live in the UI, `RESTORMEL_DASHBOARD_UI_HIDDEN`, onboarding link filtering. |
| [runbooks/restormel-dogfood-issue-implementation.md](restormel-dogfood-issue-implementation.md) | **Dogfood relay:** triage and implement `[Dogfood]` issues; Cursor prompt; optional **CI draft PR** agent; optional **upstream → consumer** notify on `keys-v*` / `restormel-v*` tag (`dogfood-upstream-notify-consumer`; not gated on npm publish); optional **PR opened/merged → comment consumer issue** (`dogfood-pr-comment-consumer`); see `github-dogfood-feedback.md`. |
| [api/openapi.yaml](api/openapi.yaml) | Canonical OpenAPI spec for Keys cloud API; import into Zuplo Developer Portal for launch-ready docs. |
| [restormel-integration/keys-catalog-sync.md](../guides/integration/keys-catalog-sync.md) | **Integrators:** project model index vs global catalog; stable **`GET` `data`** shape; **`project_models_validation_failed`** + `errors[]`; migration pointer. |
| [zuplo-gateway/](../../zuplo-gateway/README.md) | In-repo Zuplo project (config-as-code). Deploy with `pnpm run deploy` and `ZUPLO_API_KEY`; set `KEYS_BACKEND_URL` and `KEYS_BACKEND_API_KEY` in Zuplo. |

Keep procedures here or in linked docs; avoid duplicating across files.
