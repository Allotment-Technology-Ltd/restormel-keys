/**
 * OpenRouter discovery adapter (advisory plan §3.9).
 *
 * OpenRouter's /models is a high-leverage breadth source — hundreds of models across providers,
 * WITH pricing, in one call. The parser is pure (inject the payload); OpenRouterSource does the
 * scheduled HTTP fetch. Prices are $/token → ×1e6 for $/1M.
 */
import type { CatalogueSource, DiscoveredModel } from "./types";

export interface OpenRouterModel {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  architecture?: { modality?: string };
}
export interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

function perMillionFromPerToken(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null; // 0 / free → "cost unknown", never $0
  return n * 1_000_000;
}

/** Parse an OpenRouter /models payload into DiscoveredModel[] (pure — no network). */
export function parseOpenRouterModels(payload: OpenRouterModelsResponse): DiscoveredModel[] {
  return (payload.data ?? []).map((m) => ({
    providerType: "openrouter",
    providerModelId: m.id,
    displayName: m.name ?? m.id,
    contextWindow: m.context_length ?? null,
    inputPerMillion: perMillionFromPerToken(m.pricing?.prompt),
    outputPerMillion: perMillionFromPerToken(m.pricing?.completion),
    // OpenRouter ids are `vendor/model` — the prefix is the underlying family.
    family: m.id.includes("/") ? m.id.split("/")[0] : null,
  }));
}

export class OpenRouterSource implements CatalogueSource {
  readonly providerType = "openrouter";
  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly baseUrl = "https://openrouter.ai/api/v1",
  ) {}

  async fetchModels(): Promise<DiscoveredModel[]> {
    const res = await this.fetchImpl(`${this.baseUrl}/models`);
    if (!res.ok) throw new Error(`OpenRouter /models HTTP ${res.status}`);
    return parseOpenRouterModels((await res.json()) as OpenRouterModelsResponse);
  }
}
