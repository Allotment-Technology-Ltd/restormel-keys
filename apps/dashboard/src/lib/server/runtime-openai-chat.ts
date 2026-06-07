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

/** Raised by {@link streamOpenAiCompatibleChat} with a client-safe (no-secret) message. */
export class OpenAiChatStreamError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
  ) {
    super(message);
    this.name = "OpenAiChatStreamError";
  }
}

function redactSecrets(text: string): string {
  return text.replace(/sk-[a-zA-Z0-9-]+/g, "[redacted]");
}

/**
 * Streaming counterpart of {@link postOpenAiCompatibleChat}: posts with `stream: true`
 * and yields assistant text deltas as they arrive over the OpenAI-compatible SSE wire
 * (`data: {choices:[{delta:{content}}]}` … `data: [DONE]`). Throws {@link OpenAiChatStreamError}
 * with a redacted message on any upstream failure. No npm SDK — raw fetch + SSE parse so we
 * stay aligned with the existing BYOK chat path and add zero dependencies.
 */
export async function* streamOpenAiCompatibleChat(args: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  timeoutMs?: number;
  signal?: AbortSignal;
}): AsyncGenerator<string, void, unknown> {
  const timeoutMs = args.timeoutMs ?? 120_000;
  const url = `${args.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const combined =
    args.signal != null ? AbortSignal.any([args.signal, timeoutSignal]) : timeoutSignal;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: args.model, messages: args.messages, stream: true }),
      signal: combined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "network_error";
    const friendly =
      msg.includes("aborted") || msg.includes("timeout")
        ? "upstream_timeout"
        : "upstream_network_error";
    throw new OpenAiChatStreamError(friendly, 0);
  }

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    if (res.status === 429) {
      const retryAfter = res.headers.get("Retry-After");
      throw new OpenAiChatStreamError(
        `upstream_rate_limit${retryAfter ? `; retry_after_s=${retryAfter}` : ""}`,
        429,
      );
    }
    let message = "upstream_error";
    try {
      const parsed = JSON.parse(detail) as Record<string, unknown>;
      const err = parsed.error;
      if (err && typeof err === "object" && typeof (err as { message?: unknown }).message === "string") {
        message = (err as { message: string }).message;
      } else if (typeof parsed.message === "string") {
        message = parsed.message;
      }
    } catch {
      /* non-JSON error body; keep generic */
    }
    throw new OpenAiChatStreamError(redactSecrets(message).slice(0, 200), res.status || 0);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    // SSE frames are separated by a blank line; process complete frames only.
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const rawLine = buffer.slice(0, idx).replace(/\r$/, "");
      buffer = buffer.slice(idx + 1);
      const line = rawLine.trim();
      if (!line || line.startsWith(":")) continue; // keep-alive / comment
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return;
      let json: { choices?: Array<{ delta?: { content?: unknown } }> };
      try {
        json = JSON.parse(payload);
      } catch {
        continue; // partial/non-JSON keep-alive
      }
      const delta = json.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta.length > 0) yield delta;
    }
  }
}
