type OpenRouterActivityItem = {
  date: string;
  model: string;
  model_permaslug: string;
  endpoint_id: string;
  provider_name: string;
  usage: number;
  byok_usage_inference: number;
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  reasoning_tokens: number;
};

export type OpenRouterActivityImportRow = {
  dateUtc: string;
  providerName: string;
  model: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  spendUsd: number;
  byokSpendUsd: number;
};

function parseUtcDayToRange(dateUtc: string): { startMs: number; endMs: number } {
  // dateUtc is YYYY-MM-DD
  const startMs = Date.parse(dateUtc + "T00:00:00.000Z");
  if (!Number.isFinite(startMs)) throw new Error(`Invalid date: ${dateUtc}`);
  return { startMs, endMs: startMs + 24 * 60 * 60 * 1000 };
}

export function parseOpenRouterActivityJson(raw: unknown): OpenRouterActivityImportRow[] {
  const data = (raw as { data?: unknown }).data;
  if (!Array.isArray(data)) throw new Error("Invalid OpenRouter activity JSON: expected { data: [] }");
  const out: OpenRouterActivityImportRow[] = [];
  for (const item of data as OpenRouterActivityItem[]) {
    if (!item || typeof item !== "object") continue;
    if (typeof item.date !== "string" || typeof item.model !== "string" || typeof item.provider_name !== "string") continue;
    out.push({
      dateUtc: item.date,
      providerName: item.provider_name,
      model: item.model,
      requests: Number(item.requests) || 0,
      promptTokens: Number(item.prompt_tokens) || 0,
      completionTokens: Number(item.completion_tokens) || 0,
      reasoningTokens: Number(item.reasoning_tokens) || 0,
      spendUsd: Number(item.usage) || 0,
      byokSpendUsd: Number(item.byok_usage_inference) || 0,
    });
  }
  // Validate dates early
  for (const r of out) parseUtcDayToRange(r.dateUtc);
  return out;
}

export function openRouterActivityToAggregates(rows: OpenRouterActivityImportRow[]): Array<{
  granularity: "day";
  periodStart: number;
  periodEnd: number;
  providerType: string;
  modelId: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}> {
  // OpenRouter data is already aggregated per day+model+provider; we keep it as-is.
  const out = [];
  for (const r of rows) {
    const { startMs, endMs } = parseUtcDayToRange(r.dateUtc);
    out.push({
      granularity: "day" as const,
      periodStart: startMs,
      periodEnd: endMs,
      providerType: r.providerName,
      modelId: r.model,
      requestCount: r.requests,
      inputTokens: r.promptTokens,
      outputTokens: r.completionTokens,
      estimatedCost: r.spendUsd + r.byokSpendUsd,
    });
  }
  return out;
}

