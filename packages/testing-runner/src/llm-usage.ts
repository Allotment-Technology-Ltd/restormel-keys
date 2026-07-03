/**
 * OpenAI-compatible chat.completions `usage` (and common aliases).
 */
export type LlmTokenUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export function extractChatCompletionUsage(data: unknown): LlmTokenUsage | undefined {
  if (data === null || typeof data !== "object") return undefined;
  const o = data as Record<string, unknown>;
  const u = o.usage;
  if (u === null || typeof u !== "object") return undefined;
  const usage = u as Record<string, unknown>;
  const prompt =
    (typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : undefined) ??
    (typeof usage.input_tokens === "number" ? usage.input_tokens : undefined);
  const completion =
    (typeof usage.completion_tokens === "number" ? usage.completion_tokens : undefined) ??
    (typeof usage.output_tokens === "number" ? usage.output_tokens : undefined);
  const total = typeof usage.total_tokens === "number" ? usage.total_tokens : undefined;
  if (prompt === undefined && completion === undefined && total === undefined) return undefined;
  return {
    promptTokens: prompt,
    completionTokens: completion,
    totalTokens: total,
  };
}
