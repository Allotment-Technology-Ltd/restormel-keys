import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  connectEmbedTimeoutMs,
  connectLlmTimeoutMs,
  generateChat,
  knowledgeEmbed,
} from "./llm-generate";

const okChatResponse = {
  ok: true,
  json: async () => ({ choices: [{ message: { content: "hi" } }] }),
} as Response;

const okEmbedResponse = {
  ok: true,
  json: async () => ({ data: [{ embedding: [0.1, 0.2] }] }),
} as Response;

describe("connect LLM timeouts", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "sk-test";
    delete process.env.CONNECT_LLM_TIMEOUT_MS;
    delete process.env.CONNECT_EMBED_TIMEOUT_MS;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
    delete process.env.CONNECT_LLM_TIMEOUT_MS;
    delete process.env.CONNECT_EMBED_TIMEOUT_MS;
  });

  it("defaults to 180s chat / 120s embed and honors env overrides", () => {
    expect(connectLlmTimeoutMs()).toBe(180_000);
    expect(connectEmbedTimeoutMs()).toBe(120_000);
    process.env.CONNECT_LLM_TIMEOUT_MS = "5000";
    process.env.CONNECT_EMBED_TIMEOUT_MS = "4000";
    expect(connectLlmTimeoutMs()).toBe(5000);
    expect(connectEmbedTimeoutMs()).toBe(4000);
    process.env.CONNECT_LLM_TIMEOUT_MS = "not-a-number";
    expect(connectLlmTimeoutMs()).toBe(180_000);
  });

  it("generateChat sends an abort signal so a wedged upstream cannot hang forever", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okChatResponse);
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateChat({ system: "s", user: "u" })).resolves.toBe("hi");
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("generateChat maps an abort into a clear timeout error", async () => {
    const timeoutErr = new Error("aborted");
    timeoutErr.name = "TimeoutError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeoutErr));
    await expect(generateChat({ system: "s", user: "u" })).rejects.toThrow(
      /LLM request timed out after 180000ms/,
    );
  });

  it("knowledgeEmbed sends an abort signal and maps timeouts", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okEmbedResponse);
    vi.stubGlobal("fetch", fetchMock);
    await expect(knowledgeEmbed(["a"])).resolves.toEqual([[0.1, 0.2]]);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);

    const timeoutErr = new Error("aborted");
    timeoutErr.name = "TimeoutError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeoutErr));
    await expect(knowledgeEmbed(["a"])).rejects.toThrow(/Embedding request timed out/);
  });
});
