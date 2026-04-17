/**
 * AiZolo `model` parameter values (vendor strings). Kept in one place for allowlist + catalog seed alignment.
 * Update when AiZolo expands their router; re-run dashboard seed after changing the JSON catalog.
 */
export const AIZOLO_VENDOR_MODEL_IDS = [
  // OpenAI (ChatGPT)
  "openai",
  "openai/gpt-5.4",
  "openai/gpt-5.4-mini",
  "openai/gpt-5.4-nano",
  "openai/gpt-5.2",
  "openai/gpt-5.1",
  "openai/gpt-5",
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
  "openai/o3",
  "openai/o4-mini",
  "openai/gpt-4.1",
  "openai/gpt-4.1-mini",
  "openai/gpt-4.1-nano",
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  // Gemini
  "gemini",
  "gemini/gemini-3.1-flash-lite-preview",
  "gemini/gemini-3.1-pro-preview",
  "gemini/gemini-3-flash-preview",
  "gemini/gemini-2.5-flash-lite",
  "gemini/gemini-2.5-flash",
  "gemini/gemini-2.5-pro",
  // DeepSeek
  "deepseek",
  "deepseek/deepseek-chat",
  "deepseek/deepseek-reasoner",
  // Grok
  "grok",
  "grok/grok-4-1-fast-non-reasoning",
  "grok/grok-4-1-fast-reasoning",
  "grok/grok-4-fast-non-reasoning",
  "grok/grok-4-fast-reasoning",
  "grok/grok-3-mini",
  // Claude
  "claude",
  "claude/claude-sonnet-4-6",
  "claude/claude-sonnet-4-5-20250929",
  "claude/claude-sonnet-4-20250514",
  "claude/claude-opus-4-7",
  "claude/claude-opus-4-6",
  "claude/claude-opus-4-5-20251101",
  "claude/claude-haiku-4-5-20251001",
  "claude/claude-3-5-haiku-20241022",
  "claude/claude-3-haiku-20240307",
  // Perplexity
  "perplexity",
  "perplexity/sonar",
  "perplexity/sonar-reasoning-pro",
  "perplexity/sonar-deep-research",
  // Meta / Microsoft / Qwen / Mistral / Nvidia / Z.ai / Hunyuan / Longcat (provider roots)
  "meta",
  "microsoft",
  "qwen",
  "mistral",
  "nvidia",
  "zai",
  "hunyuan",
  "longcat",
  // Kimi
  "kimi",
  "kimi/kimi-k2.5",
  "kimi/kimi-k2-0905-preview",
  "kimi/kimi-k2-0711-preview",
  "kimi/kimi-k2-thinking",
  "kimi/kimi-k2-turbo-preview",
  "kimi/kimi-k2-thinking-turbo",
  // MiMo
  "mimo",
  "mimo/mimo-v2-flash",
] as const;

/** Stable catalog `models.id` for dashboard routes (no slashes). */
export function aizoloCatalogModelId(vendorModelId: string): string {
  return `aizolo-${vendorModelId.replace(/\//g, "-")}`;
}
