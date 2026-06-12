import { describe, it, expect } from "vitest";
import {
  encodeRunsCursor,
  pageWithCursor,
  showingLabel,
  type CursorRow,
} from "./ingest-runs-pagination";

function row(id: string, createdAtMs: number): CursorRow {
  return { id, createdAt: createdAtMs };
}

describe("encodeRunsCursor", () => {
  it("encodes createdAtIso|id as base64url and round-trips to the keyset components", () => {
    const ms = Date.parse("2026-06-12T10:00:00.000Z");
    const cursor = encodeRunsCursor(row("abc", ms));
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    expect(decoded).toBe("2026-06-12T10:00:00.000Z|abc");
  });
  it("accepts an ISO createdAt string too", () => {
    const cursor = encodeRunsCursor({ id: "x", createdAt: "2026-06-12T10:00:00.000Z" });
    expect(Buffer.from(cursor, "base64url").toString("utf8")).toBe("2026-06-12T10:00:00.000Z|x");
  });
});

describe("pageWithCursor", () => {
  const base = Date.parse("2026-06-12T10:00:00.000Z");
  const rows = Array.from({ length: 21 }, (_, i) => row(`r${i}`, base - i * 1000));

  it("slices to the limit and mints a next cursor when limit+1 rows are present", () => {
    const { page, nextCursor } = pageWithCursor(rows, 20);
    expect(page).toHaveLength(20);
    expect(nextCursor).not.toBeNull();
    // The cursor points at the 20th row (last of the page), not the 21st (overflow).
    expect(Buffer.from(nextCursor!, "base64url").toString("utf8")).toContain("|r19");
  });

  it("returns no next cursor on the final page", () => {
    const { page, nextCursor } = pageWithCursor(rows.slice(0, 20), 20);
    expect(page).toHaveLength(20);
    expect(nextCursor).toBeNull();
  });

  it("handles an empty result", () => {
    const { page, nextCursor } = pageWithCursor([], 20);
    expect(page).toEqual([]);
    expect(nextCursor).toBeNull();
  });
});

describe("showingLabel", () => {
  it("is honest about loaded vs total with correct pluralisation", () => {
    expect(showingLabel(20, 57)).toBe("Showing 20 of 57 runs");
    expect(showingLabel(1, 1)).toBe("Showing 1 of 1 run");
    expect(showingLabel(0, 0)).toBe("Showing 0 of 0 runs");
  });
});
