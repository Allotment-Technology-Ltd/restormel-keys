---
id: REC-ADR-006
title: "ADR: Migrate the Cloud API gateway off Zuplo to a self-hosted OSS gateway"
class: decision
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-15
last-reviewed: 2026-06-15
review-interval: P12M
related: [REC-ADR-005]
---

# ADR: Migrate the Cloud API gateway off Zuplo to a self-hosted OSS gateway (D2)

**Status:** **Draft — decision recorded, no cutover executed.** This ADR records the chosen
direction for D2 (the Zuplo endgame). It does **not** authorise any infrastructure change, code
change, or traffic move. Acting on it requires founder sign-off and the phased plan
(`planning/phase-d-gateway-routing-plan.md`, REC-PLAN-008). The verification path stays where
REC-ADR-005 puts it — served from the dashboard on Coolify, never behind the gateway.

## Context

### What Zuplo does today (the actual footprint)

D2 is grounded in the current code, not an assumption. Inventory (`grep -ri zuplo`, excluding
`node_modules`):

- **`zuplo-gateway/`** — the gateway itself, as config-as-code deployed to Zuplo's edge:
  - `config/routes.oas.json` — an OpenAPI document (the same one served in-app via Scalar) where
    every operation carries an `x-zuplo-route` block. Every route is a **`urlForwardHandler`** that
    proxies to either `${env.KEYS_BACKEND_URL}` (dashboard control plane, `/api/*`) or
    `${env.KEYS_SITE_ORIGIN}` (site root, `/keys/v1/*`, `/connect/v1/*`, `/graph/v1/*`). The gateway
    holds **no business logic** — it is a pure edge proxy with policies.
  - `config/policies.json` — four inbound policies applied per route: `api-key-inbound`
    (validates `zpka_…` consumer keys against a Zuplo key bucket), `rate-limit-inbound`
    (100 req/min by user), `quota-inbound` (10k req/month by user), and `inject-backend-auth`
    (overwrites `Authorization` with the backend Gateway key `Bearer rk_…` before forwarding).
    Plus a CORS policy.
  - `package.json` (depends on the `zuplo` CLI), `scripts/` (deploy, consumer creation, launch
    checklist), `.env.example`.
- **`apps/dashboard/src/lib/server/zuplo-consumer.ts`** — server code that provisions a Zuplo
  **consumer per workspace** (`ws_<workspaceId>`) by calling the Zuplo management API at
  `https://dev.zuplo.com/v1/...` with `ZUPLO_API_KEY`, returning the consumer's `zpka_…` key.
  Requires env `ZUPLO_API_KEY`, `ZUPLO_ACCOUNT_NAME`, `ZUPLO_BUCKET_NAME`.
- **`apps/dashboard/src/routes/keys/dashboard/api/consumer-key/+server.ts`** — the dashboard route
  that calls `ensureZuploConsumer(...)` to hand a workspace its gateway consumer key (used by the
  retired developer portal and the in-app access page).
- **Validation scripts** — `scripts/validate-zuplo-{keys,connect,graph}-v1.mjs` plus
  `zuplo-gateway/scripts/*` exercise the deployed gateway surface.
- **Governance records** — Zuplo is logged as **PROC-001 / DAT-007** in `governance/suppliers.yaml`
  ("Cloud API gateway", **role: sub-processor, location: US edge**), in `governance/ropa.yaml`
  (US transfer of API request metadata under Zuplo DPA + SCCs), and in `governance/risk-register.yaml`
  (open UK→US transfer risk pending DPA/SCC confirmation).
- **Docs/runbooks** — `docs/runbooks/zuplo-setup.md`, `zuplo-launch-cli.md`,
  `zuplo-config-reference/`, plus a `zuplo.svg` brand mark in the integrations assets.

Three things matter for the migration: (1) the gateway is a **stateless edge proxy** — auth,
rate-limit, quota, header-injection, CORS — with config-as-code; (2) it is **not on the
verification path** — `/connect/v1/verify`, retrieval, and trust-scorecard requests are forwarded
straight to the dashboard origin, which does the work; (3) the only **stateful** coupling is the
per-workspace consumer/key-bucket model in `zuplo-consumer.ts`, which any replacement must
re-home.

### Why migrate

Zuplo is a US edge-SaaS gateway. It offers EU residency and a self-host option, but its default
posture is a **global edge with a US control plane**, which is why it sits in the risk register as
an open UK→US transfer (PROC-001) and in the RoPA as a US sub-processor. That conflicts with the
sovereignty story Restormel sells to regulated UK/EU buyers (UK/EU self-host on Coolify, BYOK
custody, BYO graph, PostHog EU). Even though only **request metadata** crosses — never the
verification path, never customer corpus, never BYOK secrets — having any edge of the Cloud API on
US SaaS is a standing caveat in every sovereignty conversation and a residual on the risk register
we would rather close than annotate.

