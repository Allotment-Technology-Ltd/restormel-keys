# Restormel State — host persistence recipe (append-only log)

`@restormel/state` does **not** choose a database. Hosts store an **append-only** sequence of `StateEvent` JSON values and load them back for `projectWorkingMemory`. This page is a minimal recipe so integrators (SOPHIA, Surreal, Postgres, Firebase, and so on) align on **ordering** and **identity** without inventing incompatible shapes.

## Append-only invariant

- **Only append** new events at the tail. Do not rewrite or delete rows in place for “corrections”; emit a compensating event (for example `memory_cell_remove` or `scope_clear`) if your product allows it.
- **Projection is pure:** `projectWorkingMemory` expects the full history (or a suffix you intentionally treat as authoritative). If you truncate retention, document that as a product decision (older events are no longer reproducible).

## `StateEvent.id` (required)

- **Globally unique** among all events for the stream you pass to `projectWorkingMemory` (per thread, per tenant, or per app—whatever “one reducer input” means in your host).
- Use **UUIDs** or ULIDs if you have no natural key; collision breaks deduplication and operator debugging.

## `StateEvent.ts` (required)

- **ISO-8601** string, comparable with lexicographic sort (UTC recommended, include offset or `Z`).
- **Tie-break:** `projectWorkingMemory` sorts by `(ts ascending, then id ascending)`. If two events share the same `ts`, **distinct `id`** values still yield a stable order.

## Loading for projection

1. Fetch all events for the scope (conversation / thread / session).
2. Sort by `ts`, then `id` (or rely on insertion order only if your store guarantees it matches that order).
3. Call `projectWorkingMemory(events, policy)`.

## Optional: operational fields

You may store **separate** columns (`thread_id`, `tenant_id`, `inserted_at`) for indexing; they are not part of `StateEvent`. Do not put secrets in event bodies—see `docs/security-baseline.md`.

## See also

- [RESTORMEL-STATE.md](./RESTORMEL-STATE.md) — model overview
- [state-sophia-integration.md](./state-sophia-integration.md) — SOPHIA hook points
- [packages/state/README.md](../../packages/state/README.md) — npm README
