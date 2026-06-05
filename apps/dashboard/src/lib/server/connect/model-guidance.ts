/**
 * Per-stage model recommendations for Connect ingestion (2026 catalog).
 * Ranked lists filtered by workspace provider integrations at runtime.
 */
import type { ConnectModelStage } from "@restormel/contracts/connect";
import {
  pickEmbeddingModelForDimensions,
  type WorkspaceEmbeddingLock,
} from "$lib/server/connect/embedding-contract";
import type { UpstreamValidationContext } from "$lib/server/connect/resolve-stage-route-models";
import {
  TOGETHER_GATEWAY_EMBEDDING_MODEL_ID,
  TOGETHER_GATEWAY_PROVIDER,
  isIngestProviderSatisfied,
  remapRecommendationViaTogether,
  resolveIngestRecommendationProvider,
} from "$lib/server/connect/together-ingest-gateway";

export type IngestModelTier = "production" | "economy" | "embedding";

export type IngestModelRecommendation = {
  modelId: string;
  provider: "openai" | "anthropic" | "google" | "mistral" | "voyage" | string;
  tier: IngestModelTier;
  rationale: string;
  requiresStructuredOutput?: boolean;
  /** When validation cannot use a different provider than upstream stages. */
  sameProviderFallback?: boolean;
};

export type StageModelGuidance = {
  stage: ConnectModelStage;
  label: string;
  criteria: string[];
  production: IngestModelRecommendation[];
  economy: IngestModelRecommendation[];
  crossModelNote?: string;
};