The strategic frame (`planning/planning-context.md` §7): keep Zuplo **off the verification path
now**, and plan a **self-hosted OSS gateway** as the sovereignty / anti-big-tech endgame. This ADR
is that plan promoted from a planning note to a decision, as D2 required.

**Non-goal:** this is not a verification-path change. Per REC-ADR-005, `/mcp` and the verification
surfaces are served by the dashboard on Coolify and stay there. The gateway is and remains the
**API edge** in front of the control plane — never the thing that verifies.

## Options considered

Evaluated as a **stateless edge proxy** for the Cloud API that we self-host in the EU (Hetzner
Helsinki / Coolify), config-as-code, OSS-licensed, no managed control plane phoning home. Fit as an
MCP/API edge means: can terminate HTTP cleanly, inject headers, do key-auth + rate-limit + quota,
and (later) front a Streamable-HTTP `/mcp` route without buffering or breaking SSE.

| Gateway | EU self-host fit | Stateless | Ops load | OSS licence | MCP / API edge fit | Notes |
|---|---|---|---|---|---|---|
| **Kong (OSS)** | Good — runs anywhere | Needs a datastore for most config; DB-less (declarative YAML) mode is stateless | Medium-high | Apache-2.0 (core); many useful policies are Enterprise-only | Good HTTP proxy; rate-limit/key-auth in OSS; some quota/analytics gated | Powerful but the OSS/Enterprise split means the policies we use (quota, advanced rate-limit) risk pulling us toward the paid tier — the exact dependency we're trying to leave. |
| **Apache APISIX** | Good — single Go-free binary + etcd | etcd holds config (small, self-hostable); data-plane is stateless | Medium (etcd to run) | Apache-2.0, ASF-governed | Strong: key-auth, limit-req/limit-count, proxy-rewrite/header injection all in core OSS; gRPC/WebSocket/SSE proxying | Vendor-neutral ASF project (no single-company control-plane). etcd is the one extra moving part. Strong candidate. |
| **Traefik (OSS)** | Excellent — designed for container/Coolify-style deploys | Fully stateless; config from labels/files/CRDs | **Low** — already the kind of reverse proxy Coolify itself uses | MIT | Good HTTP/SSE proxy + middlewares (headers, rate-limit, basic auth); **API-key auth + quota are not first-class** — needs a plugin or a forward-auth hop | Lowest ops load and most native to our stack, but it's a reverse proxy, not an API-management gateway: consumer/key-bucket + quota would have to live in our own service. |
| **KrakenD (CE)** | Good — single stateless binary | **Fully stateless by design** (no datastore) | **Low** | Apache-2.0 (Community Edition) | Excellent stateless HTTP edge; key-auth + rate-limit in CE; quota/consumer-management weaker; aggregation features we don't need | Cleanest match to "stateless edge proxy". Per-consumer monthly quota and a consumer registry are not its strength — same re-homing question as Traefik. |
| **Tyk (OSS)** | Good — self-host the gateway | Gateway needs Redis (and a dashboard/Mongo for the full product) | Medium-high | MPL-2.0 (gateway) | Full API-management: key-auth, rate-limit, **quota**, consumer/key model out of the box | Closest **feature-parity** with Zuplo's consumer+quota model, so the `zuplo-consumer.ts` re-home is most natural here — but it's the heaviest to run (Redis, optional Mongo) and the richest surface is in the paid dashboard. |

(Gravitee was floated in the planning note as an EU-rooted option; ruled out here as
heavier than warranted for a stateless edge proxy with no service-catalog/portal needs — its
strength is the management/portal layer we just retired with the Zudoku dev portal.)

The real axis is **API-management feature-parity (Tyk, Kong, APISIX)** versus **stateless-proxy
simplicity (KrakenD, Traefik)**. Zuplo gave us consumer keys + per-user quota for free; the
question is whether we keep that model in the gateway or move it into our own dashboard service
(which already owns the workspace/Gateway-key model and would own the consumer registry anyway).

## Decision / Recommendation

**Adopt Apache APISIX as the self-hosted EU gateway, with the per-workspace consumer/key model
re-homed into the dashboard rather than carried in the gateway.**

Rationale:

1. **Genuinely OSS and vendor-neutral.** Apache-2.0 under ASF governance — no single-company
   control plane, no OSS/Enterprise feature cliff for the policies we actually use (key-auth,
   `limit-req`, `limit-count`/quota, `proxy-rewrite` header injection are all core). Leaving a US
   SaaS gateway for a single-vendor OSS gateway with a paid tier (Kong-EE, Tyk dashboard) would
   re-introduce the dependency we're trying to remove. APISIX avoids that.
2. **Stateless data-plane, EU-self-hostable.** The data plane is stateless and runs as a container
   on Coolify alongside the dashboard; config lives in etcd, which we self-host in the EU. No
   request metadata leaves Hetzner Helsinki — which **closes PROC-001's UK→US transfer residual**
   instead of annotating it.
