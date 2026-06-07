import { describe, expect, it } from "vitest";
import { graphSourceKeyFromProvenance } from "./graph-source-link-service";
import { extractCreatedRecordId } from "./graph-writer";

describe("graphSourceKeyFromProvenance", () => {
  it("returns graph_source_key when present", () => {
    expect(
      graphSourceKeyFromProvenance({ graph_source_key: "source:abc", source_table: "source" }),
    ).toBe("source:abc");
  });

  it("returns null for missing or invalid keys", () => {
    expect(graphSourceKeyFromProvenance(null)).toBeNull();
    expect(graphSourceKeyFromProvenance({ graph_source_key: "not-a-record" })).toBeNull();
  });
});

describe("extractCreatedRecordId", () => {
  it("parses flat CREATE result rows", () => {
    expect(extractCreatedRecordId([{ id: "source:1" }])).toBe("source:1");
  });

  it("parses nested Surreal HTTP envelopes", () => {
    expect(extractCreatedRecordId([[{ id: { tb: "source", id: "xyz" } }]])).toBe("source:xyz");
  });
});
