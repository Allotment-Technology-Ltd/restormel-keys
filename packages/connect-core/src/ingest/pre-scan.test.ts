import { describe, expect, it } from "vitest";
import { runSourcePreScan } from "./pre-scan.js";

describe("runSourcePreScan", () => {
  it("blocks PDF mime", () => {
    const r = runSourcePreScan({ name: "paper.pdf", mime: "application/pdf" });
    expect(r.blockers).toContain("pdf_binary");
    expect(r.suggestsParserTier).toBe("managed");
  });

  it("warns on large text sources", () => {
    const text = "word ".repeat(100_000);
    const r = runSourcePreScan({ name: "big.txt", text, mime: "text/plain" });
    expect(r.estimatedTokens).toBeGreaterThan(10_000);
    expect(r.warnings.some((w) => w.includes("Large source"))).toBe(true);
  });
});
