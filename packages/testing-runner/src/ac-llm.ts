import type { ResolvedModel } from "@restormel/testing-keys-adapter";
import { extractChatCompletionUsage, type LlmTokenUsage } from "./llm-usage.js";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function redactForLog(s: string): string {
  return s.replace(/\bBearer\s+[\w-_.]+\b/gi, "Bearer [redacted]").replace(/\bsk-[a-zA-Z0-9]{10,}\b/g, "sk-[redacted]");
}

export type PostChatResult =
  | { ok: true; content: string; usage?: LlmTokenUsage }
  | { ok: false; summary: string; usage?: LlmTokenUsage };

/**
 * OpenAI-compatible chat/completions call (same transport as judge rubric).
 * Parses `usage` when the provider includes it (prompt_tokens / completion_tokens / total_tokens).
 */
export async function postChatCompletions(
  model: ResolvedModel,
  messages: ChatMessage[],
  options?: { maxTokens?: number; temperature?: number; responseFormat?: "json_object" },
): Promise<PostChatResult> {
  const base = model.providerBaseUrl?.replace(/\/?$/, "") ?? "https://api.openai.com/v1";
  const url = `${base}/chat/completions`;
  const maxTokens = options?.maxTokens ?? 400;
  const temperature = options?.temperature ?? 0;

  const body: Record<string, unknown> = {
    model: model.modelId,
    messages,
    max_tokens: maxTokens,
    temperature,
  };
  if (options?.responseFormat === "json_object") {
    body.response_format = { type: "json_object" };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${model.credentials.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const textBody = await res.text().catch(() => "");
    let data: unknown;
    try {
      data = textBody.length > 0 ? JSON.parse(textBody) : {};
    } catch {
      data = {};
    }
    const usage = extractChatCompletionUsage(data);

    if (!res.ok) {
      return {
        ok: false,
        summary: `LLM HTTP ${res.status} ${redactForLog(textBody).slice(0, 120)}`,
        usage,
      };
    }

    const d = data as { choices?: Array<{ message?: { content?: string } }> };
    const content = d.choices?.[0]?.message?.content?.trim() ?? "";
    if (!content) {
      return { ok: false, summary: "Empty model response", usage };
    }
    return { ok: true, content, usage };
  } catch (e) {
    return {
      ok: false,
      summary: `LLM error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
