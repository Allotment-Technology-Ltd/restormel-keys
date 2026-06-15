/**
 * Normalised "physical upstream" identity for the verifying-proxy cross-row
 * uniqueness guard (REC-PLAN-010 / W2-2 Phase B, D-d).
 *
 * Standalone (no DB import) so it can be shared by the neon persistence layer,
 * the upstream-MCP service, and hermetic tests without dragging in build-only
 * workspace deps. MUST stay byte-for-byte equivalent to the SQL unique-index
 * expression in migration 069:
 *   (lower(rtrim(endpoint, '/')), COALESCE(namespace,''), COALESCE(database,''))
 */
export function normalizeUpstreamPhysicalKey(params: {
  endpoint: string;
  namespace?: string | null;
  database?: string | null;
}): { endpoint: string; namespace: string; database: string } {
  return {
    endpoint: params.endpoint.trim().replace(/\/+$/, "").toLowerCase(),
    namespace: (params.namespace ?? "").trim(),
    database: (params.database ?? "").trim(),
  };
}
