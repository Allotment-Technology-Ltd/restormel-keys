/**
 * Derived per-(model, stage) suitability (advisory plan §3.2 / §3.3 / §3.6).
 *
 * Replaces the hand-curated INGEST_STAGE_MODEL_GUIDANCE pick list as the SOURCE of advice:
 * the verdict is derived from catalogue capabilities, so it renders for ANY model (not just
 * ~20 curated ones), with an honest `unknown` for models we haven't seeded. Provider-neutral —
 * no provider is ever ranked above another by identity (§3.8).
 *
 *   wrong_type  → hard block (embedding stage needs an embedding model, and vice-versa)
 *   recommended → tagged for the stage and meets its soft requirements
 *   usable      → text-generation capable, no disqualifier
 *   caveat      → chat-capable but a soft requirement is missing (warn, never block)
 *   unknown     → free-text model not yet enriched
 */
import type { CatalogueModel, ConnectModelStage, StageSuitability } from "./types";
import { resolveUnderlyingFamily } from "./underlying-family";

const STAGE_CAPABILITY: Record<ConnectModelStage, string> = {
  extraction: "ingestion_extraction",
  grouping: "ingestion_grouping",
  validation: "ingestion_validation",
  remediation: "ingestion_remediation",
  embedding: "ingestion_embedding",
};

/** Capabilities that mean "can generate text" (a chat stage can use it). */
const CHAT_CAPABILITIES = new Set([
  "chat",
  "tools",
  "ingestion_extraction",
  "ingestion_grouping",
  "ingestion_validation",
  "ingestion_remediation",
]);
const EMBEDDING_CAPABILITIES = new Set(["embedding", "ingestion_embedding"]);

function capSet(model: CatalogueModel): Set<string> {
  return new Set((model.capabilities ?? []).map((c) => c.trim().toLowerCase()));
}

function hasAny(set: Set<string>, candidates: Set<string>): boolean {
  for (const c of candidates) if (set.has(c)) return true;
  return false;
}

export function isEmbeddingCapable(model: CatalogueModel): boolean {
  return hasAny(capSet(model), EMBEDDING_CAPABILITIES);
}
export function isChatCapable(model: CatalogueModel): boolean {
  return hasAny(capSet(model), CHAT_CAPABILITIES);
}
/** Embedding-only = embeddings AND no text-generation capability (one side of the hard guard). */
export function isEmbeddingOnly(model: CatalogueModel): boolean {
  return isEmbeddingCapable(model) && !isChatCapable(model);
}

export interface SuitabilityContext {
  /**
   * Underlying families already bound on extraction/grouping/remediation. Validation that shares
   * one of these is a `caveat` (not a true cross-model check). §3.6
   */
  upstreamFamilies?: Set<string>;
  /** Provider the binding will use — needed to resolve aggregator underlying family. */
  provider?: string | null;
  /** A variant's upstream `provider/model` id, when known (OpenRouter etc.). */
  providerModelId?: string | null;
}

/** Derive the suitability verdict. `null`/missing model → `unknown` (free-text path). */
export function deriveSuitability(
  model: CatalogueModel | null | undefined,
  stage: ConnectModelStage,
  ctx: SuitabilityContext = {},
): StageSuitability {
  if (!model) {
    return {
      verdict: "unknown",
      rationale: "Not in the catalogue — suitability and cost are unknown.",
      blocked: false,
    };
  }

  const caps = capSet(model);

  // ── Embedding stage: hard-require an embedding model. ──
  if (stage === "embedding") {
    if (!isEmbeddingCapable(model)) {
      return {
        verdict: "wrong_type",
        rationale: "Not an embedding model — the embedding stage requires one.",
        blocked: true,
      };
    }
    return caps.has("ingestion_embedding")
      ? { verdict: "recommended", rationale: "Embedding model suited to ingestion.", blocked: false }
      : { verdict: "usable", rationale: "Embedding-capable model.", blocked: false };
  }

  // ── Chat stages: hard-block embedding-only models (the other direction). ──
  if (isEmbeddingOnly(model)) {
    return {
      verdict: "wrong_type",
      rationale: "Embedding-only model can't run a text-generation stage.",
      blocked: true,
    };
  }

  // Soft requirements (advisory → caveat, never blocked).
  if ((stage === "extraction" || stage === "remediation") && model.supportsStructuredOutput === false) {
    return {
      verdict: "caveat",
      rationale: "No structured-output support — JSON output may be unreliable.",
      blocked: false,
    };
  }
  if (stage === "validation" && ctx.upstreamFamilies && ctx.upstreamFamilies.size > 0) {
    const fam = resolveUnderlyingFamily(model.id, {
      provider: ctx.provider,
      family: model.family,
      providerModelId: ctx.providerModelId,
    });
    if (fam && ctx.upstreamFamilies.has(fam)) {
      return {
        verdict: "caveat",
        rationale: `Same model family (${fam}) as an upstream stage — not a true cross-model check.`,
        blocked: false,
      };
    }
  }

  if (caps.has(STAGE_CAPABILITY[stage])) {
    return { verdict: "recommended", rationale: `Tagged for ${stage}.`, blocked: false };
  }
  return {
    verdict: "usable",
    rationale: "Text-generation capable; no stage-specific signal.",
    blocked: false,
  };
}

/** Sort key for neutral ranking: recommended → usable → caveat → unknown → wrong_type. Never by provider. §3.8 */
export const VERDICT_RANK: Record<StageSuitability["verdict"], number> = {
  recommended: 0,
  usable: 1,
  caveat: 2,
  unknown: 3,
  wrong_type: 4,
};
