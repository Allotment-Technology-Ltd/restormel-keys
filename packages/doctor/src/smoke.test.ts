import { afterEach, describe, expect, it, vi } from "vitest";
import { detectFramework } from "./detect.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("doctor smoke", () => {
  it("detectFramework runs in non-project directory", async () => {
    vi.spyOn(process, "cwd").mockReturnValue("/tmp");
    const res = await detectFramework();
    expect(res).toBeDefined();
    expect(typeof res.name).toBe("string");
  });
});

