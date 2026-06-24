/**
 * CatalogueRepository backed by the bundled seed JSON (advisory plan §3.1).
 *
 * Fully offline — no DB. The seed (apps/dashboard/data/model-catalog-seed.json) is the canonical
 * source for the 149 catalogue models, so this serves the advisory read path everywhere today.
 * Free-text/discovered models register into an in-memory overlay for the process lifetime; durable
 * persistence is the Neon → replacement-Postgres impl (Phase 1, deferred). When that lands, swap
 * the repository binding — no consumer changes (the whole point of the interface).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { InMemoryCatalogueRepository } from "./repository";
import { resolveSeedPath } from "./seed-path";
import type { CatalogueModel } from "./types";

// Module-relative path: correct in source / under prerender, but OVERSHOOTS in the bundled
// adapter-node build (drops the `dashboard/` segment → ENOENT). `resolveSeedPath` prefers it
// when present, else walks up from cwd to the workspace root for the canonical seed location.
const SEED_PATH = resolveSeedPath(
  fileURLToPath(new URL("../../../../data/model-catalog-seed.json", import.meta.url)),
);

export function loadSeedModels(): CatalogueModel[] {
  const raw = readFileSync(SEED_PATH, "utf8");
  const seed = JSON.parse(raw) as { models?: CatalogueModel[] };
  return seed.models ?? [];
}

export class SeedCatalogueRepository extends InMemoryCatalogueRepository {
  constructor() {
    super(loadSeedModels());
  }
}
