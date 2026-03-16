-- Optional seed: a few well-known models so the catalog API returns data before ingestion.
-- Safe to run multiple times (INSERT ... ON CONFLICT DO NOTHING).
-- Run after 004_control_plane_tables.sql.

INSERT INTO models (
  id, canonical_name, family, lifecycle_state, description,
  context_window, max_output_tokens, supports_tools, supports_structured_output,
  modalities, capabilities
) VALUES
  ('gpt-4o', 'gpt-4o', 'gpt-4', 'active', 'GPT-4o: multimodal flagship model.',
   128000, 16384, true, true,
   '["text","vision"]'::jsonb, '["chat","vision","tools"]'::jsonb),
  ('gpt-4o-mini', 'gpt-4o-mini', 'gpt-4', 'active', 'GPT-4o mini: fast and affordable.',
   128000, 16384, true, true,
   '["text","vision"]'::jsonb, '["chat","vision","tools"]'::jsonb),
  ('claude-3-5-sonnet', 'claude-3-5-sonnet', 'claude', 'active', 'Claude 3.5 Sonnet: balanced performance.',
   200000, 8192, true, true,
   '["text"]'::jsonb, '["chat","tools"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO provider_model_variants (
  id, model_id, provider_integration_type, provider_model_id, availability_status
) VALUES
  ('gpt-4o-openai', 'gpt-4o', 'openai', 'gpt-4o', 'available'),
  ('gpt-4o-mini-openai', 'gpt-4o-mini', 'openai', 'gpt-4o-mini', 'available'),
  ('claude-3-5-sonnet-anthropic', 'claude-3-5-sonnet', 'anthropic', 'claude-3-5-sonnet-20241022', 'available')
ON CONFLICT (id) DO NOTHING;
