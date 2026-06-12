/**
 * K5 — run-console "Served by" attribution display logic (pure; unit-tested).
 *
 * Consumes the per-stage attribution persisted into job progress (shape mirrors
 * `$lib/server/connect/stage-attribution` → ConnectStageAttribution) and produces
 * the rows the run console renders: "<model> · <provider> · route <name> (step N) ·
 * K attempts", with the route name linking to the builder (X4: route → builder).
 *
 * Display-only — no fetch, no mutation. Keeping it here (not in the .svelte file)
 * makes the with/without-attribution and legacy-run cases unit-testable.
 */
import { CONNECT_MODEL_STAGES, type ConnectModelStage } from "@restormel/contracts/connect";

export type RunStageAttribution = {
  routeId: string | null;
  routeName: string | null;
  projectId: string | null;
  stepId: string | null;
  stepOrderIndex: number | null;
  provider: string | null;
  modelId: string | null;
  attempts: number;
  recordedAt: string;
};

export type RunAttributionMap = Partial<Record<ConnectModelStage, RunStageAttribution>>;

export type AttributionDisplayRow = {
  stage: ConnectModelStage;
  label: string;
  provider: string;
  modelId: string;
  routeName: string | null;
  builderHref: string | null;
  /** "step N" (1-based) or null when no step index was resolved. */
  stepDisplay: string | null;
  attempts: number;
  /** validation only: true/false vs extraction family, null when unknowable. */
  crossFamilyVsExtraction: boolean | null;
};

const STAGE_LABELS: Record<ConnectModelStage, string> = {
  extraction: "Extraction",
  grouping: "Grouping",
  validation: "Validation",
  remediation: "Remediation",
  embedding: "Embedding",
};

/** Coarse provider→family map; mirrors the server canonical-provider families. */
export function providerFamily(provider: string | null | undefined): string | null {
  const p = provider?.trim().toLowerCase();
  if (!p) return null;
  if (p.includes("openai") || p === "azure") return "openai";
  if (p.includes("anthropic") || p.includes("claude")) return "anthropic";
  if (p.includes("google") || p.includes("gemini") || p.includes("vertex")) return "google";
  if (p.includes("mistral")) return "mistral";
  if (p.includes("cohere")) return "cohere";
  return p;
}

/**
 * Build the ordered "Served by" rows. Only stages with a real provider+model are
 * shown (a stage that never ran has no row). dashboardBase builds the builder href.
 */
export function buildAttributionRows(
  attribution: RunAttributionMap | null | undefined,
  dashboardBase: string,
): AttributionDisplayRow[] {
  if (!attribution) return [];
  const extractionProvider = attribution.extraction?.provider ?? null;
  const rows: AttributionDisplayRow[] = [];
  for (const stage of CONNECT_MODEL_STAGES) {
    const a = attribution[stage];
    if (!a || !a.provider || !a.modelId) continue;
    const builderHref =
      a.projectId && a.routeId
        ? `${dashboardBase}/projects/${a.projectId}/routes/${a.routeId}?flow=visual`
        : null;
    const stepDisplay = a.stepOrderIndex != null ? `step ${a.stepOrderIndex + 1}` : null;
    let crossFamilyVsExtraction: boolean | null = null;
    if (stage === "validation" && extractionProvider) {
      const vf = providerFamily(a.provider);
      const ef = providerFamily(extractionProvider);
      crossFamilyVsExtraction = vf && ef ? vf !== ef : null;
    }
    rows.push({
      stage,
      label: STAGE_LABELS[stage],
      provider: a.provider,
      modelId: a.modelId,
      routeName: a.routeName,
      builderHref,
      stepDisplay,
      attempts: a.attempts,
      crossFamilyVsExtraction,
    });
  }
  return rows;
}

/** Earliest recorded attribution timestamp → "Attribution recorded from <date>" honesty line. */
export function attributionRecordedFrom(attribution: RunAttributionMap | null | undefined): Date | null {
  if (!attribution) return null;
  const stamps = CONNECT_MODEL_STAGES.map((s) => attribution[s]?.recordedAt).filter(
    (t): t is string => typeof t === "string" && t.length > 0,
  );
  if (stamps.length === 0) return null;
  const earliest = stamps.reduce((a, b) => (a < b ? a : b));
  const d = new Date(earliest);
  return Number.isNaN(d.getTime()) ? null : d;
}
