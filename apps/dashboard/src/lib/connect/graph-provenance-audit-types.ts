export type ProvenanceAuditView = {
  store: "surreal" | "postgres" | "none";
  totalUnits: number;
  graphLinked: number;
  unlinked: number;
  legacyPlaceholder: number;
  needsEdgeRepair: number;
  pipelineCatalogSources: number;
  verdict: "native" | "needs_edge_repair" | "empty" | "unavailable" | "unknown";
  headline: string;
};
