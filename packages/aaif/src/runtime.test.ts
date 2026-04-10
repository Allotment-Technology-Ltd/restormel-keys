import { describe, it, expect } from "vitest";
import { createKeys, openaiProvider } from "@restormel/keys";
import type { KeysConfig } from "@restormel/keys";
import type { AAIFRequest } from "./types.js";
import { executeAAIFRequest } from "./runtime.js";

describe("AAIF runtime helpers", () => {
  function makeKeys(): ReturnType<typeof createKeys> {
    const config: KeysConfig = {
      routing: { defaultProvider: "openai" },
      keys: [{ id: "k1", provider: "openai" }],
    } as unknown as KeysConfig;
    return createKeys(config, { providers: [openaiProvider] });
  }

  it("computes cost from token-volume hints and resolves routing", async () => {
    const keys = makeKeys();

    const req: AAIFRequest = {
      input: "hello",
      task: "chat",
      routing: { model: "gpt-4o-mini" },
      constraints: { tokens: { inputTokensM: 2, outputTokensM: 3 }, latency: "balanced", maxCost: 999 },
    };

    const res = await executeAAIFRequest(req, keys);
    expect(res.provider).toBe("openai");
    expect(res.model).toBe("gpt-4o-mini");
    // gpt-4o-mini: input $0.15/M, output $0.6/M → 2*0.15 + 3*0.6 = 2.1
    expect(res.cost).toBeCloseTo(2.1, 6);
    expect(res.output).toBe("hello");
    expect(res.routing.reason).toContain("using BYOK key");
  });

  it("throws when maxCost is exceeded", async () => {
    const keys = makeKeys();

    const req: AAIFRequest = {
      input: "hello",
      task: "chat",
      routing: { model: "gpt-4o-mini" },
      constraints: { tokens: { inputTokensM: 2, outputTokensM: 3 }, maxCost: 1 },
    };

    await expect(executeAAIFRequest(req, keys)).rejects.toThrow(/max_cost_exceeded/);
  });

  it("allows host-provided output generation callback", async () => {
    const keys = makeKeys();

    const req: AAIFRequest = {
      input: "hello",
      task: "chat",
      routing: { model: "gpt-4o-mini" },
      constraints: { tokens: { inputTokensM: 1, outputTokensM: 1 } },
    };

    const res = await executeAAIFRequest(req, keys, {
      generate: ({ cost }) => `out(cost=${cost.toFixed(2)})`,
    });

    expect(res.output).toMatch(/out\(cost=/);
  });

  it("returns typed embedding when options.embedding is set", async () => {
    const keys = makeKeys();

    const req: AAIFRequest = {
      input: "noop",
      task: "embedding",
      routing: { model: "gpt-4o-mini" },
      constraints: { tokens: { inputTokensM: 0.1, outputTokensM: 0.1 }, maxCost: 999 },
    };

    const vec = [0.1, 0.2, 0.3];
    const res = await executeAAIFRequest(req, keys, { embedding: vec });

    expect(res.embedding).toEqual(vec);
    expect(res.output).toContain("0.1");
    expect(res.outputText).toBeUndefined();
  });

  it("sets outputText for chat tasks", async () => {
    const keys = makeKeys();

    const req: AAIFRequest = {
      input: "hello",
      task: "chat",
      routing: { model: "gpt-4o-mini" },
      constraints: { tokens: { inputTokensM: 1, outputTokensM: 1 }, maxCost: 999 },
    };

    const res = await executeAAIFRequest(req, keys);
    expect(res.outputText).toBe("hello");
  });
});

