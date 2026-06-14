/**
 * Resolve the TRUE model family behind a catalogue id (advisory plan §3.6).
 *
 * Aggregators (Together, Aizolo, OpenRouter) front many vendors through one key. Cross-model
 * validation (judge family ≠ extractor family) must compare the UNDERLYING family, never the
 * aggregator provider name — otherwise a single aggregator key looks like "same provider" and
 * the cross-model guarantee becomes illusory.
 */
import { TOGETHER_GATEWAY_CHAT_MODELS } from "../connect/together-ingest-gateway";

/** Canonical family per raw vendor/provider token. */
const FAMILY_ALIASES: Record<string, string> = {
  anthropic: "anthropic",
  claude: "anthropic",
  openai: "openai",
  gpt: "openai",
  google: "google",
  gemini: "google",
  gemma: "google",
  gemma2: "google",
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
  microsoft: "microsoft",
  e5: "microsoft",
  nvidia: "nvidia",
  perplexity: "perplexity",
  hunyuan: "hunyuan",
  longcat: "longcat",
  mimo: "mimo",
};

/**
 * Inference hosts / aggregators front OTHER vendors — never a family on their own. A model whose
 * `family` or `provider` is one of these (e.g. Groq-hosted Llama with family "groq") must resolve
 * via the model id instead, so Groq-Llama (meta) ≠ Groq-Gemma (google) for cross-model checks.
 */
const INFERENCE_HOSTS = new Set(["together", "aizolo", "openrouter", "groq", "fireworks"]);

export function normaliseFamily(token: string | null | undefined): string | null {
  if (!token) return null;
  const t = token.trim().toLowerCase();
  if (!t) return null;
  return FAMILY_ALIASES[t] ?? t;
}

/** Normalise to a canonical family, treating inference hosts as "not a vendor" (null). */
function canonicalFamily(token: string | null | undefined): string | null {
  const n = normaliseFamily(token);
  if (!n || INFERENCE_HOSTS.has(n)) return null;
  return n;
}

/** Aizolo catalogue ids encode the vendor: `aizolo-{vendor}-{rest}` → vendor. */
function aizoloVendor(modelId: string): string | null {
  const m = modelId.trim().toLowerCase();
  if (!m.startsWith("aizolo-")) return null;
  const vendor = m.slice("aizolo-".length).split("-")[0];
  return vendor || null;
}

export interface UnderlyingFamilyOpts {
  provider?: string | null;
  family?: string | null;
  /** A variant's upstream `provider/model` string (e.g. OpenRouter `anthropic/claude-...`). */
  providerModelId?: string | null;
}

/**
 * Best-effort underlying family for a catalogue id. Returns null only when nothing is resolvable
 * (genuinely unknown — callers treat that as "can't confirm cross-model").
 */
export function resolveUnderlyingFamily(
  modelId: string,
  opts: UnderlyingFamilyOpts = {},
): string | null {
  const id = modelId.trim();

  // 1. Aizolo — vendor is in the id.
  const az = aizoloVendor(id);
  if (az) return normaliseFamily(az);

  // 2. Together gateway — upstream `provider/model` string.
  const togetherUpstream = TOGETHER_GATEWAY_CHAT_MODELS[id];
  if (togetherUpstream) return normaliseFamily(togetherUpstream.split("/")[0]);

  // 3. A `provider/model` providerModelId (OpenRouter and similar) — prefix is the vendor.
  const pmid = (opts.providerModelId ?? "").trim();
  if (pmid.includes("/")) return normaliseFamily(pmid.split("/")[0]);

  // 4. Explicit family on the model row — but only if it's a real vendor (not an inference host).
  const fromFamily = canonicalFamily(opts.family ?? null);
  if (fromFamily) return fromFamily;

  // 5. A direct (non-host) provider IS the family.
  const fromProvider = canonicalFamily(opts.provider ?? null);
  if (fromProvider) return fromProvider;

  // 6. Last resort: the id's own leading token (resolves Groq-hosted `llama-*` → meta etc.).
  return normaliseFamily(id.split(/[-/]/)[0]);
}