3. **Right fit as an API/MCP edge.** It does the four things Zuplo does for us today (key-auth,
   rate-limit, quota, `Authorization` rewrite to the backend Gateway key) natively, proxies SSE/
   WebSocket/gRPC cleanly (needed if a Streamable-HTTP `/mcp` ever sits behind it), and consumes
   declarative config so we keep config-as-code discipline.
4. **Honest about the cost.** etcd is one extra moving part vs. a pure single-binary proxy
   (KrakenD/Traefik). We accept that: APISIX's native consumer + quota model keeps the migration of
   `zuplo-consumer.ts` smaller and the policy surface closer to what we run today, whereas KrakenD/
   Traefik would force the consumer-registry build regardless. Either way the **source of truth for
   workspace→key mapping moves into the dashboard** (it already owns Gateway keys); the gateway
   becomes the enforcement point, not the registry.

This is a recommendation pending founder sign-off. If the founder weights "fewest moving parts"
above "native consumer/quota parity", **KrakenD CE** is the explicit fallback (stateless single
binary, Apache-2.0) — at the cost of building the consumer/quota registry in the dashboard. Tyk is
the fallback if API-management feature-parity with Zuplo is the priority and the Redis dependency is
acceptable.

## Consequences

- **Sovereignty story closes a gap.** The Cloud API edge becomes UK/EU self-hosted end-to-end;
  PROC-001 moves from "open US-transfer residual" toward retirement; `suppliers.yaml`, `ropa.yaml`,
  and `risk-register.yaml` get updated (and Zuplo eventually removed as a sub-processor) when
  cutover completes — **not before**.
- **Consumer/key model moves in-house.** `zuplo-consumer.ts` and `/keys/dashboard/api/consumer-key`
  are rewritten to provision/validate keys against the new gateway (or against a dashboard-owned
  consumer table that the gateway checks). Public key format changes from `zpka_…`; this is a
  client-visible change and needs a deprecation window.
- **Config-as-code is preserved but re-expressed.** `routes.oas.json` + `policies.json` (Zuplo
  schema) are replaced by APISIX declarative config (routes/upstreams/consumers/plugins). The
  OpenAPI document the dashboard serves via Scalar is unaffected — it's the API contract, not the
  gateway config.
- **New self-hosted component to run.** APISIX + etcd join the Coolify estate (extra containers,
  healthchecks, backups, the prod-box disk guard already in place). Ops load rises modestly.
- **Docs/runbooks churn.** `docs/runbooks/zuplo-*` are superseded by an APISIX runbook; the
  `zuplo.svg` brand mark and integration references are removed at decommission.
- **No change to the verification path.** REC-ADR-005 stands: `/mcp` and verification surfaces stay
  on the dashboard on Coolify. The gateway never verifies; it only fronts the API edge.

## Migration risks

- **Key-format break.** Moving off `zpka_…` consumer keys is client-visible. Mitigation: dual-run
  both gateways, support both key formats during overlap, deprecate on a published window.
- **Quota/rate-limit semantics drift.** Per-user monthly quota and 100/min limits must be
  reproduced faithfully; subtle differences (reset boundaries, `quotaOnStatusCodes` behaviour) can
  surface as customer-visible 429s. Mitigation: validate against the existing
  `validate-zuplo-*-v1.mjs` behaviour before flipping traffic.
- **Stateful consumer re-home.** Re-homing the per-workspace consumer model is the only non-trivial
  code change; get it wrong and key provisioning breaks for every workspace. Mitigation: build and
  validate it while Zuplo is still live (Phase A/B), behind a flag.
- **etcd operational burden.** A new datastore to run, back up, and monitor. Mitigation: small
  footprint, single-node to start, covered by existing backup + disk-guard practice; revisit HA
  only on customer pull.
- **CORS / header-injection parity.** The `inject-backend-auth` rewrite and the CORS policy must be
  reproduced exactly, or the dashboard will reject forwarded requests (it only accepts the backend
  `rk_…` key). Mitigation: parity test the forwarded `Authorization` header end-to-end.
- **Sovereignty regression if rushed.** Cutting over before the new edge is validated could drop
  requests or, worse, leave a half-migrated state spanning both gateways. Mitigation: the phased
  plan never cuts over until validation passes; decommission is the last phase.

## No cutover yet

This ADR is **draft** and authorises **nothing operational**. No gateway is stood up, no traffic
moves, no Zuplo resource is deleted, and the governance records are **not** edited on the basis of
this document alone. The next step is founder review of this ADR and the phased plan
(REC-PLAN-008); each phase there is independently gated and the Zuplo decommission (Phase E) is the
final, separately-approved step.

## Next step

Review and confirm the recommendation (APISIX, consumer model re-homed to the dashboard) or pick a
documented fallback (KrakenD for fewest moving parts; Tyk for closest Zuplo parity). On sign-off,
execute `planning/phase-d-gateway-routing-plan.md` phase by phase, starting with Phase A
(stand up the chosen gateway **alongside** Zuplo, no traffic).
