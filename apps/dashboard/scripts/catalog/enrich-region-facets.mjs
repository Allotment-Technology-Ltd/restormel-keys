/**
 * Enrich model-catalog-seed.json with jurisdiction/region facets (advisory plan §3.8).
 *
 * Adds two new fields:
 *   - `homeJurisdiction` (per model)  — the underlying vendor's legal home jurisdiction.
 *   - `processingRegion`  (per variant) — where inference actually runs.
 *
 * Re-runnable: reads the seed, applies the maps, writes back with stable key ordering and
 * 2-space indent. Safe to run multiple times — enriched entries are simply overwritten with
 * the same computed value.
 *
 * Run from repo root:
 *   node apps/dashboard/scripts/catalog/enrich-region-facets.mjs
 * or from apps/dashboard:
 *   node scripts/catalog/enrich-region-facets.mjs
 *
 * DATA GAPS (see report):
 *   processingRegion for `aizolo` variants is set to null — Aizolo's processing region is
 *   UNVERIFIED. Do not guess. The §3.8 region filter must treat null as "unknown" and warn
 *   the user rather than excluding or misclassifying Aizolo routes.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve seed path relative to this script (works from any cwd).
const SEED_PATH = resolve(__dirname, "../../data/model-catalog-seed.json");

// ---------------------------------------------------------------------------
// CANONICAL MAPS — single authoritative source; keep in sync with advisory plan §3.8.
// ---------------------------------------------------------------------------

/**
 * Underlying model family → vendor's legal home jurisdiction.
 * Values use ISO-3166-alpha-2 country codes (or regional designators like EU/FR).
 * Families not in this map resolve to null (homeJurisdiction = null).
 */
const FAMILY_TO_HOME_JURISDICTION = {
  anthropic: "US",
  openai: "US",
  google: "US",
  meta: "US",
  microsoft: "US",
  nvidia: "US",
  xai: "US",
  perplexity: "US",
  voyage: "US",
  mistral: "EU/FR",
  cohere: "CA",
  deepseek: "CN",
  qwen: "CN",
  moonshot: "CN",
  zai: "CN",
  hunyuan: "CN",
  longcat: "CN",
  mimo: "CN",
};

/**
 * providerIntegrationType → processingRegion.
 * `aizolo` is null — processing region UNVERIFIED (see file header / report).
 */
const PROVIDER_TYPE_TO_PROCESSING_REGION = {
  openai: "US",
  anthropic: "US",
  google: "US",
  voyage: "US",
  groq: "US",
  together: "US", // aggregator; inference runs in Together's US data centre
  mistral: "EU",
  deepseek: "CN",
  cohere: "CA",
  aizolo: null, // UNVERIFIED — do not set a region until confirmed
};

// ---------------------------------------------------------------------------
// Family-alias normalisation (mirrors underlying-family.ts — duplicated here
// so the script has zero TS/SvelteKit dependencies and stays fully offline).
// ---------------------------------------------------------------------------

const FAMILY_ALIASES = {
  anthropic: "anthropic",
  claude: "anthropic",
  openai: "openai",
  gpt: "openai",
  "gpt-4": "openai",
  "gpt-5": "openai",
  "gpt-oss": "openai",
  "o1": "openai",
  "o3": "openai",
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
  e5: "microsoft", // intfloat/e5 embeddings originate from Microsoft Research
  nvidia: "nvidia",
  perplexity: "perplexity",
  hunyuan: "hunyuan",
  longcat: "longcat",
  mimo: "mimo",
  // Groq is an inference provider, not a model vendor — resolve by the model's upstream family.
  // Voyage is an embedding vendor.
  voyage: "voyage",
};

