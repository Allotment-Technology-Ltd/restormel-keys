/**
 * Catalogue discovery — source abstraction (advisory plan §3.9).
 *
 * One provider-agnostic adapter per source. Adding a provider = adding a CatalogueSource, never
 * special-casing. Used by the SCHEDULED refresh pipeline (not at request time). Network lives in
 * the adapter's fetchModels(); parsing is pure so it's offline-testable with fixtures.
 */

/** A model as discovered from a source, before enrichment into the catalogue. */
export interface DiscoveredModel {
  providerType: string;
  /** Provider-native id, e.g. "anthropic/claude-sonnet-4" from OpenRouter. */
  providerModelId: string;
  displayName?: string | null;
  contextWindow?: number | null;
  /** $/1M when the source exposes pricing (else null → "cost unknown", never $0). */
  inputPerMillion?: number | null;
  outputPerMillion?: number | null;
  capabilities?: string[] | null;
  /** Underlying vendor family hint if the source exposes it. */
  family?: string | null;
}

export interface CatalogueSource {
  readonly providerType: string;
  /** Fetch the current model list. Implementations do the network call; tests inject fixtures. */
  fetchModels(): Promise<DiscoveredModel[]>;
}
