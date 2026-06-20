/**
 * Phase 3 Stage 0 — seeded demo graph (first-run make-or-break).
 *
 * Seeds a small, pre-extracted demo knowledge graph DIRECTLY into the Postgres
 * graph spine (`knowledge_graph_{targets,sources,units,relations}`) for a workspace,
 * so the Prove console has verifiable, cited claims to query with **zero ingest run
 * and zero external SurrealDB**.
 *
 * Why pre-extracted (not the raw starter-corpus markdown): `loadStarterCorpus`
 * stages raw documents in `knowledge_source_documents` for the LLM ingest pipeline
 * to extract. That requires connected provider keys + a full ingest run before any
 * claim exists. Stage 0's job is to make the FIRST verified answer reachable in
 * <3 min with no setup, so we seed the *graph spine* (the output of extraction)
 * directly, using the exact same canonical writers the real pipeline uses
 * (`insertConnectGraphSourcePostgres` + `storeExtractedGraphPostgres`). The demo
 * claims are faithful to the CC0 philosophy starter corpus.
 *
 * Swap the corpus: set `CONNECT_DEMO_GRAPH_SEED` to another seed file's `id`
 * (a sibling `*.json` in this directory) — e.g. a dev-docs or governance corpus —
 * to change the first-run domain. The seed file is the only thing to author.
 *
 * Idempotent: re-running is a no-op once the demo source key exists for the
 * workspace (checked via the canonical `source_key`). Safe to call on every
 * onboarding / login.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  findLatestConnectGraphSourceByKeyPostgres,
  insertConnectGraphSourcePostgres,
  storeExtractedGraphPostgres,
  upsertConnectGraphTarget,
  getConnectGraphStats,
} from "$lib/server/neon";

const SEED_DIR = dirname(fileURLToPath(import.meta.url));

/** Default corpus shipped for first-run. Override the *active* corpus by id via env. */
export const DEFAULT_DEMO_GRAPH_SEED_ID = "restormel-philosophy-demo-v1";

/** Suffix marking the workspace's demo provenance source key (idempotency probe). */
const DEMO_SOURCE_KEY_PREFIX = "demo:";

export type DemoGraphSuggestedQuestion = {
  /** "answerable" shows off a cited answer; "abstention" shows off honest refusal. */
  type: "answerable" | "abstention";
  question: string;
};

type SeedUnit = {
  localId: string;
  unitType?: string | null;
  text: string;
};

type SeedRelation = {
  fromLocalId: string;
  toLocalId: string;
  relationType: string;
};

type SeedSource = {
  /** Stable cross-run identity — drives idempotency (`knowledge_graph_sources.source_key`). */
  key: string;
  title: string;
  textPreview?: string;
  units: SeedUnit[];
  relations?: SeedRelation[];
};

export type DemoGraphSeed = {
  id: string;
  label: string;
  domain: string;
  license: string;
  description: string;
  sources: SeedSource[];
  suggestedQuestions: DemoGraphSuggestedQuestion[];
};

export type SeedDemoGraphResult = {
  /** True when the demo graph was already present (no rows written). */
  already_seeded: boolean;
  seedId: string;
  graphTargetId: string;
  sourcesSeeded: number;
  unitsSeeded: number;
  relationsSeeded: number;
};

/** Which corpus to seed (env override, falling back to the shipped default). */
export function activeDemoGraphSeedId(): string {
  const override = (process.env.CONNECT_DEMO_GRAPH_SEED ?? "").trim();
  return override || DEFAULT_DEMO_GRAPH_SEED_ID;
}

function isDemoGraphSeed(value: unknown): value is DemoGraphSeed {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.label === "string" &&
    Array.isArray(v.sources) &&
    Array.isArray(v.suggestedQuestions)
  );
}

/**
 * Load a seed corpus by id from the seed directory. Reads only the bundled
 * `*.json` files in this directory — no arbitrary path is ever opened, so the
 * env override cannot be used for path traversal.
 */
export function loadDemoGraphSeed(seedId: string = activeDemoGraphSeedId()): DemoGraphSeed {
  const files = readdirSync(SEED_DIR).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const raw = readFileSync(join(SEED_DIR, file), "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    if (isDemoGraphSeed(parsed) && parsed.id === seedId) {
      return parsed;
    }
  }
  throw new Error(`Demo graph seed "${seedId}" not found in ${SEED_DIR}`);
}

/** Suggested first-run questions for the active seed (incl. a deliberate abstention). */
export function demoGraphSuggestedQuestions(
  seedId: string = activeDemoGraphSeedId(),
): DemoGraphSuggestedQuestion[] {
  return loadDemoGraphSeed(seedId).suggestedQuestions;
}

