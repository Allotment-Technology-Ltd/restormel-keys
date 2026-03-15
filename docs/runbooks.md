# Runbooks

Early operational notes. **Single place** for procedures; expand when hosted components exist. Principles: [reliability-standards.md](reliability-standards.md).

**Phase 00:** No production services. Stub for: incident response and escalation, deployment and rollback, secret rotation and access, health/readiness checks (when applicable).

### Linked runbooks and manual steps

| Doc | Purpose |
|-----|---------|
| [reference/phase-3-manual-steps.md](reference/phase-3-manual-steps.md) | Phase 3 manual actions required (GCP, Firebase, Paddle, Cloudflare, DNS, Zuplo); template from 09-prompt-pack-phase-3. |
| [runbooks/zuplo-setup.md](runbooks/zuplo-setup.md) | Zuplo API gateway for Keys cloud API (restormel-keys-gateway, routes to Cloud Run, policies, developer portal). §8: Deployment checklist and policies.json troubleshooting. §9: CLI/config-as-code. §10: Connecting to GitHub (optional). |
| [runbooks/zuplo-config-reference/](runbooks/zuplo-config-reference/README.md) | Reference `routes.oas.json` and `policies.json` for agent-driven or scripted Zuplo setup. |
| [zuplo-gateway/](../zuplo-gateway/README.md) | In-repo Zuplo project (config-as-code). Deploy with `pnpm run deploy` and `ZUPLO_API_KEY`; set `KEYS_BACKEND_URL` and `KEYS_BACKEND_API_KEY` in Zuplo. |

Keep procedures here or in linked docs; avoid duplicating across files.
