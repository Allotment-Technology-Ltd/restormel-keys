/**
 * Stage suitability advisory (advisory plan §3.2/§3.4/§3.8) — derived, provider-neutral, region-
 * filterable. Read-only and ADDITIVE: it does not replace the existing model-recommendations
 * endpoint or the live pickers. Catalogue is read from the live operational DB
 * (DbCatalogueRepository) so discovered/registered models surface; it falls back to the bundled
 * seed when the DB has zero models (offline / unsynced).
 *
 * Query params: stage, home, region, excludeHome, excludeRegion (comma lists), keepUnknown=1.
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  getOrCreateDefaultWorkspace,
  listProviderIntegrations,
  listProjectsByWorkspace,
  listEnvironments,
} from "$lib/server/db";
import { sessionUser } from "$lib/server/session-user";
import {
  getConnectStageRouting,
  listConnectStageRouteRows,
} from "$lib/server/connect/stage-routing";
import { resolveUpstreamValidationContext } from "$lib/server/connect/resolve-stage-route-models";
import {
  DbCatalogueRepository,
  computeFlatStageAdvisory,
  serializeFlatStageAdvisory,
  resolveUnderlyingFamily,
  type RegionFilter,
} from "$lib/server/catalogue";
import { CONNECT_MODEL_STAGES, type ConnectModelStage } from "@restormel/contracts/connect";

// DB-backed (Phase-1 swap): reads the live synced catalogue (incl. natively-registered models the
// bundled seed lacks). Falls back to the seed automatically when the DB has zero models.
const repo = new DbCatalogueRepository();

function parseList(v: string | null): string[] | undefined {
  if (!v) return undefined;
  const arr = v.split(",").map((s) => s.trim()).filter(Boolean);
  return arr.length ? arr : undefined;
}

export const GET: RequestHandler = async ({ locals, url }) => {
  const user = sessionUser(locals);
  if (!user) return json({ error: "unauthorized" }, { status: 401 });

  const raw = url.searchParams.get("stage") ?? "extraction";
  const stage: ConnectModelStage = (CONNECT_MODEL_STAGES as readonly string[]).includes(raw)
    ? (raw as ConnectModelStage)
    : "extraction";

  const regionFilter: RegionFilter = {
    homeJurisdictions: parseList(url.searchParams.get("home")),
    processingRegions: parseList(url.searchParams.get("region")),
    excludeHomeJurisdictions: parseList(url.searchParams.get("excludeHome")),
    excludeProcessingRegions: parseList(url.searchParams.get("excludeRegion")),
    keepUnknownRegion: url.searchParams.get("keepUnknown") === "1",
  };
  const hasFilter =
    Boolean(regionFilter.homeJurisdictions) ||
    Boolean(regionFilter.processingRegions) ||
    Boolean(regionFilter.excludeHomeJurisdictions) ||
    Boolean(regionFilter.excludeProcessingRegions);

  const workspace = await getOrCreateDefaultWorkspace(user.uid);
  const userId = user.uid;
  const integrations = await listProviderIntegrations(workspace.id).catch(() => []);
  // Connected providers (normalized) — marks rows + still drives the validation upstream context.
  // It does NOT restrict the candidate set: the flat advisory ranks the WHOLE catalogue.
  const connected = new Set(
    integrations.map((i) => (i.providerType ?? "").trim().toLowerCase()).filter(Boolean),
  );
  const allProviders = await repo.listProviders();

  // Cross-model caveat needs the underlying families bound upstream (validation only).
  const upstreamFamilies = new Set<string>();
  if (stage === "validation") {
    const routing = await getConnectStageRouting(workspace.id).catch(() => null);
    const projects = await listProjectsByWorkspace(workspace.id).catch(() => []);
    const projectId = routing?.project_id ?? projects[0]?.id ?? null;
    let environmentId = routing?.environment_id ?? null;
    if (projectId && !environmentId) {
      const envs = await listEnvironments(projectId, userId).catch(() => []);
      environmentId = envs[0]?.id ?? null;
    }
    if (projectId && environmentId) {
      const stageRows = await listConnectStageRouteRows({
        workspaceId: workspace.id,
        userId,
        projectId,
        environmentId,
      }).catch(() => []);
      const upstream = await resolveUpstreamValidationContext({
        projectId,
        userId,
        environmentId,
        routing,
        stageRows,
      }).catch(() => null);
      if (upstream) {
        for (const id of upstream.modelIds) {
          const fam = resolveUnderlyingFamily(id, {});
          if (fam) upstreamFamilies.add(fam);
        }
      }
    }
  }

  const flat = await computeFlatStageAdvisory(repo, {
    stage,
    providers: allProviders,
    connected,
    upstreamFamilies,
    regionFilter: hasFilter ? regionFilter : undefined,
  });
  const serialized = serializeFlatStageAdvisory(flat);

  return json({
    stage,
    connected_providers: [...connected],
    region_filter: hasFilter ? regionFilter : null,
    upstream_families: [...upstreamFamilies],
    models: serialized.models,
    hidden_by_region: serialized.hiddenByRegion,
    hidden_unknown_region: serialized.hiddenUnknownRegion,
  });
};
