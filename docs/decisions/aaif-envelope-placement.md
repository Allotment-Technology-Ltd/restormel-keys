# ADR: AAIF envelope placement

**Status:** Provisional — **pending review. No implementation has been done.** (Stage 5B item 4.)

**Context:** AAIF request/response envelopes (`AAIFRequest` → `AAIFResponse` in `@restormel/aaif`)
describe a *model-execution* call: an input plus routing/cost constraints in, and a generated
output plus the provider/model/cost/routing-reason that produced it out. Today the suite HTTP
surface is `POST /api/suite/invoke` (Zuplo) → `POST /keys/dashboard/api/suite/invoke`, which takes
`{ tool: RestormelSuiteToolName, payload }` and runs **read-only** suite tools (docs, testing,
observability, graph, state, connect read paths). The question is whether AAIF envelopes should ride
on `/api/suite/invoke` or get their own route.

**Decision (proposed):** AAIF envelopes should be served by a **new, dedicated route** (e.g.
`POST /api/aaif/execute`), **not** overloaded onto `/api/suite/invoke`. Rationale: (1) **Different
contract** — `/api/suite/invoke` is a `{ tool, payload }` dispatcher over a closed enum of read-only
tools, whereas AAIF is a single fixed request/response schema for model execution; conflating them
forces a discriminated union and weakens both. (2) **Different side-effects and billing** — AAIF
execution incurs real LLM cost and should sit on the metered/quota'd runtime path, while suite tools
are free, read-only, and cacheable; sharing a route muddies rate-limit, quota, and audit policy.
(3) **Independent versioning** — AAIF is already a stable, additively-versioned envelope in its own
package; a dedicated route lets it version without touching the suite-tool registry. The lighter
alternative (a `tool: "aaif.execute"` entry on the existing route) was considered and rejected
because it would require AAIF to masquerade as a suite tool and inherit the read-only route's
semantics.

**Next step:** Review and confirm before any routing/handler work. This document records the
recommendation only.
