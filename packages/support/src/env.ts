/** Server env shape for Restormel Support (host passes \`process.env\` or a test stub). */
export type SupportRuntimeEnv = Record<string, string | undefined>;

/**
 * \`RESTORMEL_SUPPORT_ENABLED\` must not be the string \`false\`.
 * \`OPENAI_API_KEY\` must be non-empty when using the default OpenAI adapter.
 */
export function isSupportRuntimeConfigured(env: SupportRuntimeEnv): boolean {
  const disabled = (env.RESTORMEL_SUPPORT_ENABLED ?? "").trim().toLowerCase() === "false";
  if (disabled) return false;
  const key = (env.OPENAI_API_KEY ?? "").trim();
  return key.length > 0;
}

export function supportModelFromEnv(env: SupportRuntimeEnv): string {
  const m = (env.RESTORMEL_SUPPORT_MODEL ?? "").trim();
  return m || "gpt-4o-mini";
}
