import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@restormel/keys", () => ({
  openaiProvider: {
    validateKey: vi.fn().mockResolvedValue({ valid: false, errors: ["Invalid key"] }),
    id: "openai",
    name: "OpenAI",
  },
  anthropicProvider: { id: "anthropic", name: "Anthropic" },
  googleProvider: { id: "google", name: "Google" },
}));

const mockReadStore = vi.fn();
vi.mock("./store.js", () => ({
  readStore: (...args: unknown[]) => mockReadStore(...args),
  STORE_DIR: ".restormel",
  STORE_FILENAME: "key-store.json",
}));

describe("validate exit code", () => {
  beforeEach(() => {
    mockReadStore.mockResolvedValue({
      keys: [{ id: "k1", provider: "openai", apiKey: "sk-x", mask: "sk-...x" }],
    });
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("exits 1 when at least one key is invalid", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
    const { registerValidate } = await import("./commands/validate.js");
    const { Command } = await import("commander");
    const program = new Command();
    registerValidate(program);
    await program.parseAsync(["node", "keys", "validate"], { from: "user" });
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });
});