/** Canonical 2026 production picks — refresh quarterly with model-catalog-seed. */
export const INGEST_STAGE_MODEL_GUIDANCE: StageModelGuidance[] = [
  {
    stage: "extraction",
    label: "Extraction & relations",
    criteria: [
      "Strong structured JSON / tool mode",
      "High source faithfulness on long context",
      "Large context window for full sections",
    ],
    production: [
      { modelId: "claude-sonnet-4-6", provider: "anthropic", tier: "production", rationale: "Best faithfulness + JSON on long docs", requiresStructuredOutput: true },
      { modelId: "gpt-5.2", provider: "openai", tier: "production", rationale: "Strong multimodal + structured output", requiresStructuredOutput: true },
      { modelId: "gemini-3.1-pro", provider: "google", tier: "production", rationale: "Long context fallback", requiresStructuredOutput: true },
      { modelId: "together-qwen3-5-397b", provider: TOGETHER_GATEWAY_PROVIDER, tier: "production", rationale: "Together-native Qwen 3.5 — structured output, 262k context", requiresStructuredOutput: true },
      { modelId: "together-kimi-k2-5", provider: TOGETHER_GATEWAY_PROVIDER, tier: "production", rationale: "Together-native Kimi K2.5 — strong reasoning on long docs" },
    ],
    economy: [
      { modelId: "gpt-4o-mini", provider: "openai", tier: "economy", rationale: "Starter preset / smoke tests only" },
    ],
  },
  {
    stage: "grouping",
    label: "Grouping",
    criteria: ["Reliable clustering JSON", "Moderate reasoning depth"],
    production: [
      { modelId: "claude-sonnet-4-6", provider: "anthropic", tier: "production", rationale: "Consistent group labels" },
      { modelId: "gpt-5.2", provider: "openai", tier: "production", rationale: "Fast grouping on medium corpora" },
      { modelId: "together-qwen3-5-397b", provider: TOGETHER_GATEWAY_PROVIDER, tier: "production", rationale: "Together Qwen 3.5 — reliable clustering JSON" },
    ],
    economy: [{ modelId: "gpt-4o-mini", provider: "openai", tier: "economy", rationale: "Demo runs" }],
  },
  {
    stage: "validation",
    label: "Validation",
    criteria: [
      "Different model family than extraction, relate, and grouping when possible",
      "Conservative instruction-following",
      "Low temperature",
    ],
    crossModelNote:
      "Route validation to a provider (and ideally model) not used on extraction, relate, or grouping. Requires a second provider key — otherwise we recommend the best available model on your only provider.",
    production: [
      { modelId: "gpt-5.2", provider: "openai", tier: "production", rationale: "Cross-check Anthropic extraction / grouping" },
      { modelId: "claude-sonnet-4-6", provider: "anthropic", tier: "production", rationale: "Cross-check OpenAI extraction / grouping" },
      { modelId: "gemini-3.1-pro", provider: "google", tier: "production", rationale: "Third-family validator" },
      { modelId: "together-gpt-oss-120b", provider: TOGETHER_GATEWAY_PROVIDER, tier: "production", rationale: "Together GPT-OSS 120B — cross-check when one Together key covers all stages" },
      { modelId: "together-deepseek-v3-1", provider: TOGETHER_GATEWAY_PROVIDER, tier: "production", rationale: "Together DeepSeek V3.1 — alternate validator on shared key" },
    ],
    economy: [{ modelId: "gpt-4o-mini", provider: "openai", tier: "economy", rationale: "Not recommended for production preset" }],
  },
  {
    stage: "remediation",
    label: "Remediation",
    criteria: ["Faithful rewrite without inventing facts", "JSON action output"],
    production: [
      { modelId: "claude-sonnet-4-6", provider: "anthropic", tier: "production", rationale: "Conservative repair/drop decisions" },
      { modelId: "gpt-5.2", provider: "openai", tier: "production", rationale: "Alternative repair chain" },
      { modelId: "together-qwen3-5-397b", provider: TOGETHER_GATEWAY_PROVIDER, tier: "production", rationale: "Together Qwen 3.5 — faithful JSON repair" },
    ],
    economy: [{ modelId: "gpt-4o-mini", provider: "openai", tier: "economy", rationale: "Starter only" }],
  },
  {
    stage: "embedding",
    label: "Embedding",
    criteria: [
      "Embedding model only — not chat",
      "Voyage preferred when connected",
      "Model must match pack / graph dimension length (often 1024d)",
    ],
    production: [
      { modelId: "voyage-3", provider: "voyage", tier: "embedding", rationale: "Default pack embedding @ 1024d" },
      { modelId: "voyage-3-large", provider: "voyage", tier: "embedding", rationale: "Higher quality retrieval" },
      { modelId: "text-embedding-3-large", provider: "openai", tier: "embedding", rationale: "OpenAI-only workspaces" },
      {
        modelId: TOGETHER_GATEWAY_EMBEDDING_MODEL_ID,
        provider: TOGETHER_GATEWAY_PROVIDER,
        tier: "embedding",
        rationale: "Together multilingual E5 @ 1024d — one key for chat + embed",
      },
    ],
    economy: [{ modelId: "voyage-3-lite", provider: "voyage", tier: "embedding", rationale: "Lower cost smoke tests" }],
  },
];

export type BuildProductionChainOptions = {
  /** Models already bound on extract / relate / grouping routes — validation avoids these. */
  upstream?: Pick<UpstreamValidationContext, "providers" | "modelIds"> | null;
  /** Target embedding dimensions from domain pack (before graph lock). */
  embeddingDimensions?: number;
  /** When graph already has vectors, embedding model/dims are locked. */
  embeddingLock?: WorkspaceEmbeddingLock | null;
};

export function guidanceForStage(stage: ConnectModelStage): StageModelGuidance | undefined {
  return INGEST_STAGE_MODEL_GUIDANCE.find((g) => g.stage === stage);
}

/** Filter recommendations to providers the workspace has integrations for (incl. Together gateway). */
export function filterRecommendationsByProviders(
  recs: IngestModelRecommendation[],
  providerTypes: Set<string>,
): IngestModelRecommendation[] {
  if (providerTypes.size === 0) return recs;
  const filtered = recs.filter((r) => isIngestProviderSatisfied(r, providerTypes));
  return filtered.length > 0 ? filtered : recs;
}

