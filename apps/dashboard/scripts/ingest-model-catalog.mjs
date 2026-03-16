/**
 * Model catalog ingestion: load seed JSON and upsert into models + provider_model_variants.
 * Run from apps/dashboard: pnpm run seed:catalog (requires DATABASE_URL).
 * See docs/reference/model-catalog-ingestion.md for static vs dynamic and refresh.
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = join(__dirname, "..", "data", "model-catalog-seed.json");

function loadSeed() {
  const raw = readFileSync(SEED_PATH, "utf-8");
  return JSON.parse(raw);
}

function validateModel(m, index) {
  const err = [];
  if (!m.id || typeof m.id !== "string") err.push("model[].id required (string)");
  if (!m.canonicalName || typeof m.canonicalName !== "string") err.push("model[].canonicalName required (string)");
  if (m.variants && !Array.isArray(m.variants)) err.push("model[].variants must be array");
  if (m.variants) {
    m.variants.forEach((v, i) => {
      if (!v.providerIntegrationType || typeof v.providerIntegrationType !== "string")
        err.push(`model[${index}].variants[${i}].providerIntegrationType required`);
      if (!v.providerModelId || typeof v.providerModelId !== "string")
        err.push(`model[${index}].variants[${i}].providerModelId required`);
    });
  }
  return err;
}

function validate(seed) {
  const errors = [];
  if (!seed.models || !Array.isArray(seed.models)) {
    errors.push("seed.models must be an array");
    return errors;
  }
  seed.models.forEach((m, i) => errors.push(...validateModel(m, i)));
  return errors;
}

async function upsertModels(sql, models) {
  let count = 0;
  for (const m of models) {
    const modalities = m.modalities ? JSON.stringify(m.modalities) : null;
    const capabilities = m.capabilities ? JSON.stringify(m.capabilities) : null;
    await sql`
      INSERT INTO models (
        id, canonical_name, family, lifecycle_state, description,
        context_window, max_output_tokens, supports_tools, supports_structured_output, supports_mcp,
        modalities, capabilities, editorial_summary,
        deprecation_date, retirement_date, replacement_model_id, source_last_verified_at
      ) VALUES (
        ${m.id}, ${m.canonicalName}, ${m.family ?? null}, ${m.lifecycleState ?? null}, ${m.description ?? null},
        ${m.contextWindow ?? null}, ${m.maxOutputTokens ?? null}, ${m.supportsTools ?? null}, ${m.supportsStructuredOutput ?? null}, ${m.supportsMcp ?? null},
        ${modalities}, ${capabilities}, ${m.editorialSummary ?? null},
        ${m.deprecationDate ?? null}, ${m.retirementDate ?? null}, ${m.replacementModelId ?? null}, ${m.sourceLastVerifiedAt ?? null}
      )
      ON CONFLICT (id) DO UPDATE SET
        canonical_name = EXCLUDED.canonical_name,
        family = EXCLUDED.family,
        lifecycle_state = EXCLUDED.lifecycle_state,
        description = EXCLUDED.description,
        context_window = EXCLUDED.context_window,
        max_output_tokens = EXCLUDED.max_output_tokens,
        supports_tools = EXCLUDED.supports_tools,
        supports_structured_output = EXCLUDED.supports_structured_output,
        supports_mcp = EXCLUDED.supports_mcp,
        modalities = EXCLUDED.modalities,
        capabilities = EXCLUDED.capabilities,
        editorial_summary = EXCLUDED.editorial_summary,
        deprecation_date = EXCLUDED.deprecation_date,
        retirement_date = EXCLUDED.retirement_date,
        replacement_model_id = EXCLUDED.replacement_model_id,
        source_last_verified_at = EXCLUDED.source_last_verified_at
    `;
    count += 1;
  }
  return count;
}

async function upsertVariants(sql, models) {
  let count = 0;
  for (const m of models) {
    if (!m.variants || !m.variants.length) continue;
    for (const v of m.variants) {
      const variantId = `${m.id}-${v.providerIntegrationType}`;
      await sql`
        INSERT INTO provider_model_variants (
          id, model_id, provider_integration_type, provider_model_id,
          availability_status, pricing_ref, rate_limit_ref, source_last_verified_at
        ) VALUES (
          ${variantId}, ${m.id}, ${v.providerIntegrationType}, ${v.providerModelId},
          ${v.availabilityStatus ?? null}, ${v.pricingRef ?? null}, ${v.rateLimitRef ?? null}, ${v.sourceLastVerifiedAt ?? null}
        )
        ON CONFLICT (id) DO UPDATE SET
          provider_model_id = EXCLUDED.provider_model_id,
          availability_status = EXCLUDED.availability_status,
          pricing_ref = EXCLUDED.pricing_ref,
          rate_limit_ref = EXCLUDED.rate_limit_ref,
          source_last_verified_at = EXCLUDED.source_last_verified_at
      `;
      count += 1;
    }
  }
  return count;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Set it in .env or environment.");
    process.exit(1);
  }
  const seed = loadSeed();
  const errors = validate(seed);
  if (errors.length) {
    console.error("Validation failed:");
    errors.forEach((e) => console.error("  -", e));
    process.exit(1);
  }
  const sql = neon(url);
  const modelCount = await upsertModels(sql, seed.models);
  const variantCount = await upsertVariants(sql, seed.models);
  console.log(`Ingestion complete: ${modelCount} models, ${variantCount} provider variants.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
