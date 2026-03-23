/**
 * Seed model catalog from @restormel/keys provider definitions.
 *
 * Goal: always include the “real” set of built-in provider models (deepseek, latest OpenAI/Anthropic variants, etc.)
 * instead of relying on a static JSON that can go stale.
 *
 * Notes:
 * - We exclude model ids containing "/" to keep them safe as URL path segments in the UI routes.
 * - We only populate minimal model fields; any richer metadata already in the DB (e.g. from 011_seed_full_model_catalog.sql)
 *   is preserved on conflict.
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { defaultProviders } from "@restormel/keys";

function safeFamily(providerId, modelId) {
  if (providerId === "openai") {
    if (modelId.startsWith("gpt-3.5")) return "gpt-3.5";
    if (modelId.startsWith("o1") || modelId.startsWith("o3")) return modelId.startsWith("o1") ? "o1" : "o3";
    if (modelId.startsWith("gpt-4") || modelId.startsWith("gpt-4o") || modelId.startsWith("o1-")) return "gpt-4";
    return "openai";
  }
  if (providerId === "anthropic") return "claude";
  if (providerId === "google") return "gemini";
  if (providerId === "deepseek") return "deepseek";
  if (providerId === "groq") return "groq";
  return providerId;
}

function isUrlSafeModelId(modelId) {
  return !modelId.includes("/");
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const sql = neon(url);

  // Fail fast with actionable guidance when the DB wasn't migrated yet.
  const [
    modelsRegRow,
    variantsRegRow,
  ] = await Promise.all([
    sql`SELECT to_regclass('public.models') AS reg`,
    sql`SELECT to_regclass('public.provider_model_variants') AS reg`,
  ]);
  const modelsReg = modelsRegRow?.[0]?.reg ?? null;
  const variantsReg = variantsRegRow?.[0]?.reg ?? null;

  if (!modelsReg || !variantsReg) {
    console.error("Model catalog tables are missing in the DATABASE_URL you provided.");
    console.error("Run these migrations against this Neon DB (in order):");
    console.error("  apps/dashboard/migrations/001_initial.sql");
    console.error("  apps/dashboard/migrations/002_better_auth.sql (if applicable; Neon Auth uses its own schema)");
    console.error("  apps/dashboard/migrations/003_workspaces_and_environments.sql");
    console.error("  apps/dashboard/migrations/004_control_plane_tables.sql");
    console.error("  apps/dashboard/migrations/005_seed_model_catalog.sql (optional bootstrap; not required because we upsert)");
    process.exit(1);
  }

  // Collect candidate models from built-in provider adapters.
  const modelToFamily = new Map(); // modelId -> family
  const variants = []; // { modelId, providerId }

  for (const provider of defaultProviders) {
    const providerId = provider.id;
    for (const modelId of provider.models) {
      if (!isUrlSafeModelId(modelId)) continue;
      if (!modelToFamily.has(modelId)) modelToFamily.set(modelId, safeFamily(providerId, modelId));
      variants.push({ modelId, providerId });
    }
  }

  // Upsert models. Preserve existing metadata on conflict.
  for (const [modelId, family] of modelToFamily.entries()) {
    await sql`
      INSERT INTO models (
        id,
        canonical_name,
        family,
        lifecycle_state,
        description,
        context_window,
        max_output_tokens,
        supports_tools,
        supports_structured_output,
        supports_mcp,
        modalities,
        capabilities,
        editorial_summary,
        strengths,
        weaknesses,
        recommended_for,
        avoid_for,
        deprecation_date,
        retirement_date,
        replacement_model_id,
        source_last_verified_at
      ) VALUES (
        ${modelId},
        ${modelId},
        ${family},
        ${"active"},
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL
      )
      ON CONFLICT (id) DO UPDATE SET
        canonical_name = EXCLUDED.canonical_name,
        family = COALESCE(models.family, EXCLUDED.family),
        lifecycle_state = COALESCE(models.lifecycle_state, EXCLUDED.lifecycle_state)
    `;
  }

  // Upsert provider model variants. Preserve existing pricing/rate-limit refs if they already exist.
  for (const { modelId, providerId } of variants) {
    const variantId = `${modelId}-${providerId}`;
    await sql`
      INSERT INTO provider_model_variants (
        id,
        model_id,
        provider_integration_type,
        catalog_provider_id,
        provider_model_id,
        availability_status,
        pricing_ref,
        rate_limit_ref,
        metadata,
        source_last_verified_at
      ) VALUES (
        ${variantId},
        ${modelId},
        ${providerId},
        ${providerId},
        ${modelId},
        ${"available"},
        NULL,
        NULL,
        NULL,
        NULL
      )
      ON CONFLICT (id) DO UPDATE SET
        provider_model_id = provider_model_variants.provider_model_id,
        catalog_provider_id = COALESCE(provider_model_variants.catalog_provider_id, EXCLUDED.catalog_provider_id),
        availability_status = COALESCE(provider_model_variants.availability_status, EXCLUDED.availability_status),
        pricing_ref = COALESCE(provider_model_variants.pricing_ref, EXCLUDED.pricing_ref),
        rate_limit_ref = COALESCE(provider_model_variants.rate_limit_ref, EXCLUDED.rate_limit_ref),
        metadata = COALESCE(provider_model_variants.metadata, EXCLUDED.metadata),
        source_last_verified_at = COALESCE(provider_model_variants.source_last_verified_at, EXCLUDED.source_last_verified_at)
    `;
  }

  console.log(
    `Seeded catalog from @restormel/keys: models=${modelToFamily.size}, provider_variants=${variants.length}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

