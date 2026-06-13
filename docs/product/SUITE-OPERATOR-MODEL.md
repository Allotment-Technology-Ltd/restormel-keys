# Suite operator model

**Status:** Canonical for Restormel workspace vocabulary (Theme L IA). **In-app mirror:** [https://restormel.dev/docs/operator-model](https://restormel.dev/docs/operator-model).

**Related:** [documentation-strategy.md](../governance/documentation-strategy.md), [THEME-L-IA-MATRIX.md](../architecture/THEME-L-IA-MATRIX.md), [SUITE-IA-REDIRECT-INVENTORY.md](../architecture/SUITE-IA-REDIRECT-INVENTORY.md).

---

## One workspace

Signed-in users work in **one dashboard** at `https://restormel.dev/keys/dashboard`. Keys, Testing, Knowledge, and Graph operator surfaces are **hubs inside that shell**, not separate products with separate logins.

## Objects and where to configure them

| Concept | User-facing name | Dashboard location |
|---------|------------------|-------------------|
| Tenant scope | Workspace | Created on first sign-in |
| App boundary | Project | `/keys/dashboard/projects` |
| Provider credentials | Connections | `/keys/dashboard/integrations` |
| Request authentication | Gateway keys | `/keys/dashboard/access` |
| Model routing | Routes | `/keys/dashboard/routes` |
| Policy enforcement | Guard Rails | `/keys/dashboard/policies` |
| Usage & health | Analytics, Logs, System Health | Monitor group in sidebar |
| CI verification | Restormel Testing | `/keys/dashboard/testing` |
| Corpus pipeline | Knowledge pipeline & store | `/keys/dashboard/connect/pipeline` |
| Ingest jobs | Knowledge ingest runs | `/keys/dashboard/connect/ingest` |
| Embeddable UI | Graph packages | Integrator docs + `/keys/dashboard/graph` preview |

## Public docs tiers

| Tier | Purpose |
|------|---------|
| 0 | Suite hub `/docs` — map and Run vs Embed |
| 1 | Quickstart and operator model |
| 2 | Product reference trees (search, walkthroughs, vendor guides) |

**Rule:** Prefer dashboard wizards and hub journeys for first-run learning; link to Tier 1/2 only from empty states and Dev Tools.
