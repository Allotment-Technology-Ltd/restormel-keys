import { describe, expect, it } from "vitest";
import { parseSupportMessages } from "./messages.js";

describe("parseSupportMessages", () => {
  it("returns null for invalid input", () => {
    expect(parseSupportMessages(null)).toBeNull();
    expect(parseSupportMessages({})).toBeNull();
    expect(parseSupportMessages([])).toBeNull();
  });

  it("accepts user and assistant roles only", () => {
    const m = parseSupportMessages([
      { role: "system", content: "x" },
      { role: "user", content: "hello" },
    ]);
    expect(m).toEqual([{ role: "user", content: "hello" }]);
  });
});
