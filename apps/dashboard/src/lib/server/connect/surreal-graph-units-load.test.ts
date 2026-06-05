import { describe, expect, it } from "vitest";
import {
  pickSurrealUnitText,
  surrealExplorerUnitsQuery,
  surrealRevalidateUnitsQuery,
} from "./surreal-graph-units-load";

describe("pickSurrealUnitText", () => {
  it("reads legacy statement field", () => {
    expect(pickSurrealUnitText({ statement: "  Socrates is mortal  " })).toBe("Socrates is mortal");
  });

  it("prefers text when present", () => {
    expect(pickSurrealUnitText({ text: "a", statement: "b" })).toBe("a");
  });
});

describe("surrealExplorerUnitsQuery", () => {
  it("minimal query avoids optional schema fields", () => {
    const sql = surrealExplorerUnitsQuery("claim", 100, 0, "minimal");
    expect(sql).not.toContain("unit_type");
    expect(sql).not.toContain("source_kind");
  });
});

describe("surrealRevalidateUnitsQuery", () => {
  it("paginates with FETCH source", () => {
    const sql = surrealRevalidateUnitsQuery("unit", 200, 400, true);
    expect(sql).toContain("FETCH source");
    expect(sql).toContain("LIMIT 200 START 400");
  });
});
