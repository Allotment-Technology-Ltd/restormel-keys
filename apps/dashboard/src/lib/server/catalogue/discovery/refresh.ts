/**
 * Scheduled catalogue refresh orchestration (advisory plan §3.9).
 *
 * discover → land NEW models as `unverified` (provenance discovered) via the repository →
 * compute deprecation candidates. The actual lifecycle flip + durable persistence is the
 * DB-backed repo's job (deferred); this orchestration is offline-testable with injected sources +
 * an in-memory repo. Provider-agnostic: breadth = adding sources, not editing this file.
 */
import type { CatalogueModel } from "../types";
import type { CatalogueRepository } from "../repository";
import type { CatalogueSource, DiscoveredModel } from "./types";

/** Stable catalogue id for a discovered model: `{provider}-{slug}` (slashes → dashes). */
export function catalogueIdForDiscovered(d: DiscoveredModel): string {
  return `${d.providerType}-${d.providerModelId.replace(/\//g, "-")}`;
}

export interface RefreshResult {
  discovered: number;
  /** Catalogue ids newly registered as unverified. */
  added: string[];
  /** Every catalogue id seen in this discovery run. */
  seen: Set<string>;
}

export async function refreshFromSources(
  repo: CatalogueRepository,
  sources: CatalogueSource[],
): Promise<RefreshResult> {
  const added: string[] = [];
  const seen = new Set<string>();
  let discovered = 0;

  for (const source of sources) {
    const models = await source.fetchModels();
    for (const d of models) {
      discovered += 1;
      const id = catalogueIdForDiscovered(d);
      seen.add(id);
      if (!(await repo.getModel(id))) {
        await repo.registerUnverifiedModel({
          id,
          providerType: d.providerType,
          providerModelId: d.providerModelId,
        });
        added.push(id);
      }
    }
  }

  return { discovered, added, seen };
}

/**
 * Existing DISCOVERED-provenance models absent from the latest discovery are deprecation candidates.
 * Hand-seeded models are never auto-deprecated by a missing source. The real pipeline requires N
 * consecutive misses before flipping lifecycle (the confirmation window) — this surfaces the
 * single-run candidate set for that pass.
 */
export function computeDeprecationCandidates(
  existing: CatalogueModel[],
  seen: Set<string>,
): string[] {
  return existing
    .filter((m) => m.provenance === "discovered" && !seen.has(m.id))
    .map((m) => m.id);
}
