import { describe, expect, it, vi } from "vitest";
import { extractCreatedRecordId, formatSurrealRecordId, surrealRecordRef } from "./graph-writer";

vi.mock("$lib/server/connect/surreal-graph-store", () => ({
  buildWorkspaceGraphStore: vi.fn(),
}));

describe("formatSurrealRecordId", () => {
  it("parses string record ids", () => {
    expect(formatSurrealRecordId("claim:abc123")).toBe("claim:abc123");
  });

  it("parses RecordId objects from Surreal HTTP responses", () => {
    expect(formatSurrealRecordId({ tb: "claim", id: "abc123" })).toBe("claim:abc123");
  });

  it("parses rows with nested id field", () => {
    expect(formatSurrealRecordId({ id: "claim:abc123", text: "hello" })).toBe("claim:abc123");
  });
});

describe("extractCreatedRecordId", () => {
  it("returns null for empty results", () => {
    expect(extractCreatedRecordId([])).toBeNull();
  });
});

describe("surrealRecordRef", () => {
  it("leaves simple ids unquoted", () => {
    expect(surrealRecordRef("claim:abc123")).toBe("claim:abc123");
  });

  it("backtick-wraps ids with special characters", () => {
    expect(surrealRecordRef("claim:⟨uuid⟩")).toBe("`claim:⟨uuid⟩`");
  });
});

describe("SurrealGraphWriter.setEvidence — temporal validity (Stage 3.3)", () => {
  it("stamps valid_from opportunistically on each unit and defines the field first", async () => {
    const queries: string[] = [];
    const store = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.startsWith("UPDATE")) return [{ evidence_status: "bound" }];
        return [];
      }),
      isDatabaseUnavailable: () => false,
    };
    const { buildWorkspaceGraphStore } = await import("$lib/server/connect/surreal-graph-store");
    vi.mocked(buildWorkspaceGraphStore).mockResolvedValue(store as never);
    const { buildGraphWriter } = await import("./graph-writer");

    const writer = await buildGraphWriter(
      { provider: "surreal" } as never,
      { graph_schema: { unit_table: "claim" } } as never,
      { workspaceId: "ws-1", domainPackId: null, id: "job-1" },
    );
    expect(writer).not.toBeNull();

    const res = await writer!.setEvidence({
      sourceHash: "h".repeat(64),
      bindings: [
        {
          unitId: "claim:a",
          text: "Virtue is a mean.",
          binding: {
            status: "bound",
            span: { quote: "virtue is a mean", start: 10, end: 26, source_hash: "h".repeat(64), match: "exact" },
          },
        },
      ],
    });
    expect(res.persisted).toBe(1);

    // The SCHEMAFULL guard defines valid_from alongside the evidence fields.
    const defineSql = queries.find((q) => q.includes("DEFINE FIELD"));
    expect(defineSql).toContain("valid_from");
    // The MERGE payload stamps the validity-window opening (ISO instant).
    const updateSql = queries.find((q) => q.startsWith("UPDATE"));
    expect(updateSql).toBeDefined();
    const payload = JSON.parse(updateSql!.slice(updateSql!.indexOf("MERGE ") + 6, updateSql!.lastIndexOf(" RETURN")));
    expect(typeof payload.valid_from).toBe("string");
    expect(Number.isNaN(Date.parse(payload.valid_from))).toBe(false);
    // valid_to / superseded_by are NOT written pre-3.2b — nothing ever closes a window
    // on Surreal BYO yet, and as-of retrieval degrades explicitly for these stores.
    expect(payload).not.toHaveProperty("valid_to");
    expect(payload).not.toHaveProperty("superseded_by");
  });
});
