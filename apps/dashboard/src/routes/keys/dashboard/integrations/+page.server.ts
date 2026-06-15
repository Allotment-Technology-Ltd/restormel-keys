import type { PageServerLoad } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import { listProviderIntegrations } from "$lib/server/db";
import { loadSeedModels } from "$lib/server/catalogue";

export type ProviderSuggestion = { value: string; label: string };

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  vertex: "Google (Vertex AI)",
  mistral: "Mistral",
  together: "Together AI",
  voyage: "Voyage AI",
  cohere: "Cohere",
  groq: "Groq",
  deepseek: "DeepSeek",
  xai: "xAI",
  aizolo: "AiZolo",
};

function labelForProvider(value: string): string {
  return (
    PROVIDER_LABELS[value] ??
    value.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/**
 * Provider suggestions are DERIVED FROM THE MODEL CATALOGUE — the distinct
 * `providerIntegrationType`s that actually have models — not a hand-curated marketing
 * subset. This keeps connection selection provider-neutral and consistent with the
 * advisory catalogue (every provider with models is offered equally; the field is still
 * free-text, so anything not listed can be typed). Gateways (vercel/openrouter/portkey)
 * are not model providers, so they don't appear here.
 */
let _providerSuggestions: ProviderSuggestion[] | null = null;
function catalogueProviderSuggestions(): ProviderSuggestion[] {
  if (_providerSuggestions) return _providerSuggestions;
  try {
    const seen = new Set<string>();
    for (const model of loadSeedModels()) {
      for (const variant of model.variants ?? []) {
        const p = (variant.providerIntegrationType ?? "").trim();
        if (p) seen.add(p);
      }
    }
    _providerSuggestions = [...seen]
      .sort()
      .map((value) => ({ value, label: labelForProvider(value) }));
  } catch (e) {
    console.error("[integrations] provider suggestions failed:", e);
    _providerSuggestions = [];
  }
  return _providerSuggestions;
}

/** Safe shape for client: no credentialRef. */
export type IntegrationSummary = {
  id: string;
  workspaceId: string;
  providerType: string;
  displayName: string | null;
  status: string;
  verificationStatus: string | null;
  hasCredential: boolean;
  /** Vault-reference connection: Restormel holds no key, so it cannot verify or execute it. */
  referenceOnly: boolean;
  credentialMasked: string | null;
  createdAt: number;
  lastVerifiedAt: number | null;
};

export const load: PageServerLoad = async ({ locals }) => {
  const providerSuggestions = catalogueProviderSuggestions();
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) {
    return {
      integrations: [] as IntegrationSummary[],
      providerSuggestions,
      error: null as string | null,
    };
  }
  try {
    const list = await listProviderIntegrations(ctx.workspaceId);
    const integrations: IntegrationSummary[] = list.map((r) => ({
      id: r.id,
      workspaceId: r.workspaceId,
      providerType: r.providerType,
      displayName: r.displayName ?? null,
      status: r.status,
      verificationStatus: r.verificationStatus ?? null,
      hasCredential: Boolean(r.credentialRef || r.hasEncryptedCredential),
      referenceOnly: Boolean(r.credentialRef && !r.hasEncryptedCredential),
      credentialMasked: r.credentialMasked ?? null,
      createdAt: r.createdAt,
      lastVerifiedAt: r.lastVerifiedAt ?? null,
    }));
    return { integrations, providerSuggestions, error: null };
  } catch (e) {
    console.error("[integrations] load failed:", e);
    return {
      integrations: [] as IntegrationSummary[],
      providerSuggestions,
      error: "Unable to load integrations",
    };
  }
};
