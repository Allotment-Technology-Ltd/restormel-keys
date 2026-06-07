import { describe, expect, it } from "vitest";
import { extractCreatedRecordId, formatSurrealRecordId, surrealRecordRef } from "./graph-writer";

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
