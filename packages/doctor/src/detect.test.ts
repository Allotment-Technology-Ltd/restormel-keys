import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { detectFramework } from "./detect.js";
import { readFile } from "fs/promises";
import { existsSync } from "fs";

vi.mock("fs/promises", () => ({ readFile: vi.fn() }));
vi.mock("fs", () => ({ existsSync: vi.fn() }));

describe("detectFramework", () => {
  beforeEach(() => {
    vi.spyOn(process, "cwd").mockReturnValue("/cwd");
    vi.mocked(existsSync).mockReturnValue(false);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("detects SvelteKit with optional UI only for keys-svelte", async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ dependencies: { "@sveltejs/kit": "2.0.0" } }));
    vi.mocked(existsSync).mockImplementation((p: string) => p.endsWith("package.json"));
    const r = await detectFramework();
    expect(r.id).toBe("sveltekit");
    expect(r.corePackages).toEqual(["@restormel/keys"]);
    expect(r.optionalUiPackages).toEqual(["@restormel/keys-svelte"]);
  });
});
