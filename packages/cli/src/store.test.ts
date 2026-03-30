import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readStore, writeStore, maskApiKey } from "./store.js";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

vi.mock("fs/promises");
vi.mock("fs", () => ({ existsSync: vi.fn() }));

const cwd = "/tmp/test-cwd";

describe("store", () => {
  beforeEach(() => {
    vi.spyOn(process, "cwd").mockReturnValue(cwd);
    vi.mocked(existsSync).mockReturnValue(false);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("readStore returns empty when file missing", async () => {
    const r = await readStore();
    expect(r.keys).toEqual([]);
  });

  it("readStore returns keys when file exists", async () => {
    vi.mocked(existsSync).mockImplementation((p: string) => p.includes(".restormel"));
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({ keys: [{ id: "k1", provider: "openai", apiKey: "sk-secret", mask: "sk-...ret" }] })
    );
    const r = await readStore();
    expect(r.keys).toHaveLength(1);
    expect(r.keys[0].provider).toBe("openai");
  });

  it("maskApiKey masks long keys", () => {
    expect(maskApiKey("sk-1234567890abcdef")).toBe("sk-1...cdef");
  });
  it("maskApiKey returns *** for short keys", () => {
    expect(maskApiKey("short")).toBe("***");
  });
});
