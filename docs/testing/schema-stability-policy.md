# Config schema stability policy (GA)

**Canonical field:** `schema_version` in `restormel-testing.yaml` / `.json`  
**Current contract:** **`"1"`** — authoritative validation in `@restormel/testing-config`; JSON Schema draft under `packages/testing-config/schema/restormel-testing-config.v1.schema.json` (editor hints; TypeScript validation is stricter where they differ).

**Related:** Migration notes for authors and archived repos — [schema-v1-migration.md](schema-v1-migration.md).

## Semver mapping (A6)

We treat **config contract** changes like public API:

| Change type | Allowed in | Consumer expectation |
|-------------|------------|------------------------|
| **Patch** | Same `schema_version` | Bugfixes and stricter validation that reject previously invalid configs only; patch bumps of `@restormel/testing-*` npm line. |
| **Minor** | Same `schema_version` | **Additive** optional fields (new goal keys, new hook names, new optional env knobs). Older published runners **ignore unknown fields where safe**; adopters pin npm semver to receive features when ready. |
| **Major** | New `schema_version` (e.g. `"2"`) | Breaking renames, removal, or semantic changes. Requires a **published migration guide** and a clear upgrade window; npm **major** or coordinated major tag for the Action pin. |

## Publishing expectations

- **npm:** `@restormel/testing-*` releases follow **tag `testing-v*`** — see [publish-testing.yml](../../.github/workflows/publish-testing.yml). Changelogs in each package should call out **config-visible** changes.
- **Composite Action:** Consumers pin **`testing-action-vMAJOR.MINOR.PATCH`** Git tags on this repository — see [github-action-semver.md](github-action-semver.md).

## JSON Schema draft

The checked-in JSON Schema may lag slightly behind TypeScript validation; **TS wins** for CI and `testing validate`. Schema updates for new optional fields should land in the **same release train** as the code that implements them.

## Deprecation

Deprecated fields remain accepted for at least one **minor** npm line when possible, with warnings in release notes. Removal is a **major** schema or documented breaking minor only with migration steps.
