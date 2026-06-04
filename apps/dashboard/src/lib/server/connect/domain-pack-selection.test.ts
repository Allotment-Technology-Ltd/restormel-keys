import { describe, expect, it } from "vitest";
import { resolveIngestDocuments } from "./domain-pack-service";

describe("resolveIngestDocuments", () => {
  const docs = [
    { id: "a", status: "parsed" },
    { id: "b", status: "parsed" },
    { id: "c", status: "failed" },
  ];

  it("returns all parsed when selection is null", () => {
    expect(resolveIngestDocuments(docs, null).map((d) => d.id)).toEqual(["a", "b"]);
  });

  it("returns only selected parsed ids", () => {
    expect(resolveIngestDocuments(docs, ["b"]).map((d) => d.id)).toEqual(["b"]);
  });

  it("ignores failed docs even when selected", () => {
    expect(resolveIngestDocuments(docs, ["c"]).map((d) => d.id)).toEqual([]);
  });
});
