import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { detectFramework } from "./detect.js";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

vi.mock("fs/promises", () => ({ readFile: vi.fn() }));
vi.mock("fs", () => ({ existsSync: vi.fn() }));

describe("detectFramework", () => {
  beforeEach(() => {
    vi.mocked(existsSync).mockReturnValue(false);
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns none when package.json missing", async () => {
    vi.mocked(existsSync).mockImplementation((p: string) => !p.endsWith("package.json"));
    const r = await detectFramework("/cwd");
    expect(r.id).toBe("none");
    expect(r.name).toBe("None");
  });

  it("detects Next.js with App Router when app/layout.tsx exists", async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ dependencies: { next: "14.0.0" } }));
    vi.mocked(existsSync).mockImplementation((p: string) => {
      if (p.endsWith("package.json")) return true;
      if (p.includes("app/layout.tsx")) return true;
      return false;
    });
    const r = await detectFramework("/cwd");
    expect(r.id).toBe("next");
    expect(r.hasAppRouter).toBe(true);
    expect(r.packagePaths).toContain("@restormel/keys-react");
  });

  it("detects Next.js without App Router when no app/ layout", async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ dependencies: { next: "14.0.0" } }));
    vi.mocked(existsSync).mockImplementation((p: string) => p.endsWith("package.json"));
    const r = await detectFramework("/cwd");
    expect(r.id).toBe("next");
    expect(r.hasAppRouter).toBeFalsy();
  });

  it("detects React when react in dependencies", async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ dependencies: { react: "18.0.0" } }));
    vi.mocked(existsSync).mockImplementation((p: string) => p.endsWith("package.json"));
    const r = await detectFramework("/cwd");
    expect(r.id).toBe("react");
    expect(r.packagePaths).toContain("@restormel/keys-react");
  });

  it("detects SvelteKit", async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ dependencies: { "@sveltejs/kit": "2.0.0" } }));
    vi.mocked(existsSync).mockImplementation((p: string) => p.endsWith("package.json"));
    const r = await detectFramework("/cwd");
    expect(r.id).toBe("sveltekit");
    expect(r.packagePaths).toContain("@restormel/keys-svelte");
  });

  it("detects Astro", async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ dependencies: { astro: "4.0.0" } }));
    vi.mocked(existsSync).mockImplementation((p: string) => p.endsWith("package.json"));
    const r = await detectFramework("/cwd");
    expect(r.id).toBe("astro");
    expect(r.packagePaths).toContain("@restormel/keys-elements");
  });
});
