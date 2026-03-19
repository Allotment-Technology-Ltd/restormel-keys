-- Full model catalog seed (models + provider_model_variants)
-- Inserts the complete catalog from apps/dashboard/data/model-catalog-seed.json
-- Safe to run multiple times; uses UPSERT for idempotency

BEGIN;

INSERT INTO models (
  id, canonical_name, family, lifecycle_state, description,
  context_window, max_output_tokens, supports_tools, supports_structured_output, supports_mcp,
  modalities, capabilities, editorial_summary,
  strengths, weaknesses, recommended_for, avoid_for,
  deprecation_date, retirement_date, replacement_model_id, source_last_verified_at
) VALUES (
  'gpt-4o', 'gpt-4o', 'gpt-4', 'active', 'GPT-4o: multimodal flagship model.',
  128000, 16384, true, true, false,
  '["text","vision"]'::jsonb, '["chat","vision","tools"]'::jsonb, null,
  null, null, null, null,
  null, null, null, null
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
  strengths = EXCLUDED.strengths,
  weaknesses = EXCLUDED.weaknesses,
  recommended_for = EXCLUDED.recommended_for,
  avoid_for = EXCLUDED.avoid_for,
  deprecation_date = EXCLUDED.deprecation_date,
  retirement_date = EXCLUDED.retirement_date,
  replacement_model_id = EXCLUDED.replacement_model_id,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO models (
  id, canonical_name, family, lifecycle_state, description,
  context_window, max_output_tokens, supports_tools, supports_structured_output, supports_mcp,
  modalities, capabilities, editorial_summary,
  strengths, weaknesses, recommended_for, avoid_for,
  deprecation_date, retirement_date, replacement_model_id, source_last_verified_at
) VALUES (
  'gpt-4o-mini', 'gpt-4o-mini', 'gpt-4', 'active', 'GPT-4o mini: fast and affordable.',
  128000, 16384, true, true, false,
  '["text","vision"]'::jsonb, '["chat","vision","tools"]'::jsonb, null,
  null, null, null, null,
  null, null, null, null
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
  strengths = EXCLUDED.strengths,
  weaknesses = EXCLUDED.weaknesses,
  recommended_for = EXCLUDED.recommended_for,
  avoid_for = EXCLUDED.avoid_for,
  deprecation_date = EXCLUDED.deprecation_date,
  retirement_date = EXCLUDED.retirement_date,
  replacement_model_id = EXCLUDED.replacement_model_id,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO models (
  id, canonical_name, family, lifecycle_state, description,
  context_window, max_output_tokens, supports_tools, supports_structured_output, supports_mcp,
  modalities, capabilities, editorial_summary,
  strengths, weaknesses, recommended_for, avoid_for,
  deprecation_date, retirement_date, replacement_model_id, source_last_verified_at
) VALUES (
  'gpt-4o-nano', 'gpt-4o-nano', 'gpt-4', 'active', 'GPT-4o nano: smallest and fastest.',
  128000, 16384, true, true, false,
  '["text","vision"]'::jsonb, '["chat","vision","tools"]'::jsonb, null,
  null, null, null, null,
  null, null, null, null
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
  strengths = EXCLUDED.strengths,
  weaknesses = EXCLUDED.weaknesses,
  recommended_for = EXCLUDED.recommended_for,
  avoid_for = EXCLUDED.avoid_for,
  deprecation_date = EXCLUDED.deprecation_date,
  retirement_date = EXCLUDED.retirement_date,
  replacement_model_id = EXCLUDED.replacement_model_id,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO models (
  id, canonical_name, family, lifecycle_state, description,
  context_window, max_output_tokens, supports_tools, supports_structured_output, supports_mcp,
  modalities, capabilities, editorial_summary,
  strengths, weaknesses, recommended_for, avoid_for,
  deprecation_date, retirement_date, replacement_model_id, source_last_verified_at
) VALUES (
  'o1', 'o1', 'o1', 'active', 'o1: reasoning model.',
  200000, 100000, false, false, false,
  '["text"]'::jsonb, '["chat","reasoning"]'::jsonb, null,
  null, null, null, null,
  null, null, null, null
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
  strengths = EXCLUDED.strengths,
  weaknesses = EXCLUDED.weaknesses,
  recommended_for = EXCLUDED.recommended_for,
  avoid_for = EXCLUDED.avoid_for,
  deprecation_date = EXCLUDED.deprecation_date,
  retirement_date = EXCLUDED.retirement_date,
  replacement_model_id = EXCLUDED.replacement_model_id,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO models (
  id, canonical_name, family, lifecycle_state, description,
  context_window, max_output_tokens, supports_tools, supports_structured_output, supports_mcp,
  modalities, capabilities, editorial_summary,
  strengths, weaknesses, recommended_for, avoid_for,
  deprecation_date, retirement_date, replacement_model_id, source_last_verified_at
) VALUES (
  'o1-mini', 'o1-mini', 'o1', 'active', 'o1 mini: smaller reasoning model.',
  128000, 65536, false, false, false,
  '["text"]'::jsonb, '["chat","reasoning"]'::jsonb, null,
  null, null, null, null,
  null, null, null, null
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
  strengths = EXCLUDED.strengths,
  weaknesses = EXCLUDED.weaknesses,
  recommended_for = EXCLUDED.recommended_for,
  avoid_for = EXCLUDED.avoid_for,
  deprecation_date = EXCLUDED.deprecation_date,
  retirement_date = EXCLUDED.retirement_date,
  replacement_model_id = EXCLUDED.replacement_model_id,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO models (
  id, canonical_name, family, lifecycle_state, description,
  context_window, max_output_tokens, supports_tools, supports_structured_output, supports_mcp,
  modalities, capabilities, editorial_summary,
  strengths, weaknesses, recommended_for, avoid_for,
  deprecation_date, retirement_date, replacement_model_id, source_last_verified_at
) VALUES (
  'claude-3-5-sonnet', 'claude-3-5-sonnet', 'claude', 'active', 'Claude 3.5 Sonnet: balanced performance.',
  200000, 8192, true, true, false,
  '["text"]'::jsonb, '["chat","tools"]'::jsonb, null,
  null, null, null, null,
  null, null, null, null
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
  strengths = EXCLUDED.strengths,
  weaknesses = EXCLUDED.weaknesses,
  recommended_for = EXCLUDED.recommended_for,
  avoid_for = EXCLUDED.avoid_for,
  deprecation_date = EXCLUDED.deprecation_date,
  retirement_date = EXCLUDED.retirement_date,
  replacement_model_id = EXCLUDED.replacement_model_id,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO models (
  id, canonical_name, family, lifecycle_state, description,
  context_window, max_output_tokens, supports_tools, supports_structured_output, supports_mcp,
  modalities, capabilities, editorial_summary,
  strengths, weaknesses, recommended_for, avoid_for,
  deprecation_date, retirement_date, replacement_model_id, source_last_verified_at
) VALUES (
  'claude-sonnet-4', 'claude-sonnet-4', 'claude', 'active', 'Claude Sonnet 4.',
  200000, 8192, true, true, false,
  '["text"]'::jsonb, '["chat","tools"]'::jsonb, null,
  null, null, null, null,
  null, null, null, null
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
  strengths = EXCLUDED.strengths,
  weaknesses = EXCLUDED.weaknesses,
  recommended_for = EXCLUDED.recommended_for,
  avoid_for = EXCLUDED.avoid_for,
  deprecation_date = EXCLUDED.deprecation_date,
  retirement_date = EXCLUDED.retirement_date,
  replacement_model_id = EXCLUDED.replacement_model_id,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO models (
  id, canonical_name, family, lifecycle_state, description,
  context_window, max_output_tokens, supports_tools, supports_structured_output, supports_mcp,
  modalities, capabilities, editorial_summary,
  strengths, weaknesses, recommended_for, avoid_for,
  deprecation_date, retirement_date, replacement_model_id, source_last_verified_at
) VALUES (
  'claude-haiku-4.5', 'claude-haiku-4.5', 'claude', 'active', 'Claude Haiku 4.5: fast and efficient.',
  200000, 8192, true, true, false,
  '["text"]'::jsonb, '["chat","tools"]'::jsonb, null,
  null, null, null, null,
  null, null, null, null
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
  strengths = EXCLUDED.strengths,
  weaknesses = EXCLUDED.weaknesses,
  recommended_for = EXCLUDED.recommended_for,
  avoid_for = EXCLUDED.avoid_for,
  deprecation_date = EXCLUDED.deprecation_date,
  retirement_date = EXCLUDED.retirement_date,
  replacement_model_id = EXCLUDED.replacement_model_id,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO models (
  id, canonical_name, family, lifecycle_state, description,
  context_window, max_output_tokens, supports_tools, supports_structured_output, supports_mcp,
  modalities, capabilities, editorial_summary,
  strengths, weaknesses, recommended_for, avoid_for,
  deprecation_date, retirement_date, replacement_model_id, source_last_verified_at
) VALUES (
  'claude-opus-4', 'claude-opus-4', 'claude', 'active', 'Claude Opus 4: most capable.',
  200000, 8192, true, true, false,
  '["text"]'::jsonb, '["chat","tools"]'::jsonb, null,
  null, null, null, null,
  null, null, null, null
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
  strengths = EXCLUDED.strengths,
  weaknesses = EXCLUDED.weaknesses,
  recommended_for = EXCLUDED.recommended_for,
  avoid_for = EXCLUDED.avoid_for,
  deprecation_date = EXCLUDED.deprecation_date,
  retirement_date = EXCLUDED.retirement_date,
  replacement_model_id = EXCLUDED.replacement_model_id,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO models (
  id, canonical_name, family, lifecycle_state, description,
  context_window, max_output_tokens, supports_tools, supports_structured_output, supports_mcp,
  modalities, capabilities, editorial_summary,
  strengths, weaknesses, recommended_for, avoid_for,
  deprecation_date, retirement_date, replacement_model_id, source_last_verified_at
) VALUES (
  'gemini-2.5-pro', 'gemini-2.5-pro', 'gemini', 'active', 'Gemini 2.5 Pro.',
  1000000, 8192, true, true, false,
  '["text","vision"]'::jsonb, '["chat","vision","tools"]'::jsonb, null,
  null, null, null, null,
  null, null, null, null
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
  strengths = EXCLUDED.strengths,
  weaknesses = EXCLUDED.weaknesses,
  recommended_for = EXCLUDED.recommended_for,
  avoid_for = EXCLUDED.avoid_for,
  deprecation_date = EXCLUDED.deprecation_date,
  retirement_date = EXCLUDED.retirement_date,
  replacement_model_id = EXCLUDED.replacement_model_id,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO models (
  id, canonical_name, family, lifecycle_state, description,
  context_window, max_output_tokens, supports_tools, supports_structured_output, supports_mcp,
  modalities, capabilities, editorial_summary,
  strengths, weaknesses, recommended_for, avoid_for,
  deprecation_date, retirement_date, replacement_model_id, source_last_verified_at
) VALUES (
  'gemini-2.5-flash', 'gemini-2.5-flash', 'gemini', 'active', 'Gemini 2.5 Flash: fast and efficient.',
  1000000, 8192, true, true, false,
  '["text","vision"]'::jsonb, '["chat","vision","tools"]'::jsonb, null,
  null, null, null, null,
  null, null, null, null
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
  strengths = EXCLUDED.strengths,
  weaknesses = EXCLUDED.weaknesses,
  recommended_for = EXCLUDED.recommended_for,
  avoid_for = EXCLUDED.avoid_for,
  deprecation_date = EXCLUDED.deprecation_date,
  retirement_date = EXCLUDED.retirement_date,
  replacement_model_id = EXCLUDED.replacement_model_id,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO models (
  id, canonical_name, family, lifecycle_state, description,
  context_window, max_output_tokens, supports_tools, supports_structured_output, supports_mcp,
  modalities, capabilities, editorial_summary,
  strengths, weaknesses, recommended_for, avoid_for,
  deprecation_date, retirement_date, replacement_model_id, source_last_verified_at
) VALUES (
  'gpt-4o-audio-preview', 'gpt-4o-audio-preview', 'gpt-4', 'active', 'GPT-4o audio preview.',
  128000, 16384, true, true, false,
  '["text","audio"]'::jsonb, '["chat","audio"]'::jsonb, null,
  null, null, null, null,
  null, null, null, null
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
  strengths = EXCLUDED.strengths,
  weaknesses = EXCLUDED.weaknesses,
  recommended_for = EXCLUDED.recommended_for,
  avoid_for = EXCLUDED.avoid_for,
  deprecation_date = EXCLUDED.deprecation_date,
  retirement_date = EXCLUDED.retirement_date,
  replacement_model_id = EXCLUDED.replacement_model_id,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO models (
  id, canonical_name, family, lifecycle_state, description,
  context_window, max_output_tokens, supports_tools, supports_structured_output, supports_mcp,
  modalities, capabilities, editorial_summary,
  strengths, weaknesses, recommended_for, avoid_for,
  deprecation_date, retirement_date, replacement_model_id, source_last_verified_at
) VALUES (
  'gpt-4.1', 'gpt-4.1', 'gpt-4', 'active', 'GPT-4.1.',
  128000, 16384, true, true, false,
  '["text","vision"]'::jsonb, '["chat","vision","tools"]'::jsonb, null,
  null, null, null, null,
  null, null, null, null
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
  strengths = EXCLUDED.strengths,
  weaknesses = EXCLUDED.weaknesses,
  recommended_for = EXCLUDED.recommended_for,
  avoid_for = EXCLUDED.avoid_for,
  deprecation_date = EXCLUDED.deprecation_date,
  retirement_date = EXCLUDED.retirement_date,
  replacement_model_id = EXCLUDED.replacement_model_id,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO models (
  id, canonical_name, family, lifecycle_state, description,
  context_window, max_output_tokens, supports_tools, supports_structured_output, supports_mcp,
  modalities, capabilities, editorial_summary,
  strengths, weaknesses, recommended_for, avoid_for,
  deprecation_date, retirement_date, replacement_model_id, source_last_verified_at
) VALUES (
  'gpt-4.1-mini', 'gpt-4.1-mini', 'gpt-4', 'active', 'GPT-4.1 mini.',
  128000, 16384, true, true, false,
  '["text","vision"]'::jsonb, '["chat","vision","tools"]'::jsonb, null,
  null, null, null, null,
  null, null, null, null
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
  strengths = EXCLUDED.strengths,
  weaknesses = EXCLUDED.weaknesses,
  recommended_for = EXCLUDED.recommended_for,
  avoid_for = EXCLUDED.avoid_for,
  deprecation_date = EXCLUDED.deprecation_date,
  retirement_date = EXCLUDED.retirement_date,
  replacement_model_id = EXCLUDED.replacement_model_id,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO models (
  id, canonical_name, family, lifecycle_state, description,
  context_window, max_output_tokens, supports_tools, supports_structured_output, supports_mcp,
  modalities, capabilities, editorial_summary,
  strengths, weaknesses, recommended_for, avoid_for,
  deprecation_date, retirement_date, replacement_model_id, source_last_verified_at
) VALUES (
  'gpt-4-turbo', 'gpt-4-turbo', 'gpt-4', 'active', 'GPT-4 Turbo.',
  128000, 4096, true, true, false,
  '["text","vision"]'::jsonb, '["chat","vision","tools"]'::jsonb, null,
  null, null, null, null,
  null, null, null, null
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
  strengths = EXCLUDED.strengths,
  weaknesses = EXCLUDED.weaknesses,
  recommended_for = EXCLUDED.recommended_for,
  avoid_for = EXCLUDED.avoid_for,
  deprecation_date = EXCLUDED.deprecation_date,
  retirement_date = EXCLUDED.retirement_date,
  replacement_model_id = EXCLUDED.replacement_model_id,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO models (
  id, canonical_name, family, lifecycle_state, description,
  context_window, max_output_tokens, supports_tools, supports_structured_output, supports_mcp,
  modalities, capabilities, editorial_summary,
  strengths, weaknesses, recommended_for, avoid_for,
  deprecation_date, retirement_date, replacement_model_id, source_last_verified_at
) VALUES (
  'gpt-4-turbo-mini', 'gpt-4-turbo-mini', 'gpt-4', 'active', 'GPT-4 Turbo mini.',
  128000, 4096, true, true, false,
  '["text"]'::jsonb, '["chat","tools"]'::jsonb, null,
  null, null, null, null,
  null, null, null, null
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
  strengths = EXCLUDED.strengths,
  weaknesses = EXCLUDED.weaknesses,
  recommended_for = EXCLUDED.recommended_for,
  avoid_for = EXCLUDED.avoid_for,
  deprecation_date = EXCLUDED.deprecation_date,
  retirement_date = EXCLUDED.retirement_date,
  replacement_model_id = EXCLUDED.replacement_model_id,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO models (
  id, canonical_name, family, lifecycle_state, description,
  context_window, max_output_tokens, supports_tools, supports_structured_output, supports_mcp,
  modalities, capabilities, editorial_summary,
  strengths, weaknesses, recommended_for, avoid_for,
  deprecation_date, retirement_date, replacement_model_id, source_last_verified_at
) VALUES (
  'gpt-3.5-turbo', 'gpt-3.5-turbo', 'gpt-3.5', 'active', 'GPT-3.5 Turbo.',
  16385, 4096, true, false, false,
  '["text"]'::jsonb, '["chat","tools"]'::jsonb, null,
  null, null, null, null,
  null, null, null, null
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
  strengths = EXCLUDED.strengths,
  weaknesses = EXCLUDED.weaknesses,
  recommended_for = EXCLUDED.recommended_for,
  avoid_for = EXCLUDED.avoid_for,
  deprecation_date = EXCLUDED.deprecation_date,
  retirement_date = EXCLUDED.retirement_date,
  replacement_model_id = EXCLUDED.replacement_model_id,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO models (
  id, canonical_name, family, lifecycle_state, description,
  context_window, max_output_tokens, supports_tools, supports_structured_output, supports_mcp,
  modalities, capabilities, editorial_summary,
  strengths, weaknesses, recommended_for, avoid_for,
  deprecation_date, retirement_date, replacement_model_id, source_last_verified_at
) VALUES (
  'o3-mini', 'o3-mini', 'o3', 'active', 'o3 mini reasoning model.',
  200000, 100000, false, false, false,
  '["text"]'::jsonb, '["chat","reasoning"]'::jsonb, null,
  null, null, null, null,
  null, null, null, null
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
  strengths = EXCLUDED.strengths,
  weaknesses = EXCLUDED.weaknesses,
  recommended_for = EXCLUDED.recommended_for,
  avoid_for = EXCLUDED.avoid_for,
  deprecation_date = EXCLUDED.deprecation_date,
  retirement_date = EXCLUDED.retirement_date,
  replacement_model_id = EXCLUDED.replacement_model_id,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO models (
  id, canonical_name, family, lifecycle_state, description,
  context_window, max_output_tokens, supports_tools, supports_structured_output, supports_mcp,
  modalities, capabilities, editorial_summary,
  strengths, weaknesses, recommended_for, avoid_for,
  deprecation_date, retirement_date, replacement_model_id, source_last_verified_at
) VALUES (
  'claude-3-5-haiku', 'claude-3-5-haiku', 'claude', 'active', 'Claude 3.5 Haiku.',
  200000, 8192, true, true, false,
  '["text"]'::jsonb, '["chat","tools"]'::jsonb, null,
  null, null, null, null,
  null, null, null, null
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
  strengths = EXCLUDED.strengths,
  weaknesses = EXCLUDED.weaknesses,
  recommended_for = EXCLUDED.recommended_for,
  avoid_for = EXCLUDED.avoid_for,
  deprecation_date = EXCLUDED.deprecation_date,
  retirement_date = EXCLUDED.retirement_date,
  replacement_model_id = EXCLUDED.replacement_model_id,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO models (
  id, canonical_name, family, lifecycle_state, description,
  context_window, max_output_tokens, supports_tools, supports_structured_output, supports_mcp,
  modalities, capabilities, editorial_summary,
  strengths, weaknesses, recommended_for, avoid_for,
  deprecation_date, retirement_date, replacement_model_id, source_last_verified_at
) VALUES (
  'claude-3-opus-20240229', 'claude-3-opus-20240229', 'claude', 'active', 'Claude 3 Opus (dated).',
  200000, 4096, true, true, false,
  '["text"]'::jsonb, '["chat","tools"]'::jsonb, null,
  null, null, null, null,
  null, null, null, null
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
  strengths = EXCLUDED.strengths,
  weaknesses = EXCLUDED.weaknesses,
  recommended_for = EXCLUDED.recommended_for,
  avoid_for = EXCLUDED.avoid_for,
  deprecation_date = EXCLUDED.deprecation_date,
  retirement_date = EXCLUDED.retirement_date,
  replacement_model_id = EXCLUDED.replacement_model_id,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO models (
  id, canonical_name, family, lifecycle_state, description,
  context_window, max_output_tokens, supports_tools, supports_structured_output, supports_mcp,
  modalities, capabilities, editorial_summary,
  strengths, weaknesses, recommended_for, avoid_for,
  deprecation_date, retirement_date, replacement_model_id, source_last_verified_at
) VALUES (
  'claude-3-sonnet-20240229', 'claude-3-sonnet-20240229', 'claude', 'active', 'Claude 3 Sonnet (dated).',
  200000, 4096, true, true, false,
  '["text"]'::jsonb, '["chat","tools"]'::jsonb, null,
  null, null, null, null,
  null, null, null, null
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
  strengths = EXCLUDED.strengths,
  weaknesses = EXCLUDED.weaknesses,
  recommended_for = EXCLUDED.recommended_for,
  avoid_for = EXCLUDED.avoid_for,
  deprecation_date = EXCLUDED.deprecation_date,
  retirement_date = EXCLUDED.retirement_date,
  replacement_model_id = EXCLUDED.replacement_model_id,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO models (
  id, canonical_name, family, lifecycle_state, description,
  context_window, max_output_tokens, supports_tools, supports_structured_output, supports_mcp,
  modalities, capabilities, editorial_summary,
  strengths, weaknesses, recommended_for, avoid_for,
  deprecation_date, retirement_date, replacement_model_id, source_last_verified_at
) VALUES (
  'claude-3-haiku-20240307', 'claude-3-haiku-20240307', 'claude', 'active', 'Claude 3 Haiku (dated).',
  200000, 4096, true, true, false,
  '["text"]'::jsonb, '["chat","tools"]'::jsonb, null,
  null, null, null, null,
  null, null, null, null
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
  strengths = EXCLUDED.strengths,
  weaknesses = EXCLUDED.weaknesses,
  recommended_for = EXCLUDED.recommended_for,
  avoid_for = EXCLUDED.avoid_for,
  deprecation_date = EXCLUDED.deprecation_date,
  retirement_date = EXCLUDED.retirement_date,
  replacement_model_id = EXCLUDED.replacement_model_id,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO models (
  id, canonical_name, family, lifecycle_state, description,
  context_window, max_output_tokens, supports_tools, supports_structured_output, supports_mcp,
  modalities, capabilities, editorial_summary,
  strengths, weaknesses, recommended_for, avoid_for,
  deprecation_date, retirement_date, replacement_model_id, source_last_verified_at
) VALUES (
  'gemini-2.0-flash-exp', 'gemini-2.0-flash-exp', 'gemini', 'active', 'Gemini 2.0 Flash (experimental).',
  1000000, 8192, true, true, false,
  '["text","vision"]'::jsonb, '["chat","vision","tools"]'::jsonb, null,
  null, null, null, null,
  null, null, null, null
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
  strengths = EXCLUDED.strengths,
  weaknesses = EXCLUDED.weaknesses,
  recommended_for = EXCLUDED.recommended_for,
  avoid_for = EXCLUDED.avoid_for,
  deprecation_date = EXCLUDED.deprecation_date,
  retirement_date = EXCLUDED.retirement_date,
  replacement_model_id = EXCLUDED.replacement_model_id,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO models (
  id, canonical_name, family, lifecycle_state, description,
  context_window, max_output_tokens, supports_tools, supports_structured_output, supports_mcp,
  modalities, capabilities, editorial_summary,
  strengths, weaknesses, recommended_for, avoid_for,
  deprecation_date, retirement_date, replacement_model_id, source_last_verified_at
) VALUES (
  'gemini-1.5-pro', 'gemini-1.5-pro', 'gemini', 'active', 'Gemini 1.5 Pro.',
  2000000, 8192, true, true, false,
  '["text","vision"]'::jsonb, '["chat","vision","tools"]'::jsonb, null,
  null, null, null, null,
  null, null, null, null
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
  strengths = EXCLUDED.strengths,
  weaknesses = EXCLUDED.weaknesses,
  recommended_for = EXCLUDED.recommended_for,
  avoid_for = EXCLUDED.avoid_for,
  deprecation_date = EXCLUDED.deprecation_date,
  retirement_date = EXCLUDED.retirement_date,
  replacement_model_id = EXCLUDED.replacement_model_id,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO models (
  id, canonical_name, family, lifecycle_state, description,
  context_window, max_output_tokens, supports_tools, supports_structured_output, supports_mcp,
  modalities, capabilities, editorial_summary,
  strengths, weaknesses, recommended_for, avoid_for,
  deprecation_date, retirement_date, replacement_model_id, source_last_verified_at
) VALUES (
  'gemini-1.5-flash', 'gemini-1.5-flash', 'gemini', 'active', 'Gemini 1.5 Flash.',
  1000000, 8192, true, true, false,
  '["text","vision"]'::jsonb, '["chat","vision","tools"]'::jsonb, null,
  null, null, null, null,
  null, null, null, null
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
  strengths = EXCLUDED.strengths,
  weaknesses = EXCLUDED.weaknesses,
  recommended_for = EXCLUDED.recommended_for,
  avoid_for = EXCLUDED.avoid_for,
  deprecation_date = EXCLUDED.deprecation_date,
  retirement_date = EXCLUDED.retirement_date,
  replacement_model_id = EXCLUDED.replacement_model_id,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO models (
  id, canonical_name, family, lifecycle_state, description,
  context_window, max_output_tokens, supports_tools, supports_structured_output, supports_mcp,
  modalities, capabilities, editorial_summary,
  strengths, weaknesses, recommended_for, avoid_for,
  deprecation_date, retirement_date, replacement_model_id, source_last_verified_at
) VALUES (
  'gemini-1.5-flash-8b', 'gemini-1.5-flash-8b', 'gemini', 'active', 'Gemini 1.5 Flash 8B.',
  1000000, 8192, true, true, false,
  '["text"]'::jsonb, '["chat","tools"]'::jsonb, null,
  null, null, null, null,
  null, null, null, null
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
  strengths = EXCLUDED.strengths,
  weaknesses = EXCLUDED.weaknesses,
  recommended_for = EXCLUDED.recommended_for,
  avoid_for = EXCLUDED.avoid_for,
  deprecation_date = EXCLUDED.deprecation_date,
  retirement_date = EXCLUDED.retirement_date,
  replacement_model_id = EXCLUDED.replacement_model_id,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO models (
  id, canonical_name, family, lifecycle_state, description,
  context_window, max_output_tokens, supports_tools, supports_structured_output, supports_mcp,
  modalities, capabilities, editorial_summary,
  strengths, weaknesses, recommended_for, avoid_for,
  deprecation_date, retirement_date, replacement_model_id, source_last_verified_at
) VALUES (
  'gemini-1.0-pro', 'gemini-1.0-pro', 'gemini', 'active', 'Gemini 1.0 Pro.',
  32000, 8192, false, false, false,
  '["text"]'::jsonb, '["chat"]'::jsonb, null,
  null, null, null, null,
  null, null, null, null
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
  strengths = EXCLUDED.strengths,
  weaknesses = EXCLUDED.weaknesses,
  recommended_for = EXCLUDED.recommended_for,
  avoid_for = EXCLUDED.avoid_for,
  deprecation_date = EXCLUDED.deprecation_date,
  retirement_date = EXCLUDED.retirement_date,
  replacement_model_id = EXCLUDED.replacement_model_id,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO provider_model_variants (
  id, model_id, provider_integration_type, provider_model_id,
  availability_status, pricing_ref, rate_limit_ref, metadata, source_last_verified_at
) VALUES (
  'gpt-4o-openai', 'gpt-4o', 'openai', 'gpt-4o',
  'available', 'openai-gpt-4o', null, null, null
)
ON CONFLICT (id) DO UPDATE SET
  provider_model_id = EXCLUDED.provider_model_id,
  availability_status = EXCLUDED.availability_status,
  pricing_ref = EXCLUDED.pricing_ref,
  rate_limit_ref = EXCLUDED.rate_limit_ref,
  metadata = EXCLUDED.metadata,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO provider_model_variants (
  id, model_id, provider_integration_type, provider_model_id,
  availability_status, pricing_ref, rate_limit_ref, metadata, source_last_verified_at
) VALUES (
  'gpt-4o-mini-openai', 'gpt-4o-mini', 'openai', 'gpt-4o-mini',
  'available', 'openai-gpt-4o-mini', null, null, null
)
ON CONFLICT (id) DO UPDATE SET
  provider_model_id = EXCLUDED.provider_model_id,
  availability_status = EXCLUDED.availability_status,
  pricing_ref = EXCLUDED.pricing_ref,
  rate_limit_ref = EXCLUDED.rate_limit_ref,
  metadata = EXCLUDED.metadata,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO provider_model_variants (
  id, model_id, provider_integration_type, provider_model_id,
  availability_status, pricing_ref, rate_limit_ref, metadata, source_last_verified_at
) VALUES (
  'gpt-4o-nano-openai', 'gpt-4o-nano', 'openai', 'gpt-4o-nano',
  'available', 'openai-gpt-4o-nano', null, null, null
)
ON CONFLICT (id) DO UPDATE SET
  provider_model_id = EXCLUDED.provider_model_id,
  availability_status = EXCLUDED.availability_status,
  pricing_ref = EXCLUDED.pricing_ref,
  rate_limit_ref = EXCLUDED.rate_limit_ref,
  metadata = EXCLUDED.metadata,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO provider_model_variants (
  id, model_id, provider_integration_type, provider_model_id,
  availability_status, pricing_ref, rate_limit_ref, metadata, source_last_verified_at
) VALUES (
  'o1-openai', 'o1', 'openai', 'o1',
  'available', 'openai-o1', null, null, null
)
ON CONFLICT (id) DO UPDATE SET
  provider_model_id = EXCLUDED.provider_model_id,
  availability_status = EXCLUDED.availability_status,
  pricing_ref = EXCLUDED.pricing_ref,
  rate_limit_ref = EXCLUDED.rate_limit_ref,
  metadata = EXCLUDED.metadata,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO provider_model_variants (
  id, model_id, provider_integration_type, provider_model_id,
  availability_status, pricing_ref, rate_limit_ref, metadata, source_last_verified_at
) VALUES (
  'o1-mini-openai', 'o1-mini', 'openai', 'o1-mini',
  'available', 'openai-o1-mini', null, null, null
)
ON CONFLICT (id) DO UPDATE SET
  provider_model_id = EXCLUDED.provider_model_id,
  availability_status = EXCLUDED.availability_status,
  pricing_ref = EXCLUDED.pricing_ref,
  rate_limit_ref = EXCLUDED.rate_limit_ref,
  metadata = EXCLUDED.metadata,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO provider_model_variants (
  id, model_id, provider_integration_type, provider_model_id,
  availability_status, pricing_ref, rate_limit_ref, metadata, source_last_verified_at
) VALUES (
  'claude-3-5-sonnet-anthropic', 'claude-3-5-sonnet', 'anthropic', 'claude-3-5-sonnet-20241022',
  'available', 'anthropic-claude-3-5-sonnet', null, null, null
)
ON CONFLICT (id) DO UPDATE SET
  provider_model_id = EXCLUDED.provider_model_id,
  availability_status = EXCLUDED.availability_status,
  pricing_ref = EXCLUDED.pricing_ref,
  rate_limit_ref = EXCLUDED.rate_limit_ref,
  metadata = EXCLUDED.metadata,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO provider_model_variants (
  id, model_id, provider_integration_type, provider_model_id,
  availability_status, pricing_ref, rate_limit_ref, metadata, source_last_verified_at
) VALUES (
  'claude-sonnet-4-anthropic', 'claude-sonnet-4', 'anthropic', 'claude-sonnet-4',
  'available', 'anthropic-claude-sonnet-4', null, null, null
)
ON CONFLICT (id) DO UPDATE SET
  provider_model_id = EXCLUDED.provider_model_id,
  availability_status = EXCLUDED.availability_status,
  pricing_ref = EXCLUDED.pricing_ref,
  rate_limit_ref = EXCLUDED.rate_limit_ref,
  metadata = EXCLUDED.metadata,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO provider_model_variants (
  id, model_id, provider_integration_type, provider_model_id,
  availability_status, pricing_ref, rate_limit_ref, metadata, source_last_verified_at
) VALUES (
  'claude-haiku-4.5-anthropic', 'claude-haiku-4.5', 'anthropic', 'claude-haiku-4.5',
  'available', 'anthropic-claude-haiku-4-5', null, null, null
)
ON CONFLICT (id) DO UPDATE SET
  provider_model_id = EXCLUDED.provider_model_id,
  availability_status = EXCLUDED.availability_status,
  pricing_ref = EXCLUDED.pricing_ref,
  rate_limit_ref = EXCLUDED.rate_limit_ref,
  metadata = EXCLUDED.metadata,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO provider_model_variants (
  id, model_id, provider_integration_type, provider_model_id,
  availability_status, pricing_ref, rate_limit_ref, metadata, source_last_verified_at
) VALUES (
  'claude-opus-4-anthropic', 'claude-opus-4', 'anthropic', 'claude-opus-4',
  'available', 'anthropic-claude-opus-4', null, null, null
)
ON CONFLICT (id) DO UPDATE SET
  provider_model_id = EXCLUDED.provider_model_id,
  availability_status = EXCLUDED.availability_status,
  pricing_ref = EXCLUDED.pricing_ref,
  rate_limit_ref = EXCLUDED.rate_limit_ref,
  metadata = EXCLUDED.metadata,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO provider_model_variants (
  id, model_id, provider_integration_type, provider_model_id,
  availability_status, pricing_ref, rate_limit_ref, metadata, source_last_verified_at
) VALUES (
  'gemini-2.5-pro-google', 'gemini-2.5-pro', 'google', 'gemini-2.5-pro',
  'available', 'google-gemini-2-5-pro', null, null, null
)
ON CONFLICT (id) DO UPDATE SET
  provider_model_id = EXCLUDED.provider_model_id,
  availability_status = EXCLUDED.availability_status,
  pricing_ref = EXCLUDED.pricing_ref,
  rate_limit_ref = EXCLUDED.rate_limit_ref,
  metadata = EXCLUDED.metadata,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO provider_model_variants (
  id, model_id, provider_integration_type, provider_model_id,
  availability_status, pricing_ref, rate_limit_ref, metadata, source_last_verified_at
) VALUES (
  'gemini-2.5-flash-google', 'gemini-2.5-flash', 'google', 'gemini-2.5-flash',
  'available', 'google-gemini-2-5-flash', null, null, null
)
ON CONFLICT (id) DO UPDATE SET
  provider_model_id = EXCLUDED.provider_model_id,
  availability_status = EXCLUDED.availability_status,
  pricing_ref = EXCLUDED.pricing_ref,
  rate_limit_ref = EXCLUDED.rate_limit_ref,
  metadata = EXCLUDED.metadata,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO provider_model_variants (
  id, model_id, provider_integration_type, provider_model_id,
  availability_status, pricing_ref, rate_limit_ref, metadata, source_last_verified_at
) VALUES (
  'gpt-4o-audio-preview-openai', 'gpt-4o-audio-preview', 'openai', 'gpt-4o-audio-preview',
  'available', 'openai-gpt-4o-audio-preview', null, null, null
)
ON CONFLICT (id) DO UPDATE SET
  provider_model_id = EXCLUDED.provider_model_id,
  availability_status = EXCLUDED.availability_status,
  pricing_ref = EXCLUDED.pricing_ref,
  rate_limit_ref = EXCLUDED.rate_limit_ref,
  metadata = EXCLUDED.metadata,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO provider_model_variants (
  id, model_id, provider_integration_type, provider_model_id,
  availability_status, pricing_ref, rate_limit_ref, metadata, source_last_verified_at
) VALUES (
  'gpt-4.1-openai', 'gpt-4.1', 'openai', 'gpt-4.1',
  'available', 'openai-gpt-4-1', null, null, null
)
ON CONFLICT (id) DO UPDATE SET
  provider_model_id = EXCLUDED.provider_model_id,
  availability_status = EXCLUDED.availability_status,
  pricing_ref = EXCLUDED.pricing_ref,
  rate_limit_ref = EXCLUDED.rate_limit_ref,
  metadata = EXCLUDED.metadata,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO provider_model_variants (
  id, model_id, provider_integration_type, provider_model_id,
  availability_status, pricing_ref, rate_limit_ref, metadata, source_last_verified_at
) VALUES (
  'gpt-4.1-mini-openai', 'gpt-4.1-mini', 'openai', 'gpt-4.1-mini',
  'available', 'openai-gpt-4-1-mini', null, null, null
)
ON CONFLICT (id) DO UPDATE SET
  provider_model_id = EXCLUDED.provider_model_id,
  availability_status = EXCLUDED.availability_status,
  pricing_ref = EXCLUDED.pricing_ref,
  rate_limit_ref = EXCLUDED.rate_limit_ref,
  metadata = EXCLUDED.metadata,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO provider_model_variants (
  id, model_id, provider_integration_type, provider_model_id,
  availability_status, pricing_ref, rate_limit_ref, metadata, source_last_verified_at
) VALUES (
  'gpt-4-turbo-openai', 'gpt-4-turbo', 'openai', 'gpt-4-turbo',
  'available', 'openai-gpt-4-turbo', null, null, null
)
ON CONFLICT (id) DO UPDATE SET
  provider_model_id = EXCLUDED.provider_model_id,
  availability_status = EXCLUDED.availability_status,
  pricing_ref = EXCLUDED.pricing_ref,
  rate_limit_ref = EXCLUDED.rate_limit_ref,
  metadata = EXCLUDED.metadata,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO provider_model_variants (
  id, model_id, provider_integration_type, provider_model_id,
  availability_status, pricing_ref, rate_limit_ref, metadata, source_last_verified_at
) VALUES (
  'gpt-4-turbo-mini-openai', 'gpt-4-turbo-mini', 'openai', 'gpt-4-turbo-mini',
  'available', 'openai-gpt-4-turbo-mini', null, null, null
)
ON CONFLICT (id) DO UPDATE SET
  provider_model_id = EXCLUDED.provider_model_id,
  availability_status = EXCLUDED.availability_status,
  pricing_ref = EXCLUDED.pricing_ref,
  rate_limit_ref = EXCLUDED.rate_limit_ref,
  metadata = EXCLUDED.metadata,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO provider_model_variants (
  id, model_id, provider_integration_type, provider_model_id,
  availability_status, pricing_ref, rate_limit_ref, metadata, source_last_verified_at
) VALUES (
  'gpt-3.5-turbo-openai', 'gpt-3.5-turbo', 'openai', 'gpt-3.5-turbo',
  'available', 'openai-gpt-3-5-turbo', null, null, null
)
ON CONFLICT (id) DO UPDATE SET
  provider_model_id = EXCLUDED.provider_model_id,
  availability_status = EXCLUDED.availability_status,
  pricing_ref = EXCLUDED.pricing_ref,
  rate_limit_ref = EXCLUDED.rate_limit_ref,
  metadata = EXCLUDED.metadata,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO provider_model_variants (
  id, model_id, provider_integration_type, provider_model_id,
  availability_status, pricing_ref, rate_limit_ref, metadata, source_last_verified_at
) VALUES (
  'o3-mini-openai', 'o3-mini', 'openai', 'o3-mini',
  'available', 'openai-o3-mini', null, null, null
)
ON CONFLICT (id) DO UPDATE SET
  provider_model_id = EXCLUDED.provider_model_id,
  availability_status = EXCLUDED.availability_status,
  pricing_ref = EXCLUDED.pricing_ref,
  rate_limit_ref = EXCLUDED.rate_limit_ref,
  metadata = EXCLUDED.metadata,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO provider_model_variants (
  id, model_id, provider_integration_type, provider_model_id,
  availability_status, pricing_ref, rate_limit_ref, metadata, source_last_verified_at
) VALUES (
  'claude-3-5-haiku-anthropic', 'claude-3-5-haiku', 'anthropic', 'claude-3-5-haiku-20241022',
  'available', 'anthropic-claude-3-5-haiku', null, null, null
)
ON CONFLICT (id) DO UPDATE SET
  provider_model_id = EXCLUDED.provider_model_id,
  availability_status = EXCLUDED.availability_status,
  pricing_ref = EXCLUDED.pricing_ref,
  rate_limit_ref = EXCLUDED.rate_limit_ref,
  metadata = EXCLUDED.metadata,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO provider_model_variants (
  id, model_id, provider_integration_type, provider_model_id,
  availability_status, pricing_ref, rate_limit_ref, metadata, source_last_verified_at
) VALUES (
  'claude-3-opus-20240229-anthropic', 'claude-3-opus-20240229', 'anthropic', 'claude-3-opus-20240229',
  'available', 'anthropic-claude-3-opus', null, null, null
)
ON CONFLICT (id) DO UPDATE SET
  provider_model_id = EXCLUDED.provider_model_id,
  availability_status = EXCLUDED.availability_status,
  pricing_ref = EXCLUDED.pricing_ref,
  rate_limit_ref = EXCLUDED.rate_limit_ref,
  metadata = EXCLUDED.metadata,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO provider_model_variants (
  id, model_id, provider_integration_type, provider_model_id,
  availability_status, pricing_ref, rate_limit_ref, metadata, source_last_verified_at
) VALUES (
  'claude-3-sonnet-20240229-anthropic', 'claude-3-sonnet-20240229', 'anthropic', 'claude-3-sonnet-20240229',
  'available', 'anthropic-claude-3-sonnet', null, null, null
)
ON CONFLICT (id) DO UPDATE SET
  provider_model_id = EXCLUDED.provider_model_id,
  availability_status = EXCLUDED.availability_status,
  pricing_ref = EXCLUDED.pricing_ref,
  rate_limit_ref = EXCLUDED.rate_limit_ref,
  metadata = EXCLUDED.metadata,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO provider_model_variants (
  id, model_id, provider_integration_type, provider_model_id,
  availability_status, pricing_ref, rate_limit_ref, metadata, source_last_verified_at
) VALUES (
  'claude-3-haiku-20240307-anthropic', 'claude-3-haiku-20240307', 'anthropic', 'claude-3-haiku-20240307',
  'available', 'anthropic-claude-3-haiku', null, null, null
)
ON CONFLICT (id) DO UPDATE SET
  provider_model_id = EXCLUDED.provider_model_id,
  availability_status = EXCLUDED.availability_status,
  pricing_ref = EXCLUDED.pricing_ref,
  rate_limit_ref = EXCLUDED.rate_limit_ref,
  metadata = EXCLUDED.metadata,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO provider_model_variants (
  id, model_id, provider_integration_type, provider_model_id,
  availability_status, pricing_ref, rate_limit_ref, metadata, source_last_verified_at
) VALUES (
  'gemini-2.0-flash-exp-google', 'gemini-2.0-flash-exp', 'google', 'gemini-2.0-flash-exp',
  'available', 'google-gemini-2-0-flash-exp', null, null, null
)
ON CONFLICT (id) DO UPDATE SET
  provider_model_id = EXCLUDED.provider_model_id,
  availability_status = EXCLUDED.availability_status,
  pricing_ref = EXCLUDED.pricing_ref,
  rate_limit_ref = EXCLUDED.rate_limit_ref,
  metadata = EXCLUDED.metadata,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO provider_model_variants (
  id, model_id, provider_integration_type, provider_model_id,
  availability_status, pricing_ref, rate_limit_ref, metadata, source_last_verified_at
) VALUES (
  'gemini-1.5-pro-google', 'gemini-1.5-pro', 'google', 'gemini-1.5-pro',
  'available', 'google-gemini-1-5-pro', null, null, null
)
ON CONFLICT (id) DO UPDATE SET
  provider_model_id = EXCLUDED.provider_model_id,
  availability_status = EXCLUDED.availability_status,
  pricing_ref = EXCLUDED.pricing_ref,
  rate_limit_ref = EXCLUDED.rate_limit_ref,
  metadata = EXCLUDED.metadata,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO provider_model_variants (
  id, model_id, provider_integration_type, provider_model_id,
  availability_status, pricing_ref, rate_limit_ref, metadata, source_last_verified_at
) VALUES (
  'gemini-1.5-flash-google', 'gemini-1.5-flash', 'google', 'gemini-1.5-flash',
  'available', 'google-gemini-1-5-flash', null, null, null
)
ON CONFLICT (id) DO UPDATE SET
  provider_model_id = EXCLUDED.provider_model_id,
  availability_status = EXCLUDED.availability_status,
  pricing_ref = EXCLUDED.pricing_ref,
  rate_limit_ref = EXCLUDED.rate_limit_ref,
  metadata = EXCLUDED.metadata,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO provider_model_variants (
  id, model_id, provider_integration_type, provider_model_id,
  availability_status, pricing_ref, rate_limit_ref, metadata, source_last_verified_at
) VALUES (
  'gemini-1.5-flash-8b-google', 'gemini-1.5-flash-8b', 'google', 'gemini-1.5-flash-8b',
  'available', 'google-gemini-1-5-flash-8b', null, null, null
)
ON CONFLICT (id) DO UPDATE SET
  provider_model_id = EXCLUDED.provider_model_id,
  availability_status = EXCLUDED.availability_status,
  pricing_ref = EXCLUDED.pricing_ref,
  rate_limit_ref = EXCLUDED.rate_limit_ref,
  metadata = EXCLUDED.metadata,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

INSERT INTO provider_model_variants (
  id, model_id, provider_integration_type, provider_model_id,
  availability_status, pricing_ref, rate_limit_ref, metadata, source_last_verified_at
) VALUES (
  'gemini-1.0-pro-google', 'gemini-1.0-pro', 'google', 'gemini-1.0-pro',
  'available', 'google-gemini-1-0-pro', null, null, null
)
ON CONFLICT (id) DO UPDATE SET
  provider_model_id = EXCLUDED.provider_model_id,
  availability_status = EXCLUDED.availability_status,
  pricing_ref = EXCLUDED.pricing_ref,
  rate_limit_ref = EXCLUDED.rate_limit_ref,
  metadata = EXCLUDED.metadata,
  source_last_verified_at = EXCLUDED.source_last_verified_at;

COMMIT;
