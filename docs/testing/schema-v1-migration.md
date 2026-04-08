# Config schema v1 — migration notes

**Stability policy (patch / minor / major):** [schema-stability-policy.md](schema-stability-policy.md) (GA **A6**).

**Canonical filename:** `restormel-testing.yaml` or `restormel-testing.json`  
**Schema version field:** `schema_version: "1"` (or `schemaVersion` in JSON)

## v1 (current)

- Top-level: `schema_version`, `keys`, `defaults`, `environments`, `suites`, `adapter_hooks`, `target_url_overrides`.
- **Authoritative validation:** TypeScript loader in `@restormel/testing-config` (`validateConfigDocument`, `loadConfigFromFile`).
- **JSON Schema draft:** `packages/testing-config/schema/restormel-testing-config.v1.schema.json` — structural hints for editors; some constraints (e.g. ref formats) are stricter in TS validation.

## From archived standalone repos

If you migrated from the historical **restormel-testing** GitHub repo:

1. Keep a single config file per app or monorepo root.
2. Replace any experimental keys with `ref:restormel-keys:…` or `env:VAR` per [config-reference-mvp.md](config-reference-mvp.md).
3. Rename camelCase to snake_case in YAML if you prefer consistency with docs (both accepted).

## v0

There is no distinct **v0** schema in this monorepo; pre-1.0 published packages used an evolving MVP. Treat **`schema_version: "1"`** as the first frozen contract for external tools.
