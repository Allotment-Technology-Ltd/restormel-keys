import { describe, expect, it } from "vitest";
import {
  deriveProvenanceVerdict,
  provenanceAuditHeadline,
} from "./graph-provenance-audit";

describe("deriveProvenanceVerdict", () => {
  it("returns native when no edge repair is needed", () => {
    expect(
      deriveProvenanceVerdict({ totalUnits: 34_000, needsEdgeRepair: 0, store: "surreal" }),
    ).toBe("native");
  });

  it("returns unknown when aggregates could not be read", () => {
    expect(
      deriveProvenanceVerdict({
        totalUnits: 34_000,
        needsEdgeRepair: 0,
        store: "surreal",
        aggregatesOk: false,
      }),
    ).toBe("unknown");
  });

  it("returns needs_edge_repair when unlinked or legacy ideas remain", () => {
    expect(
      deriveProvenanceVerdict({ totalUnits: 100, needsEdgeRepair: 3, store: "surreal" }),
    ).toBe("needs_edge_repair");
  });
});

describe("provenanceAuditHeadline", () => {
  it("describes graph-native provenance without pipeline catalog", () => {
    const line = provenanceAuditHeadline({
      verdict: "native",
      graphLinked: 34_000,
      needsEdgeRepair: 0,
      pipelineCatalogSources: 0,
      store: "surreal",
    });
    expect(line).toContain("34,000");
    expect(line).toContain("import sources");
  });
});
