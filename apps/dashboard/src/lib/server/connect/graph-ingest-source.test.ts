import { describe, expect, it } from "vitest";
import { GRAPH_UNIT_SOURCE_REQUIRED, requireGraphUnitSourceId } from "./graph-ingest-source";

describe("requireGraphUnitSourceId", () => {
  it("returns trimmed source ids", () => {
    expect(requireGraphUnitSourceId("  abc-123  ")).toBe("abc-123");
  });

  it("rejects missing source ids", () => {
    expect(() => requireGraphUnitSourceId(null)).toThrow(GRAPH_UNIT_SOURCE_REQUIRED);
    expect(() => requireGraphUnitSourceId("   ")).toThrow(GRAPH_UNIT_SOURCE_REQUIRED);
  });
});
