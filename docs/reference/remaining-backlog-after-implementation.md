# Practical remaining backlog (after implementation pass)

**Status:** Reference. Grounded in actual repo state after the cursor implementation prompt pack (Prompts 20–27). Update when major features ship or priorities change.

**Canonical “what is live”:** [implemented-behaviour.md](implemented-behaviour.md).

---

## 1. Completed capabilities

- **Auth & workspace:** Neon Auth (GitHub), session; one default workspace per user on first use.
- **Projects & environments:** CRUD, project detail, environments (dev/prod) per project.
- **Gateway Keys (Access):** List/create/revoke across projects; prefix-only in UI; raw key once on create; audit on create/revoke.
- **Provider Integrations:** List, create, bind to project/environment; credential_ref only; verification endpoint (placeholder logic).
- **Models catalog:** List/detail, lifecycle badges, source verification (“Not yet verified”), migration section when deprecated/retired; seed + `pnpm run seed:catalog`.
- **Routes:** List routes; project → routes → route detail; default model, steps (read-only in UI); lifecycle warnings when route uses deprecated/retiring models.
- **Route steps API:** Create/update/delete steps via API; no step editor UI on route detail.
- **Policies:** List, create, detail, bindings; `evaluatePolicies` API; rule shapes (allowlist/denylist, deprecated_model_block); budget/token cap placeholder.
- **Request execution (resolve):** POST resolve by project + environment; real route-resolver; request log written (resolved / no_route).
- **Analytics:** Overview (request count, latency, error rate, spend placeholder); provider/model/route mix; period selector (24h, 7d, 30d, 90d); recent requests; links to Logs and model catalog.
- **Logs & Traces:** Request logs; filter by project/route; cross-links from Analytics.
- **Onboarding:** Unauthenticated welcome (order + key model); signed-in Overview checklist when no projects/keys/integrations; links to real pages.
- **Terminology & docs:** Gateway Key vs Provider credential in UI and runbooks; legacy terms annotated (`api_keys`, `KEYS_BACKEND_API_KEY`); implemented-behaviour and ux-contracts updated.
- **Tests:** Unit/API tests for routes, policies, models, integrations, resolve; integration test for control-plane flow (resolve + real resolver + mocked db).

---

## 2. Partial capabilities

- **Route step editing:** Backend and API full CRUD; **UI:** route detail shows steps but no add/edit/delete controls (copy says “full step editing can be wired to the steps API”).
- **Provider verification:** Endpoint exists; implementation is placeholder (sets status + lastVerifiedAt; no real provider call).
- **Integration model discovery:** GET `/api/integrations/[id]/models` returns empty array; integration detail page notes “Model discovery summary coming soon.”
- **Billing:** Billing page is a short placeholder (link to pricing); no subscription/usage enforcement in dashboard; checkout flow exists in site.
- **Spend in Analytics:** Shown when `estimated_cost` is set on request logs; resolve API does not set it today, so spend is usually “—”.
- **Lifecycle & Migrations page:** Placeholder + honest note; model detail has Migration section when deprecated/retired.
- **Usage (project):** Project detail links to “Usage (placeholder)”; project/usage page is placeholder (Phase 4).
- **Management keys:** Access page shows “Management keys … coming soon”; table and verification exist, no creation UI or docs.

---

## 3. Missing capabilities

- **Route → execution wiring:** Dashboard Route/RouteStep are not used by headless `createRouter` or gateway; resolve returns provider/model for caller to use; no in-repo proxy that uses resolved route + provider credential to forward requests.
- **Restormel-managed billing:** No real charge or metering; no usage-based billing flow.
- **Dynamic model ingestion:** Catalog is static seed + script; no provider API-based discovery or refresh.
- **Policy enforcement in request path:** `evaluatePolicies` is callable but not invoked in resolve or gateway path.
- **Management keys / PATs:** No create/list UI; no documented flow.
- **Customer/tenant or exposure rules:** Not implemented.
- **Full route step UI:** No form to add/edit/delete steps on route detail.

---

## 4. Technical debt introduced

- **Route steps UI gap:** Steps API is complete; route detail only displays steps. Adding a minimal step editor (add step, reorder, enable/disable, delete) would reduce reliance on API-only usage.
- **Provider verification placeholder:** Verify endpoint does not call provider; real validation would require credential resolution (vault) and provider-specific GET (e.g. /v1/models).
- **Integration model discovery:** Empty response; would need credential resolution + provider-specific discovery and mapping to catalog.
- **Spend not populated:** `insertRequestLog` could accept optional `estimated_cost` from a pricing lookup (model + tokens) so Analytics spend is non-empty when data exists.
- **Billing page:** Thin placeholder; if Paddle/subscription is used, a minimal “current plan” or “manage subscription” link could be added.
- **Tests:** No Playwright or real-DB e2e; control-plane flow covered by one integration test with mocked db.

---

## 5. Highest-value next implementation tasks

1. **Route step editor UI** — Add “Add step” / edit/delete on route detail so users can configure steps without calling the API. Reuses existing steps API.
2. **Wire resolve to execution (optional proxy)** — Either document “caller uses resolve response to call provider” or add a minimal proxy in dashboard/gateway that uses resolved route + stored provider credential to forward one request (proof of path).
3. **Populate estimated_cost on request log** — Optional pricing lookup (e.g. by modelId) when writing request log so Analytics “Est. spend” is meaningful when data exists.
4. **Provider verification (real)** — Implement verify to call provider (e.g. GET /v1/models) when credential_ref can be resolved; update status and last_verified_at.
5. **Billing page minimal** — Link to Paddle customer portal or show “Current plan” if subscription state is available.

---

## 6. Sequencing recommendations

- **Next (fast):** Route step editor UI (high impact, clear scope, API exists).
- **Then:** Either (a) resolve → execution proof (proxy or doc + example), or (b) estimated_cost in request log for Analytics.
- **After that:** Provider verification with real provider call (depends on credential resolution); then integration model discovery if catalog alignment is needed.
- **Later:** Restormel-managed billing, management keys UI, policy enforcement in request path, dynamic model ingestion — all larger scope.

---

*Update this doc when completing major items or when priorities change. Keep STATUS.md and ROADMAP.md in sync.*
