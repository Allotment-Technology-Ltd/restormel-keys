/** Static capability map for MCP `routing.capabilities` (read-only; no network). */
export const ROUTING_CAPABILITIES = {
  contractVersion: "2026-04-14",
  canonicalDocTopic: "keys_routing_contract",
  publicDocUrl: "https://restormel.dev/keys/docs/guides/routing-contract",
  resolve: {
    method: "POST",
    pathTemplate: "/keys/dashboard/api/projects/{projectId}/resolve",
    description:
      "Returns winning providerType/modelId plus stepChain (ordered tiers with rich metadata) and fallbackCandidates. Does not call LLM providers.",
    discovery: ["routeId", "workload+stage", "attemptNumber+previousFailure for server-advanced fallback"],
  },
  simulate: {
    method: "POST",
    pathTemplate: "/keys/dashboard/api/projects/{projectId}/routes/{routeId}/simulate",
    description:
      "Dry-run resolve for one route; optional stepDiagnostics; optional includeRoutingAttempts for hypothetical tier outcomes (no LLM execution).",
  },
  routeExport: {
    method: "GET",
    pathTemplate: "/keys/dashboard/api/projects/{projectId}/routes/{routeId}/export",
    description: "Portable route+steps JSON bundle (schema 1.0.0) for GitOps; no secrets.",
  },
  routeExplainChain: {
    method: "GET",
    pathTemplate: "/keys/dashboard/api/projects/{projectId}/routes/{routeId}/explain-chain",
    description:
      "Agent-oriented summary: route lifecycle, ordered steps (incl. advanceOn/retryOn hints), policies bound at workspace/project/environment/route (resolve layers). Read-only.",
  },
  routeImport: {
    method: "POST",
    pathTemplate: "/keys/dashboard/api/projects/{projectId}/routes/import",
    description:
      "Apply a portable bundle: create a route or replace an existing route (body.replaceRouteId) metadata + ordered steps.",
  },
  mcpTools: [
    "docs.canonical_resolve (topic keys_routing_contract)",
    "routing.capabilities",
    "routes.list",
    "routes.create (legacy shape; prefer routes.upsert_with_steps when using dashboard API)",
    "routes.update",
    "routes.delete",
    "routes.upsert_with_steps",
    "routing.export",
    "routing.import",
    "routing.explain_chain",
    "fallback_chain.set",
  ],
  aaif: {
    package: "@restormel/aaif",
    note: "AAIF carries request/response types; use @restormel/keys dashboard resolve() for full stepChain before executing AAIF-shaped calls.",
  },
} as const;
