# High-risk path patterns (Restormel Keys)

Use to classify `git diff` paths. **High-risk** → full skill checklist + Aikido scan. **Medium** → baseline + hygiene scripts. **Low** → hygiene scripts only unless user requests full scan.

## High-risk (full pass)

Path contains or equals (case-sensitive globs as substrings unless noted):

- `connect-gateway-key`, `gateway-key`, `provider_integrations`, `credentials`, `encryption`, `decrypt`, `encrypt`
- `auth`, `session`, `neon-auth`, `device_sessions`, `pending_raw_key`, `service_admin`
- `routes/keys/dashboard/api/`, `connect/invoke`, `connect-v1`, `retrieve-handler`, `resolve`
- `packages/mcp/`, `connect-agent-tools`, `connect-mcp-snippet`, `mcp.json`
- `zuplo-gateway/`, `RESTORMEL_CREDENTIALS`, `RESTORMEL_GATEWAY`
- `migrations/` (when adding columns/tables for secrets, PII, keys, webhooks)
- `graph-writer`, `surreal` + credential env
- `.env.example` (only if adding/changing secret **names** or realistic-looking values)
- `security-baseline`, `threat-model` (when weakening controls)

## Medium-risk

- `apps/dashboard/src/lib/server/` (other server modules)
- `hooks.server.ts`, `+page.server.ts`, `+server.ts`
- `webhook`, `audit_events`, `founders_applications`
- `packages/contracts/src/connect`, routing metadata
- `playwright`, `testing-browser` (autonomous browsing)
- Third-party **integration** docs with auth flows

## Low-risk

- Marketing Svelte under `routes/(marketing)/` without forms handling secrets
- Pure UI components with no new data sinks
- `ROADMAP`, `CHANGELOG` without security policy edits
- Token/CSS-only changes under `packages/keys-tokens`

When in doubt, treat as **medium** and read [security-baseline.md](../../../../docs/security-baseline.md).
