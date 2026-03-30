import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readConfig, writeConfig, CONFIG_FILENAME } from "./config.js";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

vi.mock("fs/promises");
vi.mock("fs", () => ({ existsSync: vi.fn() }));

const cwd = "/tmp/test-cwd";

describe("config", () => {
  beforeEach(() => {
    vi.spyOn(process, "cwd").mockReturnValue(cwd);
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readFile).mockRejectedValue(new Error("not found"));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("readConfig returns null when file missing", async () => {
    const r = await readConfig();
    expect(r).toBeNull();
  });

  it("readConfig returns parsed config when file exists", async () => {
    vi.mocked(existsSync).mockImplementation((p: string) => p === join(cwd, CONFIG_FILENAME));
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ framework: "next", providers: ["openai"] }));
    const r = await readConfig();
    expect(r).toEqual({ framework: "next", providers: ["openai"] });
  });

  it("writeConfig writes JSON", async () => {
    await writeConfig({ framework: "react", providers: ["anthropic"] });
    expect(writeFile).toHaveBeenCalledWith(
      join(cwd, CONFIG_FILENAME),
      expect.stringContaining('"framework": "react"'),
      "utf-8"
    );
  });
});
