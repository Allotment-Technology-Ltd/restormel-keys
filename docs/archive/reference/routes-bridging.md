# Routes: dashboard persistence and headless router bridging

**Status:** Reference. Describes how persisted Routes in the dashboard relate to the headless router in `@restormel/keys`.

## Current state

- **Dashboard:** Routes and route steps are first-class backend objects. Stored in `routes` and `route_steps` (migration 004). CRUD via `/api/projects/[id]/routes` and `/api/projects/[id]/routes/[routeId]/steps`. A route has name, project/environment scope, default model, billing mode, route mode, status; steps have order, provider preference, model, condition block, **fallbackOn** (fallback behaviour), timeout, enabled.
- **Headless (@restormel/keys):** `createRouter(config, providers, options)` uses `KeysConfig.routing` (e.g. `defaultProvider`, `rules`) only. It does **not** read from the dashboard or from a database. Request resolution is in-memory from config.

## Bridging (temporary)

- **No automatic link:** The dashboard Route/RouteStep tables are not yet used by the headless router. Existing request execution flows (e.g. `keys.router.resolve()`) are unchanged.
- **Future work:** To use persisted routes for resolution:
  1. Resolve “active” route for a given project + environment (e.g. first active route or by name).
  2. Load route + steps via `getRouteWithSteps(routeId, projectId, userId)` (or a new “get default route for environment” API).
  3. Map steps to a provider/model chain and optional fallback (e.g. `fallbackOn: "next"` → try next step).
  4. Either (a) build a `KeysConfig.routing`-shaped object from the route+steps and call `createRouter(config, …)`, or (b) implement a custom resolver that uses RouteStep order and fallbackOn without going through the existing router.

## Policy hooks

- Policies and policy_bindings (migration 004) can target `target_type: "route"`. Evaluation of policies when resolving a route is not implemented in v1; the data model supports it for a later phase.
