/**
 * Phase 3 Stage 4 — client-safe model FAMILY normaliser for the console's
 * cross-model disclosure ("validated by Anthropic vs OpenAI — cross-family ✓").
 *
 * This is the CLIENT-safe subset of the authoritative server resolver
 * (`$lib/server/catalogue/underlying-family.ts`). The server resolver imports
 * gateway/aggregator tables (Together/Aizolo/OpenRouter) to unmask an aggregator
 * key down to its true vendor — that logic stays server-only. The console only
 * needs to turn a concrete provider token (e.g. "anthropic", "openai") into a
 * canonical family LABEL so it can say, truthfully, whether two stages used
 * different families. It NEVER invents a family: an unknown token resolves to a
 * lower-cased pass-through, and `crossFamily` is only asserted when BOTH sides
 * resolve to a known, DIFFERENT family — so no cross-family ✓ is ever unearned.
 *
 * Shared (no server imports) so components import it directly. The alias map is a
 * subset of the server's FAMILY_ALIASES kept in sync by `model-family.test.ts`.
 */

/** Canonical family per raw provider/vendor token. Subset of the server map. */
const FAMILY_ALIASES: Record<string, string> = {
  anthropic: "anthropic",
  claude: "anthropic",
  openai: "openai",
  gpt: "openai",
  google: "google",
  gemini: "google",
  gemma: "google",
  vertex: "google",
  deepseek: "deepseek",
  "deepseek-ai": "deepseek",
  qwen: "qwen",
  meta: "meta",
  "meta-llama": "meta",
  llama: "meta",
  mistral: "mistral",
  mistralai: "mistral",
  mixtral: "mistral",
  cohere: "cohere",
  grok: "xai",
  xai: "xai",
  moonshot: "moonshot",
  moonshotai: "moonshot",
  kimi: "moonshot",
  zai: "zai",
  "zai-org": "zai",
  glm: "zai",
  voyage: "voyage",
};

/** Human-readable display label per canonical family (Title Case where it matters). */
const FAMILY_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  deepseek: "DeepSeek",
  qwen: "Qwen",
  meta: "Meta",
  mistral: "Mistral",
  cohere: "Cohere",
  xai: "xAI",
  moonshot: "Moonshot",
  zai: "Z.ai",
  voyage: "Voyage",
};

/**
 * Normalise a provider token to a canonical family key, or null when the token is
 * empty. An unknown-but-present token passes through lower-cased (so two unknown
 * providers can still be compared by string), but it is treated as "not a known
 * family" by {@link deriveCrossModel} unless it is in the alias map.
 */
export function normaliseModelFamily(token: string | null | undefined): string | null {
  if (!token) return null;
  const t = token.trim().toLowerCase();
  if (!t) return null;
  return FAMILY_ALIASES[t] ?? t;
}

/** A presentable label for a family key (falls back to the key itself, upper-cased). */
export function familyLabel(family: string | null | undefined): string | null {
  if (!family) return null;
  const f = family.trim().toLowerCase();
  if (!f) return null;
  return FAMILY_LABELS[f] ?? f.toUpperCase();
}

/** True when a token resolves to a family we actually know (in the alias map). */
export function isKnownFamily(token: string | null | undefined): boolean {
  if (!token) return false;
  const t = token.trim().toLowerCase();
  return t in FAMILY_ALIASES;
}

export type CrossModelDisclosure = {
  /** The family that produced the answer (chat/answer route), or null when unknown. */
  answerFamily: string | null;
  /** The family that validated the graph's claims (validation route), or null. */
  validationFamily: string | null;
  answerLabel: string | null;
  validationLabel: string | null;
  /**
   * The TRI-STATE cross-model verdict — only "cross_family" is a positive claim:
   *  - "cross_family"  → both sides are KNOWN families and they DIFFER (the differentiator).
   *  - "same_family"   → both sides are known families and they MATCH (honest single-family).
   *  - "unverifiable"  → at least one side is missing/unknown — we do NOT assert either way.
   */
  verdict: "cross_family" | "same_family" | "unverifiable";
};

/**
 * Derive the cross-model disclosure from the two provider tokens. Claims-integrity:
 * the only positive ("cross_family ✓") claim requires BOTH families to be known AND
 * different. Anything we can't confirm is "unverifiable" — never a fabricated tick.
 */
export function deriveCrossModel(
  answerProvider: string | null | undefined,
  validationProvider: string | null | undefined,
): CrossModelDisclosure {
  const answerFamily = normaliseModelFamily(answerProvider);
  const validationFamily = normaliseModelFamily(validationProvider);
  const bothKnown = isKnownFamily(answerProvider) && isKnownFamily(validationProvider);

  let verdict: CrossModelDisclosure["verdict"] = "unverifiable";
  if (bothKnown && answerFamily && validationFamily) {
    verdict = answerFamily === validationFamily ? "same_family" : "cross_family";
  }

  return {
    answerFamily,
    validationFamily,
    answerLabel: familyLabel(answerFamily),
    validationLabel: familyLabel(validationFamily),
    verdict,
  };
}
