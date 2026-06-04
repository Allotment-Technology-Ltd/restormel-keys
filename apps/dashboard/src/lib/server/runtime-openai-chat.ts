/**
 * OpenAI-compatible POST /v1/chat/completions for hosted runtime invoke (Phase 1).
 * Provider base URLs are explicit; expand per provider in OpenAPI matrices.
 */
export type ChatMessage = { role: string; content: string };

export type OpenAiChatUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type OpenAiChatSuccess = {
  content: string;
  usage: OpenAiChatUsage;
  rawStatus: number;
};

export type OpenAiChatFailure = {
  errorCode: "upstream_http_error" | "upstream_invalid_json" | "upstream_missing_content";
  httpStatus: number;
  /** Safe for clients; no secrets. */
  message: string;
};

/** Canonical providerType → OpenAI-compatible chat completions base (…/v1). */
export function openAiCompatibleChatBaseUrl(canonicalProvider: string): string | null {
  const k = canonicalProvider.trim().toLowerCase();
  const map: Record<string, string> = {
    openai: "https://api.openai.com/v1",
    openrouter: "https://openrouter.ai/api/v1",
    together: "https://api.together.xyz/v1",
    groq: "https://api.groq.com/openai/v1",
    mistral: "https://api.mistral.ai/v1",
    deepseek: "https://api.deepseek.com/v1",
    vercel: "https://ai-gateway.vercel.sh/v1",
    aizolo: "https://chat.aizolo.com/api/v1",
  };
  return map[k] ?? null;
}

export async function postOpenAiCompatibleChat(args: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  timeoutMs?: number;
  /** Combined with timeout; abort cancels the upstream request (e.g. job cancellation). */
  signal?: AbortSignal;
  jsonMode?: boolean;
}): Promise<{ ok: true; value: OpenAiChatSuccess } | { ok: false; value: OpenAiChatFailure }> {
  const timeoutMs = args.timeoutMs ?? 120_000;
  const url = `${args.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const combined =
    args.signal != null
      ? AbortSignal.any([args.signal, timeoutSignal])
      : timeoutSignal;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: args.model,
        messages: args.messages,
        ...(args.jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: combined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "network_error";
    return {
      ok: false,
      value: {
        errorCode: "upstream_http_error",
        httpStatus: 0,
        message: msg.includes("aborted") || msg.includes("timeout") ? "upstream_timeout" : "upstream_network_error",
      },
    };
  }

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    return {
      ok: false,
      value: {
        errorCode: "upstream_invalid_json",
        httpStatus: res.status,
        message: "upstream_invalid_json",
      },
    };
  }

  if (!res.ok) {
    if (res.status === 429) {
      const retryAfter = res.headers.get("Retry-After");
      const suffix = retryAfter ? `; retry_after_s=${retryAfter}` : "";
      return {
        ok: false,
        value: {
          errorCode: "upstream_http_error",
          httpStatus: 429,
          message: `upstream_rate_limit${suffix}`,
        },
      };
    }
    const errObj = json && typeof json === "object" && json !== null ? (json as Record<string, unknown>) : null;
    const errMsg =
      typeof errObj?.error === "object" && errObj.error !== null
        ? String((errObj.error as { message?: unknown }).message ?? "upstream_error")
        : typeof errObj?.error === "string"
          ? errObj.error
          : typeof errObj?.message === "string"
            ? errObj.message
            : "upstream_error";
    return {
      ok: false,
      value: {
        errorCode: "upstream_http_error",
        httpStatus: res.status,
        message: errMsg.length > 200 ? "upstream_error" : errMsg.replace(/sk-[a-zA-Z0-9-]+/g, "[redacted]"),
      },
    };
  }

  const root = json && typeof json === "object" ? (json as Record<string, unknown>) : null;
  const choices = root?.choices;
  const first =
    Array.isArray(choices) && choices.length > 0 && typeof choices[0] === "object" && choices[0] !== null
      ? (choices[0] as Record<string, unknown>)
      : null;
  const message = first?.message && typeof first.message === "object" ? (first.message as Record<string, unknown>) : null;
  const content = typeof message?.content === "string" ? message.content : null;
  if (content == null) {
    return {
      ok: false,
      value: {
        errorCode: "upstream_missing_content",
        httpStatus: res.status,
        message: "upstream_missing_content",
      },
    };
  }

  const usageRaw = root?.usage && typeof root.usage === "object" ? (root.usage as Record<string, unknown>) : null;
  const usage: OpenAiChatUsage = {
    promptTokens: typeof usageRaw?.prompt_tokens === "number" ? usageRaw.prompt_tokens : undefined,
    completionTokens: typeof usageRaw?.completion_tokens === "number" ? usageRaw.completion_tokens : undefined,
    totalTokens: typeof usageRaw?.total_tokens === "number" ? usageRaw.total_tokens : undefined,
  };

  return {
    ok: true,
    value: {
      content,
      usage,
      rawStatus: res.status,
    },
  };
}
