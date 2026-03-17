import { describe, expect, it } from "vitest";
import { detectFramework } from "./detect.js";

describe("doctor smoke", () => {
  it("detectFramework runs in non-project directory", async () => {
    const res = await detectFramework("/tmp");
    expect(res).toBeDefined();
    expect(typeof res.name).toBe("string");
  });
});

