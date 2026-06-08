import { describe, it, expect } from "vitest";
import { isAAIFResponse } from "./validate.js";

/** A minimal valid AAIFResponse envelope. */
function validResponse(): Record<string, unknown> {
  return {
    output: "Hello, world.",
    provider: "openai",
    model: "gpt-x",
    cost: 0.0012,
    routing: { reason: "cheapest model meeting the latency constraint" },
  };
}

describe("isAAIFResponse — valid envelopes", () => {
  it("accepts a minimal chat/completion response", () => {
    expect(isAAIFResponse(validResponse())).toBe(true);
  });

  it("accepts an embedding response with a numeric vector", () => {
    expect(isAAIFResponse({ ...validResponse(), output: "[...]", embedding: [0.1, 0.2, 0.3] })).toBe(true);
  });

  it("accepts an explicit outputText alias", () => {
    expect(isAAIFResponse({ ...validResponse(), outputText: "Hello, world." })).toBe(true);
  });

  it("tolerates unknown/extra fields (forward compatible — e.g. a future version tag)", () => {
    expect(isAAIFResponse({ ...validResponse(), version: "2.0", traceId: "abc" })).toBe(true);
  });
});

describe("isAAIFResponse — invalid envelopes", () => {
  it("rejects null and undefined", () => {
    expect(isAAIFResponse(null)).toBe(false);
    expect(isAAIFResponse(undefined)).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isAAIFResponse("a string")).toBe(false);
    expect(isAAIFResponse(42)).toBe(false);
    expect(isAAIFResponse(["array"])).toBe(false);
    expect(isAAIFResponse(true)).toBe(false);
  });

  it("rejects an empty object", () => {
    expect(isAAIFResponse({})).toBe(false);
  });

  it("rejects a missing or wrong-typed output", () => {
    const { output: _omit, ...noOutput } = validResponse();
    expect(isAAIFResponse(noOutput)).toBe(false);
    expect(isAAIFResponse({ ...validResponse(), output: 123 })).toBe(false);
  });

  it("rejects missing provider / model / cost", () => {
    for (const field of ["provider", "model", "cost"]) {
      const r = validResponse();
      delete r[field];
      expect(isAAIFResponse(r)).toBe(false);
    }
  });

  it("rejects a non-numeric cost", () => {
    expect(isAAIFResponse({ ...validResponse(), cost: "free" })).toBe(false);
  });

  it("rejects an embedding containing non-numbers", () => {
    expect(isAAIFResponse({ ...validResponse(), embedding: [0.1, "x", 0.3] })).toBe(false);
    expect(isAAIFResponse({ ...validResponse(), embedding: "not-an-array" })).toBe(false);
  });

  it("rejects a missing or malformed routing block", () => {
    const { routing: _r, ...noRouting } = validResponse();
    expect(isAAIFResponse(noRouting)).toBe(false);
    expect(isAAIFResponse({ ...validResponse(), routing: null })).toBe(false);
    expect(isAAIFResponse({ ...validResponse(), routing: {} })).toBe(false); // missing reason
    expect(isAAIFResponse({ ...validResponse(), routing: { reason: 5 } })).toBe(false);
  });

  it("rejects a wrong-typed outputText alias", () => {
    expect(isAAIFResponse({ ...validResponse(), outputText: 7 })).toBe(false);
  });
});
