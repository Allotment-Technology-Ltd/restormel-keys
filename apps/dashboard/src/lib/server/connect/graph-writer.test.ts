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

/**
 * P2a — write source text to the user's own Surreal store on ingest.
 *
 * An in-memory Surreal-ish store: CREATE captures the record's CONTENT under a generated
 * id (and returns it from RETURN id); SELECT … FROM <id> returns the stored row. Enough to
 * prove the round-trip: writeSource → (user store) → fetchSurrealSourceRecordText resolves
 * the exact bytes back, without a real SurrealDB.
 */
function makeInMemorySurrealStore(table = "source") {
  const rows = new Map<string, Record<string, unknown>>();
  let seq = 0;
  const creates: Record<string, unknown>[] = [];
  const store = {
    query: vi.fn(async (sql: string) => {
      const create = sql.match(/^CREATE\s+(\S+)\s+CONTENT\s+([\s\S]+?)\s+RETURN id;?$/);
      if (create) {
        const tb = create[1]!;
        const content = JSON.parse(create[2]!) as Record<string, unknown>;
        const id = `${tb}:${tb}${++seq}`;
        rows.set(id, { id, ...content });
        creates.push(content);
        return [{ id }];
      }
      const select = sql.match(/FROM\s+(`?)([a-zA-Z0-9_]+:[^\s`;]+)\1\s*;?$/);
      if (sql.startsWith("SELECT") && select) {
        const row = rows.get(select[2]!);
        return row ? [row] : [];
      }
      return [];
    }),
    isDatabaseUnavailable: () => false,
  };
  return { store, rows, creates, table };
}

describe("SurrealGraphWriter.writeSource — P2a source text in the user's store", () => {
  // A complete graph_schema (as ConnectDomainPack always carries via zod defaults) — the
  // resolver touches passage_table / passage_*_field when aggregating, so they must exist.
  const pack = (overrides?: { source_text_field?: string }) =>
    ({
      graph_schema: {
        source_table: "source",
        passage_table: "passage",
        unit_table: "claim",
        group_table: "argument",
        part_of_edge: "part_of",
        relation_edges: [],
        unit_vector_field: "embedding",
        ...(overrides?.source_text_field ? { source_text_field: overrides.source_text_field } : {}),
      },
    }) as never;

  async function build(packArg: unknown) {
    const { store, rows, creates } = makeInMemorySurrealStore();
    const { buildWorkspaceGraphStore } = await import("$lib/server/connect/surreal-graph-store");
    vi.mocked(buildWorkspaceGraphStore).mockResolvedValue(store as never);
    const { buildGraphWriter } = await import("./graph-writer");
    const writer = await buildGraphWriter(
      { provider: "surreal" } as never,
      packArg as never,
      { workspaceId: "ws-1", domainPackId: null, id: "job-1" },
    );
    return { writer: writer!, store, rows, creates };
  }

  it("(a) persists the FULL parsed text inline under the default `text` field for a URL/upload source", async () => {
    const { writer, creates } = await build(pack());
    const parsed = "# Title\n\nFull source body with **markdown** and a quote: virtue is a mean.\n";
    const id = await writer.writeSource({
      title: "Doc",
      url: "https://example.com/doc",
      textPreview: "preview",
      sourceKind: "url",
      sourceKey: "https://example.com/doc",
      contentHash: "h".repeat(64),
      text: parsed,
    });
    expect(id).toMatch(/^source:/);
    expect(creates).toHaveLength(1);
    // (c) byte-exactness: the inline field carries the parsed bytes verbatim (no trim).
    expect(creates[0]!.text).toBe(parsed);
    expect(creates[0]!.text_preview).toBe("preview");
  });

  it("(b)+(c) round-trips byte-exactly through fetchSurrealSourceRecordText / resolveSurrealSourceFullText", async () => {
    const { writer, store } = await build(pack());
    const parsed = "Line one.\n  Leading + trailing whitespace kept.  \n\nLine three — émojis 🌱 and offsets matter.";
    const id = await writer.writeSource({
      title: "Doc",
      url: null,
      textPreview: "preview",
      sourceKind: "text",
      text: parsed,
    });

    const { fetchSurrealSourceRecordText } = await import("./connect-source-text-resolve");
    const fetched = await fetchSurrealSourceRecordText(store as never, id, pack());
    expect(fetched.fullText).toBe(parsed);

    // resolveSurrealSourceFullText reads inline text off the source ROW (the shape the
    // user's store returns) — prove it resolves the exact bytes, full quality, inline origin.
    const { resolveSurrealSourceFullText } = await import("./surreal-source-text");
    const row = (await (store as never as { query: (sql: string) => Promise<unknown[]> }).query(
      `SELECT * FROM ${id};`,
    )) as Record<string, unknown>[];
    const resolved = await resolveSurrealSourceFullText({
      store: store as never,
      pack: pack(),
      sourceRow: row[0],
      sourceId: id,
    });
    expect(resolved.quality).toBe("full");
    expect(resolved.origin).toBe("inline");
    expect(resolved.text).toBe(parsed);
  });

  it("(b) honors the pack's configured source_text_field (verbatim, not lower-cased)", async () => {
    const configured = "full_text";
    const { writer, creates, store } = await build(pack({ source_text_field: configured }));
    const parsed = "Mapped-field body.";
    const id = await writer.writeSource({
      title: "Doc",
      url: null,
      textPreview: null,
      sourceKind: "text",
      text: parsed,
    });
    // Written under the configured field, not the default `text`.
    expect(creates[0]![configured]).toBe(parsed);
    expect(creates[0]!).not.toHaveProperty("text");
    // Resolver reads the configured field first, so it still resolves.
    const { fetchSurrealSourceRecordText } = await import("./connect-source-text-resolve");
    const fetched = await fetchSurrealSourceRecordText(
      store as never,
      id,
      pack({ source_text_field: configured }),
    );
    expect(fetched.fullText).toBe(parsed);
  });

  it("(d) does NOT write inline text for a source that originated from the user's own graph (BYO double-write guard)", async () => {
    const { writer, creates } = await build(pack());
    const id = await writer.writeSource({
      title: "Imported",
      url: null,
      textPreview: "preview",
      sourceKind: "graph_import",
      text: "This body already lives in the user's own source record.",
      originatesFromUserGraph: true,
    });
    expect(id).toMatch(/^source:/);
    // The record was still created (for provenance/preview) but carries no inline full text.
    expect(creates[0]!).not.toHaveProperty("text");
    expect(creates[0]!.text_preview).toBe("preview");
  });

  it("falls back to `text` when source_text_field is an unsafe identifier", async () => {
    const { writer, creates } = await build(pack({ source_text_field: "bad-field!" }));
    await writer.writeSource({
      title: "Doc",
      url: null,
      textPreview: null,
      sourceKind: "text",
      text: "body",
    });
    expect(creates[0]!.text).toBe("body");
  });

  it("omits inline text when no full text is available (registration-only row)", async () => {
    const { writer, creates } = await build(pack());
    await writer.writeSource({
      title: "Doc",
      url: "https://example.com",
      textPreview: "preview",
      sourceKind: "url",
      text: null,
    });
    expect(creates[0]!).not.toHaveProperty("text");
  });
});