// Together gateway chat models (mirrors TOGETHER_GATEWAY_CHAT_MODELS in TS; keep in sync).
const TOGETHER_GATEWAY_CHAT_MODELS = {
  "claude-sonnet-4-6": "anthropic/claude-sonnet-4-6",
  "claude-sonnet-4-5": "anthropic/claude-sonnet-4-5",
  "claude-haiku-4-5": "anthropic/claude-haiku-4-5",
  "claude-opus-4-6": "anthropic/claude-opus-4-6",
  "gpt-5.2": "openai/gpt-5.4",
  "gpt-5.1": "openai/gpt-5.4",
  "gpt-4o": "openai/gpt-4o",
  "gpt-4o-mini": "openai/gpt-4o-mini",
  "gemini-3.1-pro": "google/gemini-3.1-pro-preview",
  "gemini-2.5-pro": "google/gemini-2.5-pro",
  "gemini-2.5-flash": "google/gemini-2.5-flash",
  "together-qwen3-5-397b": "Qwen/Qwen3.5-397B-A17B",
  "together-qwen3-5-9b": "Qwen/Qwen3.5-9B",
  "together-kimi-k2-5": "moonshotai/Kimi-K2.5",
  "together-deepseek-v3-1": "deepseek-ai/DeepSeek-V3.1",
  "together-deepseek-v3": "deepseek-ai/DeepSeek-V3",
  "together-llama-3-3-70b-instruct-turbo": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  "together-gpt-oss-120b": "openai/gpt-oss-120b",
  "together-gpt-oss-20b": "openai/gpt-oss-20b",
  "together-glm-5-1": "zai-org/GLM-5.1",
};

/** Inference hosts are NOT model vendors — a seed `family` of these must resolve via the model id. */
const INFERENCE_HOSTS = new Set(["groq", "together", "openrouter", "aizolo", "fireworks"]);

function normaliseToken(token) {
  if (!token) return null;
  const t = token.trim().toLowerCase();
  return FAMILY_ALIASES[t] ?? t;
}

/** Normalise to a canonical family, treating inference hosts as "not a vendor" (null). */
function canonicalFamily(token) {
  const n = normaliseToken(token);
  if (!n || INFERENCE_HOSTS.has(n)) return null;
  return n;
}

function aizoloVendor(modelId) {
  const m = modelId.trim().toLowerCase();
  if (!m.startsWith("aizolo-")) return null;
  const vendor = m.slice("aizolo-".length).split("-")[0];
  return vendor || null;
}

/**
 * Resolve underlying family for a model — same logic as resolveUnderlyingFamily() in TS.
 * Returns a canonical family string or null.
 */
function resolveFamily(modelId, { family, providerIntegrationTypes = [] }) {
  void providerIntegrationTypes;
  const id = modelId.trim();

  // 1. Aizolo — vendor encoded in id.
  const az = aizoloVendor(id);
  if (az) return canonicalFamily(az);

  // 2. Together gateway — upstream `provider/model` string.
  const togetherUpstream = TOGETHER_GATEWAY_CHAT_MODELS[id];
  if (togetherUpstream) return canonicalFamily(togetherUpstream.split("/")[0]);

  // 3. Explicit family, if it's a real vendor that maps to a jurisdiction.
  const fromFamily = canonicalFamily(family ?? null);
  if (fromFamily && FAMILY_TO_HOME_JURISDICTION[fromFamily]) return fromFamily;

  // 4. Inference-host families (e.g. groq) and generation-suffixed families fall through to the
  //    model id's leading token — e.g. groq-hosted `mixtral-8x7b` → mistral, `llama-*` → meta.
  const fromId = canonicalFamily(id.split(/[-/]/)[0]);
  if (fromId && FAMILY_TO_HOME_JURISDICTION[fromId]) return fromId;

  // 5. Last resort: any resolvable family token (records a family even without a jurisdiction).
  return fromFamily ?? fromId ?? null;
}

function homeJurisdictionForFamily(resolvedFamily) {
  if (!resolvedFamily) return null;
  return FAMILY_TO_HOME_JURISDICTION[resolvedFamily] ?? null;
}

// ---------------------------------------------------------------------------
// Stable key ordering for JSON output
// ---------------------------------------------------------------------------

