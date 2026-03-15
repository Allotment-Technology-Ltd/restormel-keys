# Runbooks

Early operational notes. **Single place** for procedures; expand when hosted components exist. Principles: [reliability-standards.md](reliability-standards.md).

**Phase 00:** No production services. Stub for: incident response and escalation, deployment and rollback, secret rotation and access, health/readiness checks (when applicable).

### Linked runbooks and manual steps

| Doc | Purpose |
|-----|---------|
| [reference/phase-3-manual-steps.md](reference/phase-3-manual-steps.md) | Phase 3 manual actions required (GCP, Firebase, Paddle, Cloudflare, DNS, Zuplo); template from 09-prompt-pack-phase-3. |
| [runbooks/zuplo-setup.md](runbooks/zuplo-setup.md) | Zuplo API gateway for Keys cloud API (restormel-keys-gateway, routes to Cloud Run, policies, developer portal). |

Keep procedures here or in linked docs; avoid duplicating across files.