function pickValidationRecommendation(
  recs: IngestModelRecommendation[],
  upstream: Pick<UpstreamValidationContext, "providers" | "modelIds"> | null | undefined,
  providerTypes: Set<string>,
): IngestModelRecommendation | null {
  if (!recs.length) return null;

  const markFallback = (pick: IngestModelRecommendation, note: string): IngestModelRecommendation => ({
    ...pick,
    sameProviderFallback: true,
    rationale: `${pick.rationale} (${note})`,
  });

  if (upstream && upstream.providers.size > 0) {
    const differentProvider = recs.filter((r) => !upstream.providers.has(r.provider));
    if (differentProvider.length > 0) {
      const differentModel = differentProvider.filter((r) => !upstream.modelIds.has(r.modelId));
      return differentModel[0] ?? differentProvider[0] ?? null;
    }

    const differentModelOnly = recs.filter((r) => !upstream.modelIds.has(r.modelId));
    if (differentModelOnly.length > 0) {
      return markFallback(
        differentModelOnly[0]!,
        "same provider as upstream — add a second provider key for true cross-model validation",
      );
    }

    return markFallback(
      recs[0]!,
      "only one provider connected — cross-model validation unavailable",
    );
  }

  if (providerTypes.size <= 1) {
    return markFallback(recs[0]!, "connect a second provider key to cross-check extraction and grouping");
  }

  return recs[0] ?? null;
}

export function buildProductionRouteChain(
  providerTypes: Set<string>,
  options?: BuildProductionChainOptions,
): Partial<Record<ConnectModelStage, string>> {
  const chain = buildCrossModelProductionChain(providerTypes, options);
  const out: Partial<Record<ConnectModelStage, string>> = {};
  for (const [stage, rec] of Object.entries(chain)) {
    if (rec) out[stage as ConnectModelStage] = rec.modelId;
  }
  return out;
}

export type StageRecommendation = IngestModelRecommendation & { stage: ConnectModelStage };

/**
 * Pick production models per stage.
 * Validation avoids providers/models used on extraction, relate, and grouping when another key exists.
 * Embedding prefers Voyage and respects graph dimension lock.
 */
export function buildCrossModelProductionChain(
  providerTypes: Set<string>,
  options?: BuildProductionChainOptions,
): Partial<Record<ConnectModelStage, IngestModelRecommendation>> {
  const out: Partial<Record<ConnectModelStage, IngestModelRecommendation>> = {};
  const targetDimensions =
    options?.embeddingLock?.dimensions ?? options?.embeddingDimensions ?? 1024;

  for (const g of INGEST_STAGE_MODEL_GUIDANCE) {
    if (g.stage === "embedding") {
      const picked = pickEmbeddingModelForDimensions({
        providerTypes,
        dimensions: targetDimensions,
        locked: options?.embeddingLock ?? null,
      });
      if (picked) {
        const resolved = resolveIngestRecommendationProvider(
          {
            modelId: picked.modelId,
            provider: picked.provider,
            tier: "embedding",
            rationale: picked.rationale,
          },
          providerTypes,
        );
        out.embedding = resolved ?? {
          modelId: picked.modelId,
          provider: picked.provider,
          tier: "embedding",
          rationale: picked.rationale,
        };
      }
      continue;
    }

    let recs = filterRecommendationsByProviders(g.production, providerTypes);

    if (g.stage === "validation") {
      const pick = pickValidationRecommendation(recs, options?.upstream, providerTypes);
      if (pick) {
        out.validation = resolveIngestRecommendationProvider(pick, providerTypes) ?? pick;
      }
      continue;
    }

    const pick = recs[0];
    if (pick) {
      out[g.stage] = resolveIngestRecommendationProvider(pick, providerTypes) ?? pick;
    }
  }

  return out;
}

export function recommendationForStage(
  stage: ConnectModelStage,
  providerTypes: Set<string>,
  chain?: Partial<Record<ConnectModelStage, IngestModelRecommendation>>,
): IngestModelRecommendation | null {
  const resolved = chain ?? buildCrossModelProductionChain(providerTypes);
  return resolved[stage] ?? null;
}