const MODEL_KEY_ORDER = [
  "id", "canonicalName", "family", "lifecycleState", "description",
  "contextWindow", "maxOutputTokens", "supportsTools", "supportsStructuredOutput", "supportsMcp",
  "modalities", "capabilities", "editorialSummary",
  "homeJurisdiction",
  "deprecationDate", "retirementDate", "replacementModelId", "sourceLastVerifiedAt",
  "variants",
];

const VARIANT_KEY_ORDER = [
  "providerIntegrationType", "providerModelId", "availabilityStatus",
  "processingRegion",
  "pricingRef", "rateLimitRef", "sourceLastVerifiedAt",
];

function orderedObject(obj, keyOrder) {
  const result = {};
  for (const k of keyOrder) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      result[k] = obj[k];
    }
  }
  // Append any keys not in the order list (future-proofing).
  for (const k of Object.keys(obj)) {
    if (!Object.prototype.hasOwnProperty.call(result, k)) {
      result[k] = obj[k];
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const raw = readFileSync(SEED_PATH, "utf-8");
const seed = JSON.parse(raw);

const models = seed.models;
if (!Array.isArray(models)) {
  console.error("ERROR: seed.models is not an array");
  process.exit(1);
}

let modelsEnriched = 0;
let variantsEnriched = 0;
let homeJurisdictionNullCount = 0;
let processingRegionNullCount = 0;
const nullHomeModels = [];
const nullRegionVariants = [];

const enrichedModels = models.map((m) => {
  const providerIntegrationTypes = (m.variants ?? []).map((v) => v.providerIntegrationType);
  const resolvedFamily = resolveFamily(m.id, {
    family: m.family,
    providerIntegrationTypes,
  });
  const homeJurisdiction = homeJurisdictionForFamily(resolvedFamily);

  if (homeJurisdiction === null) {
    homeJurisdictionNullCount++;
    nullHomeModels.push({ id: m.id, family: m.family, resolvedFamily });
  }

  const enrichedVariants = (m.variants ?? []).map((v) => {
    const processingRegion =
      v.providerIntegrationType in PROVIDER_TYPE_TO_PROCESSING_REGION
        ? PROVIDER_TYPE_TO_PROCESSING_REGION[v.providerIntegrationType]
        : null;

    if (processingRegion === null) {
      processingRegionNullCount++;
      nullRegionVariants.push({
        modelId: m.id,
        providerIntegrationType: v.providerIntegrationType,
        reason:
          v.providerIntegrationType === "aizolo"
            ? "UNVERIFIED — Aizolo processing region not publicly documented"
            : `No entry in PROVIDER_TYPE_TO_PROCESSING_REGION for '${v.providerIntegrationType}'`,
      });
    }

    variantsEnriched++;
    return orderedObject({ ...v, processingRegion }, VARIANT_KEY_ORDER);
  });

  modelsEnriched++;
  return orderedObject(
    { ...m, homeJurisdiction, variants: enrichedVariants },
    MODEL_KEY_ORDER,
  );
});

const enrichedSeed = { ...seed, models: enrichedModels };

// Update lastUpdated to today.
enrichedSeed.lastUpdated = new Date().toISOString().slice(0, 10);

writeFileSync(SEED_PATH, JSON.stringify(enrichedSeed, null, 2) + "\n", "utf-8");

console.log(`\nenrich-region-facets: complete`);
console.log(`  models enriched:        ${modelsEnriched}`);
console.log(`  variants enriched:      ${variantsEnriched}`);
console.log(`  homeJurisdiction=null:  ${homeJurisdictionNullCount}`);
console.log(`  processingRegion=null:  ${processingRegionNullCount}`);

if (nullHomeModels.length) {
  console.log(`\n  Models with null homeJurisdiction:`);
  for (const { id, family, resolvedFamily } of nullHomeModels) {
    console.log(`    ${id}  (family=${family ?? "—"}, resolvedFamily=${resolvedFamily ?? "—"})`);
  }
}

if (nullRegionVariants.length) {
  console.log(`\n  Variants with null processingRegion:`);
  for (const { modelId, providerIntegrationType, reason } of nullRegionVariants) {
    console.log(`    ${modelId} [${providerIntegrationType}] — ${reason}`);
  }
}
