import { afterEach, describe, expect, it, vi } from "vitest";
import { streamOpenAiCompatibleChat, OpenAiChatStreamError } from "./runtime-openai-chat";

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

async function collect(args: Parameters<typeof streamOpenAiCompatibleChat>[0]): Promise<string[]> {
  const out: string[] = [];
  for await (const delta of streamOpenAiCompatibleChat(args)) out.push(delta);
  return out;
}

const base = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "sk-test",
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "hi" }],
};

afterEach(() => vi.restoreAllMocks());

describe("streamOpenAiCompatibleChat", () => {
  it("yields assistant content deltas and stops at [DONE]", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      sseResponse([
        'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
        "data: [DONE]\n\n",
      ]),
    );
    expect(await collect(base)).toEqual(["Hel", "lo"]);
  });

  it("reassembles frames split across network chunks", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      sseResponse([
        'data: {"choices":[{"del',
        'ta":{"content":"world"}}]}\n\n',
        "data: [DONE]\n\n",
      ]),
    );
    expect(await collect(base)).toEqual(["world"]);
  });

  it("ignores keep-alive comments and empty deltas", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      sseResponse([
        ": keep-alive\n\n",
        'data: {"choices":[{"delta":{}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
        "data: [DONE]\n\n",
      ]),
    );
    expect(await collect(base)).toEqual(["ok"]);
  });

  it("throws a redacted OpenAiChatStreamError on upstream HTTP error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "bad key sk-secret123" } }), { status: 401 }),
    );
    const err = await collect(base).catch((e) => e);
    expect(err).toBeInstanceOf(OpenAiChatStreamError);
    expect((err as Error).message).toMatch(/\[redacted\]/);
  });

  it("surfaces a rate-limit error for HTTP 429", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 429, headers: { "Retry-After": "5" } }),
    );
    await expect(collect(base)).rejects.toThrow(/rate_limit/);
  });
});
