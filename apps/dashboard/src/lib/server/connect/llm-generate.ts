/**
 * Shared LLM text/JSON generation for Knowledge features (Graph Designer,
 * extraction preview, full extraction). Uses the dashboard's configured OpenAI
 * access (same as Restormel Support). Kept small and injectable so knowledge-core
 * stays provider-agnostic.
 */
import type { ExtractionGenerate, EmbeddingPort } from "@restormel/connect-core";

export function isLlmConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function knowledgeLlmModel(): string {
  return (
    process.env.RESTORMEL_CONNECT_DESIGNER_MODEL?.trim() ||
    process.env.RESTORMEL_SUPPORT_MODEL?.trim() ||
    "gpt-4o-mini"
  );
}

export class LlmNotConfiguredError extends Error {}

/**
 * Hard per-request deadline for legacy (non-route) LLM calls. The route path
 * (postOpenAiCompatibleChat) already aborts at 180s; without this the legacy fetch
 * could hang on a wedged upstream connection forever and the whole ingest run with
 * it — the job stays "running" with no progress and no error.
 */
export function connectLlmTimeoutMs(): number {
  const raw = Number(process.env.CONNECT_LLM_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 180_000;
}

/** Embedding requests are smaller; default to a tighter deadline (env-overridable). */
export function connectEmbedTimeoutMs(): number {
  const raw = Number(process.env.CONNECT_EMBED_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 120_000;
}

function timeoutMessage(kind: string, ms: number): string {
  return `${kind} request timed out after ${ms}ms`;
}

/** Single chat completion. `jsonMode` requests strict JSON output. */
export async function generateChat(input: {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
  jsonMode?: boolean;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new LlmNotConfiguredError("OPENAI_API_KEY is not configured");
  const timeoutMs = connectLlmTimeoutMs();
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: input.model ?? knowledgeLlmModel(),
        temperature: input.temperature ?? 0.1,
        ...(input.jsonMode ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new Error(timeoutMessage("LLM", timeoutMs));
    }
    throw e;
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LLM request failed (HTTP ${res.status}). ${detail.slice(0, 160)}`.trim());
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

/** An ExtractionGenerate bound to the dashboard's OpenAI access (JSON mode, default model). */
export const knowledgeExtractionGenerate: ExtractionGenerate = ({ system, user }) =>
  generateChat({ system, user, jsonMode: true });

/** Generate JSON trying each model in order, falling back on failure. */
export async function generateWithModels(input: {
  system: string;
  user: string;
  models?: string[];
}): Promise<string> {
  const models = input.models && input.models.length > 0 ? input.models : [knowledgeLlmModel()];
  let lastErr: unknown;
  for (const model of models) {
    try {
      return await generateChat({ system: input.system, user: input.user, model, jsonMode: true });
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("All models failed");
}

/** Build an ExtractionGenerate bound to a stage's model fallback chain. */
export function makeStageGenerate(models?: string[]): ExtractionGenerate {
  return ({ system, user }) => generateWithModels({ system, user, models });
}

function embeddingModel(): string {
  return process.env.RESTORMEL_CONNECT_EMBED_MODEL?.trim() || "text-embedding-3-small";
}

/** Embed texts via OpenAI embeddings (batched) with a specific model. */
export async function knowledgeEmbed(texts: string[], model?: string): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new LlmNotConfiguredError("OPENAI_API_KEY is not configured");
  if (texts.length === 0) return [];
  const useModel = model?.trim() || embeddingModel();
  const out: number[][] = [];
  const BATCH = 96;
  const timeoutMs = connectEmbedTimeoutMs();
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    let res: Response;
    try {
      res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: useModel, input: batch }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
        throw new Error(timeoutMessage("Embedding", timeoutMs));
      }
      throw e;
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Embedding request failed (HTTP ${res.status}). ${detail.slice(0, 160)}`.trim());
    }
    const data = (await res.json()) as { data?: { embedding: number[] }[] };
    for (const item of data.data ?? []) out.push(item.embedding);
  }
  return out;
}

/** Build an embedder bound to a stage's embedding-model fallback chain. */
export function makeEmbedder(models?: string[]): EmbeddingPort {
  const chain = models && models.length > 0 ? models : [embeddingModel()];
  return async (texts: string[]) => {
    let lastErr: unknown;
    for (const model of chain) {
      try {
        return await knowledgeEmbed(texts, model);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("All embedding models failed");
  };
}
