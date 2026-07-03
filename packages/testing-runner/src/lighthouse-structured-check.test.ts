import { describe, expect, it } from "vitest";

import { lighthouseMinScore01, parseLighthouseStructuredPath } from "./lighthouse-structured-check.js";

describe("parseLighthouseStructuredPath", () => {
  it("parses single-category aliases", () => {
    expect(parseLighthouseStructuredPath("lighthouse:performance")).toEqual(["performance"]);
    expect(parseLighthouseStructuredPath("LH:SEO")).toEqual(["seo"]);
    expect(parseLighthouseStructuredPath("lh:best-practices")).toEqual(["best-practices"]);
  });

  it("parses full bundle", () => {
    expect(parseLighthouseStructuredPath("lighthouse:full")).toEqual([
      "performance",
      "accessibility",
      "best-practices",
      "seo",
    ]);
    expect(parseLighthouseStructuredPath("lh:all")).toEqual([
      "performance",
      "accessibility",
      "best-practices",
      "seo",
    ]);
  });

  it("returns null for unrelated paths", () => {
    expect(parseLighthouseStructuredPath("css:body")).toBeNull();
    expect(parseLighthouseStructuredPath("lighthouse:nope")).toBeNull();
  });
});

describe("lighthouseMinScore01", () => {
  it("defaults to 0.5", () => {
    expect(lighthouseMinScore01(undefined)).toBe(0.5);
  });

  it("accepts 0–100 as percent", () => {
    expect(lighthouseMinScore01(80)).toBe(0.8);
    expect(lighthouseMinScore01(100)).toBe(1);
  });

  it("accepts 0–1 fraction", () => {
    expect(lighthouseMinScore01(0.9)).toBe(0.9);
    expect(lighthouseMinScore01(1)).toBe(1);
  });

  it("rejects out of range", () => {
    expect(lighthouseMinScore01(101)).toBeUndefined();
    expect(lighthouseMinScore01(-1)).toBeUndefined();
  });
});
