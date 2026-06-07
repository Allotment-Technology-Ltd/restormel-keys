/**
 * Graph readiness prerequisites for auto-remediation and agent retrieval.
 */
import { peekConnectGraphStats } from "$lib/server/connect/graph-explorer-service";
import { loadGraphProvenanceAudit } from "$lib/server/connect/graph-provenance-audit";
import { loadGraphSourceLinkOptions } from "$lib/server/connect/graph-source-link-options";
import { loadGraphSourceCatalogStatus } from "$lib/server/connect/graph-source-catalog-status";
import { getConnectGraphTargetForWorkspace } from "$lib/server/neon";

export type GraphReadinessSnapshot = {
  pipelineCatalogCount: number;
  sourcesInPipeline: boolean;
  catalogComplete: boolean;
  linkComplete: boolean;
  embedComplete: boolean;
  validateComplete: boolean;
  complete: boolean;
  blockers: string[];
};

export async function evaluateGraphReadiness(
  workspaceId: string,
): Promise<GraphReadinessSnapshot> {
  const target = await getConnectGraphTargetForWorkspace(workspaceId);
  const surreal = target?.provider === "surreal";

  const [stats, catalog, link, provenance] = await Promise.all([
    peekConnectGraphStats(workspaceId).catch(() => null),
    loadGraphSourceCatalogStatus(workspaceId),
    loadGraphSourceLinkOptions(workspaceId).catch(() => null),
    surreal
      ? loadGraphProvenanceAudit(workspaceId).catch(() => null)
      : Promise.resolve(null),
  ]);

  const blockers: string[] = [];

  const catalogComplete = !surreal || catalog.sourcesInPipeline;
  if (surreal && !catalogComplete) {
    blockers.push("Import source text from your graph into the pipeline catalog.");
  }

  const linkComplete =
    provenance?.verdict === "native" ||
    (provenance != null &&
      provenance.verdict !== "unknown" &&
      provenance.needsEdgeRepair === 0) ||
    (link != null && link.unitsNeedingLink === 0 && !link.estimate);
  if (!linkComplete) {
    blockers.push("Link ideas to catalog source text.");
  }

  const embedComplete =
    stats != null && stats.units > 0 && stats.embedded >= stats.units;
  if (!embedComplete) {
    blockers.push("Embed all ideas at a uniform vector dimension.");
  }

  const validateComplete =
    stats != null && stats.units > 0 && stats.validation.unvalidated === 0;
  if (!validateComplete) {
    blockers.push("Run validation on unchecked ideas before auto-remediation.");
  }

  const complete =
    catalogComplete && linkComplete && embedComplete && validateComplete;

  return {
    pipelineCatalogCount: catalog.pipelineCatalogCount,
    sourcesInPipeline: catalog.sourcesInPipeline,
    catalogComplete,
    linkComplete,
    embedComplete,
    validateComplete,
    complete,
    blockers,
  };
}

export async function assertGraphReadyForAutoRemediation(
  workspaceId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const readiness = await evaluateGraphReadiness(workspaceId);
  if (readiness.complete) return { ok: true };
  return {
    ok: false,
    message: `Complete graph readiness first: ${readiness.blockers.join(" ")}`,
  };
}
