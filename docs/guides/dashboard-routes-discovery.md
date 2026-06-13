# Dashboard: finding Routes (control-plane rules)

**Audience:** Operators and integrators who expect a “Routes” entry in the Restormel Keys dashboard.

## Where Routes live

- **Sidebar (Set Up):** **Routes** → [`/keys/dashboard/routes`](https://restormel.dev/keys/dashboard/routes) — cross-project list, create flow, and links into each project’s routes.
- **Per project:** `/keys/dashboard/projects/{projectId}/routes` and `/keys/dashboard/projects/{projectId}/routes/{routeId}` for edit.
- **First-run onboarding** and **Setup checklist** link to `/keys/dashboard/routes` when the **routes** UI section is visible.

## When Routes seem “missing”

Set **`RESTORMEL_DASHBOARD_UI_HIDDEN`** (comma-separated) on the dashboard deployment. If it includes **`routes`**, the Routes nav item is removed and deep links to route pages **redirect** away (APIs are unchanged).

**Mapping:** Path segments `routes` and `projects/…/routes/…` map to the **`routes`** section — see [`apps/dashboard/src/lib/dashboard-ui-path-match.ts`](../../apps/dashboard/src/lib/dashboard-ui-path-match.ts).

**Client-side link filtering:** Components such as [`FirstRunOnboarding`](../../apps/dashboard/src/lib/components/dashboard/FirstRunOnboarding.svelte) and [`QuickActions`](../../apps/dashboard/src/lib/components/dashboard/QuickActions.svelte) omit hidden hrefs from checklists. The **Overview** setup list uses the same rule so “next step” never points at a hidden screen.

## Related

- Operator env overview: [`docs/guides/restormel-environment-vocabulary.md`](restormel-environment-vocabulary.md)
- Routing contract (API semantics): [`docs/architecture/keys-routing-contract.md`](../architecture/keys-routing-contract.md)
