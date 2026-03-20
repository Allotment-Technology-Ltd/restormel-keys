# Sophia re-validation prompt (operator pass)

Use this prompt to validate the latest Dashboard API improvements and separate platform behavior from live project setup gaps.

---

You are validating Restormel Dashboard API against a live project.  
Base URL: `https://restormel.dev/keys/dashboard/api`

Use Sophia's configured:
- `projectId`
- `environmentId`
- `gatewayKey` (`rk_...`)

## 1) OpenAPI artifact reachability

Check both extensionless and yaml endpoints:

- `GET /keys/docs/api/openapi`
- `GET /keys/dashboard/api/openapi`
- `GET /keys/docs/api/openapi.yaml`
- `GET /keys/dashboard/api/openapi.yaml`

Record status codes and confirm YAML content is retrievable on at least one docs path and one dashboard path.

## 2) Route/runtime regression safety

Reconfirm these still return 200 on valid generic-route payloads:

- `GET /projects/{projectId}/routes`
- `GET /projects/{projectId}/route-coverage`
- `GET /projects/{projectId}/readiness`
- `GET /projects/{projectId}/routes/{routeId}/steps`
- `GET /projects/{projectId}/routes/{routeId}/history`
- `POST /projects/{projectId}/resolve`
- `POST /projects/{projectId}/routes/{routeId}/simulate`
- `POST /projects/{projectId}/routes/{routeId}/recommend`

For resolve/simulate success payloads, confirm machine-readable metadata fields are present:
`contractVersion`, `traceId`, `routeId`, `routeName`, `selectedStepId`, `selectedOrderIndex`, `switchReasonCode`, `estimatedCostUsd`, `matchedCriteria`, `fallbackCandidates`, `decisionMetadata`.

## 3) Gateway Key policy discovery and lifecycle

1. Call `GET /policies` with the Gateway Key.
2. Confirm it returns project-scoped policy objects (not empty due to auth mismatch).
3. Select a real `policyId` from that response.
4. Validate lifecycle endpoints with that real id:
   - `GET /policies/{id}/history`
   - `POST /policies/{id}/publish`
   - `POST /policies/{id}/diff`
   - `POST /policies/{id}/rollback` (only if there is a prior version)

Report any non-200 responses with exact endpoint + body.

## 4) Provider-health contract quality

Call `GET /projects/{projectId}/providers/health` and verify the response includes:

- top-level: `status`, `reasonCode`, `reason`, `operatorMessage`, `projectBindingsCount`, `workspaceIntegrationsCount`
- per provider: `status`, `reasonCode`, `reason`, `lastCheckedAt`, `hasProjectBinding`, `hasWorkspaceIntegration`, `usableForResolve`, `usableForSimulation`, `modelsAvailableCount`

If provider list is empty or degraded, correlate with `readiness` output and classify whether issue is:
- platform regression, or
- project setup gap.

## 5) Stage-aware setup gap confirmation

Run stage-aware resolve/simulate payloads (`workload`, `stage`, `task`, `attemptNumber`, `constraints.maxCost`) and confirm whether failures are due to missing stage-bound routes/provider bindings rather than endpoint breakage.

Classify findings clearly:

- **Platform regressions** (Restormel code/API issue)
- **Project setup gaps** (bindings/routes missing in live project)
- **Documentation parity gaps**

Return a concise table: endpoint, expected, actual, classification, next action.