/**
 * Idempotently seed the active demo graph for a workspace into the Postgres spine.
 *
 * 1. Registers a `knowledge_graph_targets` row (provider `postgres`,
 *    `use_dashboard_database = true`, `status = 'ok'`) so the workspace has a
 *    graph store with zero external setup.
 * 2. For each seed source: registers a `knowledge_graph_sources` provenance row
 *    and writes its pre-extracted units + relations via the canonical pipeline
 *    writer `storeExtractedGraphPostgres`.
 *
 * Re-running is a no-op once the demo's source keys are present.
 */
export async function seedDemoGraph(workspaceId: string): Promise<SeedDemoGraphResult> {
  const seed = loadDemoGraphSeed();

  // Idempotency: if the first demo source key is already registered for this
  // workspace, the demo graph has been seeded — do nothing.
  const probeKey = seed.sources[0]?.key;
  const targetId = await upsertDemoGraphTarget(workspaceId, seed);

  if (probeKey) {
    const existing = await findLatestConnectGraphSourceByKeyPostgres({
      workspaceId,
      sourceKey: probeKey,
    });
    if (existing) {
      return {
        already_seeded: true,
        seedId: seed.id,
        graphTargetId: targetId,
        sourcesSeeded: 0,
        unitsSeeded: 0,
        relationsSeeded: 0,
      };
    }
  }

  let sourcesSeeded = 0;
  let unitsSeeded = 0;
  let relationsSeeded = 0;

  for (const source of seed.sources) {
    // Skip any individual source already present (partial re-run resilience).
    const present = await findLatestConnectGraphSourceByKeyPostgres({
      workspaceId,
      sourceKey: source.key,
    });
    if (present) continue;

    const sourceId = await insertConnectGraphSourcePostgres({
      workspaceId,
      title: source.title,
      textPreview: source.textPreview ?? null,
      sourceKind: "demo",
      sourceKey: source.key,
      contentHash: `demo:${seed.id}`,
    });
    sourcesSeeded += 1;

    const stored = await storeExtractedGraphPostgres({
      workspaceId,
      sourceId,
      units: source.units.map((u) => ({
        localId: u.localId,
        text: u.text,
        unitType: u.unitType ?? "claim",
        domain: seed.domain,
      })),
      relations: (source.relations ?? []).map((r) => ({
        fromLocalId: r.fromLocalId,
        toLocalId: r.toLocalId,
        relationType: r.relationType,
      })),
    });
    unitsSeeded += stored.units.length;
    relationsSeeded += stored.relations;
  }

  return {
    already_seeded: false,
    seedId: seed.id,
    graphTargetId: targetId,
    sourcesSeeded,
    unitsSeeded,
    relationsSeeded,
  };
}

/**
 * Register (or refresh) the workspace's demo graph target on the dashboard's own
 * Postgres — no external endpoint, no secret. Idempotent on the workspace's
 * existing demo target (matched by provider + label).
 */
async function upsertDemoGraphTarget(workspaceId: string, seed: DemoGraphSeed): Promise<string> {
  const existingId = await findExistingDemoTargetId(workspaceId, seed.label);
  const record = await upsertConnectGraphTarget({
    ...(existingId ? { id: existingId } : {}),
    workspaceId,
    label: seed.label,
    provider: "postgres",
    useDashboardDatabase: true,
    status: "ok",
    settings: { demo: true, seedId: seed.id },
  });
  return record.id;
}

async function findExistingDemoTargetId(
  workspaceId: string,
  label: string,
): Promise<string | undefined> {
  const { listConnectGraphTargetsForWorkspace } = await import("$lib/server/neon");
  const targets = await listConnectGraphTargetsForWorkspace(workspaceId).catch(() => []);
  const match = targets.find(
    (t) => t.provider === "postgres" && (t.label === label || Boolean(t.settings?.demo)),
  );
  return match?.id;
}

/** Whether a workspace already has any seeded demo source (cheap-ish probe). */
export async function workspaceHasDemoGraph(workspaceId: string): Promise<boolean> {
  const probeKey = loadDemoGraphSeed().sources[0]?.key;
  if (!probeKey) return false;
  const existing = await findLatestConnectGraphSourceByKeyPostgres({
    workspaceId,
    sourceKey: probeKey,
  });
  return Boolean(existing);
}

/** Post-seed graph stats (units/relations) — for journey-payoff confirmation. */
export async function demoGraphStats(
  workspaceId: string,
): Promise<{ units: number; relations: number }> {
  const stats = await getConnectGraphStats(workspaceId).catch(() => null);
  return { units: stats?.units ?? 0, relations: stats?.relations ?? 0 };
}

export { DEMO_SOURCE_KEY_PREFIX };
