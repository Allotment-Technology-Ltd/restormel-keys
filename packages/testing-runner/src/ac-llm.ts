import type { ResolvedModel } from "@restormel/testing-keys-adapter";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function redactForLog(s: string): string {
  return s.replace(/\bBearer\s+[\w-_.]+\b/gi, "Bearer [redacted]").replace(/\bsk-[a-zA-Z0-9]{10,}\b/g, "sk-[redacted]");
}

/**
 * OpenAI-compatible chat/completions call (same transport as judge rubric).
 */
export async function postChatCompletions(
  model: ResolvedModel,
  messages: ChatMessage[],
  options?: { maxTokens?: number; temperature?: number },
): Promise<{ ok: true; content: string } | { ok: false; summary: string }> {
  const base = model.providerBaseUrl?.replace(/\/?$/, "") ?? "https://api.openai.com/v1";
  const url = `${base}/chat/completions`;
  const maxTokens = options?.maxTokens ?? 400;
  const temperature = options?.temperature ?? 0;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${model.credentials.apiKey}`,
      },
      body: JSON.stringify({
        model: model.modelId,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return {
        ok: false,
        summary: `LLM HTTP ${res.status} ${redactForLog(t).slice(0, 120)}`,
      };
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!content) {
      return { ok: false, summary: "Empty model response" };
    }
    return { ok: true, content };
  } catch (e) {
    return {
      ok: false,
      summary: `LLM error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
