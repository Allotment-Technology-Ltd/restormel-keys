/**
 * P2b — store-verified source text via a read-back guard + the trim/evidence-hash fix.
 *
 * Two properties under test:
 *
 *  (A) Read-back guard. After writeSource persists the source text into the user's own
 *      Surreal store, the runner reads it back through the SAME resolver the readers use
 *      and byte-compares. CONFIRMED → drop our Postgres cache copy for that source
 *      (`clearConnectSourceDocumentTextToStore`, text NULLed, metadata kept — reversible).
 *      MISMATCH/MISSING (e.g. a SCHEMAFULL source table silently drops the inline field)
 *      → keep the cache as the re-validation fallback. No destructive migration anywhere.
 *
 *  (B) Trim/evidence-hash asymmetry. Evidence spans bind against the bytes the runner
 *      hashes; every resolver trims on read. By trimming ONCE at ingest the bound bytes
 *      become the trimmed bytes, so a source with leading/trailing whitespace — which used
 *      to fail the deterministic Layer-1 re-check with hash_mismatch — now passes, and both
 *      the store round-trip and the cache round-trip equal the bound bytes.
 *
 * Everything runs against in-memory fakes — no real SurrealDB, no Postgres, no LLM keys.
 */
import { describe, expect, it, vi } from "vitest";
import {
  bindEvidenceSpan,
  contentHash,
  verifyEvidenceSpan,
  type EvidenceSpan,
} from "@restormel/connect-core";

// ── Shared in-memory Surreal-ish store (CREATE … RETURN id / SELECT … FROM <id>) ──
function makeInMemorySurrealStore(opts?: { schemafullDropsInlineText?: boolean }) {
  const rows = new Map<string, Record<string, unknown>>();
  let seq = 0;
  const creates: Record<string, unknown>[] = [];
  const store = {
    query: vi.fn(async (sql: string) => {
      const create = sql.match(/^CREATE\s+(\S+)\s+CONTENT\s+([\s\S]+?)\s+RETURN id;?$/);
      if (create) {
        const tb = create[1]!;
        const content = JSON.parse(create[2]!) as Record<string, unknown>;
        creates.push(content);
        // Simulate a SCHEMAFULL source table that has no inline text field: the write
        // succeeds but the text never sticks (Surreal silently drops undefined fields).
        const stored = { ...content };
        if (opts?.schemafullDropsInlineText) {
          for (const k of ["text", "body", "content", "full_text", "raw_text", "document", "markdown"]) {
            delete (stored as Record<string, unknown>)[k];
          }
        }
        const id = `${tb}:${tb}${++seq}`;
        rows.set(id, { id, ...stored });
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
  return { store, rows, creates };
}

const pack = () =>
  ({
    graph_schema: {
      source_table: "source",
      passage_table: "passage",
      unit_table: "claim",
      group_table: "argument",
      part_of_edge: "part_of",
      relation_edges: [],
      unit_vector_field: "embedding",
    },
  }) as never;

// ───────────────────────────── (B) Trim / evidence-hash ─────────────────────────────

describe("P2b (B) — trim/evidence-hash asymmetry is fixed", () => {
  // A source with significant leading/trailing whitespace. The quote sits in the body.
  const RAW = "\n\n  Bentham founded classical utilitarianism.  \n\n";
  const TRIMMED = RAW.trim();
  const QUOTE = "Bentham founded classical utilitarianism.";

  it("reproduces the OLD hash_mismatch: bind against RAW bytes, re-check against TRIMMED (what every resolver returns)", async () => {
    // OLD ingest behaviour: hash + bind against the RAW (untrimmed) source bytes.
    const rawHash = await contentHash(RAW);
    const bound = bindEvidenceSpan({ quote: QUOTE, sourceText: RAW, sourceHash: rawHash });
    expect(bound.status).toBe("bound");
    if (bound.status !== "bound") return;

    // Re-validation resolves source text through readers that TRIM (extractInlineSourceText,
    // findConnectSourceDocumentText). So the re-check sees TRIMMED bytes — different hash.
    const trimmedHash = await contentHash(TRIMMED);
    expect(trimmedHash).not.toBe(rawHash);
    const recheck = verifyEvidenceSpan({
      span: bound.span,
      sourceText: TRIMMED,
      sourceHash: trimmedHash,
    });
    expect(recheck).toEqual({ ok: false, reason: "hash_mismatch" });
  });

  it("NEW ingest behaviour: bind against TRIMMED bytes → the deterministic Layer-1 re-check PASSES", async () => {
    // P2b: the runner trims src.text ONCE, then hashes + binds against the trimmed bytes.
    const boundHash = await contentHash(TRIMMED);
    const bound = bindEvidenceSpan({ quote: QUOTE, sourceText: TRIMMED, sourceHash: boundHash });
    expect(bound.status).toBe("bound");
    if (bound.status !== "bound") return;

    // The store round-trip: writeSource persists the trimmed bytes; the resolver trims on
    // read (a no-op on already-trimmed text) → returns exactly the bound bytes.
    const storeRoundTrip = TRIMMED.trim();
    expect(storeRoundTrip).toBe(TRIMMED);
    expect(await contentHash(storeRoundTrip)).toBe(boundHash);
    expect(
      verifyEvidenceSpan({ span: bound.span, sourceText: storeRoundTrip, sourceHash: boundHash }),
    ).toEqual({ ok: true, match: "exact" });

    // The cache round-trip: even if the cache holds UNtrimmed bytes, findConnectSourceDocumentText
    // returns .trim() → the bound bytes. Hash matches; the re-check passes.
    const cacheRoundTrip = RAW.trim();
    expect(cacheRoundTrip).toBe(TRIMMED);
    expect(await contentHash(cacheRoundTrip)).toBe(boundHash);
    expect(
      verifyEvidenceSpan({ span: bound.span, sourceText: cacheRoundTrip, sourceHash: boundHash }),
    ).toEqual({ ok: true, match: "exact" });
  });

  it("the store round-trips the TRIMMED bytes verbatim through fetchSurrealSourceRecordText", async () => {
    const { store } = makeInMemorySurrealStore();
    const { buildWorkspaceGraphStore } = await import("$lib/server/connect/surreal-graph-store");
    vi.mocked(buildWorkspaceGraphStore).mockResolvedValue(store as never);
    const { buildGraphWriter } = await import("./graph-writer");
    const writer = await buildGraphWriter(
      { provider: "surreal" } as never,
      pack(),
      { workspaceId: "ws-1", domainPackId: null, id: "job-1" },
    );
    // writeSource writes the bytes it is given verbatim; the runner gives it TRIMMED bytes.
    const id = await writer!.writeSource({
      title: "Doc",
      url: null,
      textPreview: "preview",
      sourceKind: "text",
      text: TRIMMED,
    });
    const { fetchSurrealSourceRecordText } = await import("./connect-source-text-resolve");
    const fetched = await fetchSurrealSourceRecordText(store as never, id, pack());
    expect(fetched.fullText).toBe(TRIMMED);
    expect(await contentHash(fetched.fullText!)).toBe(await contentHash(TRIMMED));
  });
});

vi.mock("$lib/server/connect/surreal-graph-store", () => ({
  buildWorkspaceGraphStore: vi.fn(),
}));

// ───────────────────────────── (A) Read-back guard via the runner ────────────────────

// Mock the data layer the runner touches. clearConnectSourceDocumentTextToStore is the
// cache-clear we assert on; the read-back resolver runs for real against the in-memory store.
type ClearArgs = {
  workspaceId: string;
  name: string | null;
  url: string | null;
  graphSourceKey: string;
};
const clearTextSpy = vi.fn(async (_args: ClearArgs): Promise<number> => 1);
vi.mock("$lib/server/neon", () => ({
  getConnectDomainPackById: vi.fn(async () => ({ record: true })),
  listConnectDomainPacksForWorkspace: vi.fn(async () => []),
  getConnectGraphTargetForWorkspace: vi.fn(async () => ({ provider: "surreal" })),
  insertConnectGraphSourcePostgres: vi.fn(async () => "src-x"),
  clearConnectSourceDocumentTextToStore: (args: ClearArgs) => clearTextSpy(args),
}));

vi.mock("$lib/server/connect/domain-pack-service", async () => {
  const { ConnectDomainPackSchema, DEFAULT_GENERIC_DOMAIN_PACK } = await import(
    "@restormel/contracts/connect"
  );
  const parsed = ConnectDomainPackSchema.parse({
    id: "11111111-1111-4111-8111-111111111111",
    workspace_id: "22222222-2222-4222-8222-222222222222",
    ...DEFAULT_GENERIC_DOMAIN_PACK,
    quality_preset: "starter",
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
  });
  return { domainPackRecordToApi: () => parsed };
});

vi.mock("$lib/server/connect/graph-ingest-context", () => ({
  loadGraphIngestContext: async () => ({
    unitCount: 0,
    topUnitTypes: [],
    relationCount: 0,
    isGreenfield: true,
  }),
}));

// A minimal Surreal-provider GraphWriter: writeSource delegates to the in-memory store so
// the read-back guard resolves real bytes; the rest of the pipeline is a thin no-op (the
// guard runs at registration, before any extraction stage).
function makeSurrealWriterOverStore(store: { query: (sql: string) => Promise<unknown> }) {
  let seq = 0;
  const writer = {
    provider: "surreal" as const,
    allowSurrealVersionTable: false,
    async writeSource(s: { title: string; url: string | null; textPreview: string | null; text?: string | null }) {
      const content: Record<string, unknown> = {
        title: s.title,
        url: s.url,
        text_preview: s.textPreview,
        ...(s.text ? { text: s.text } : {}),
      };
      const res = (await store.query(
        `CREATE source CONTENT ${JSON.stringify(content)} RETURN id;`,
      )) as { id: string }[];
      return res[0]!.id;
    },
    async findSourceVersion() {
      return null;
    },
    async touchSourceSeen() {},
    async listCurrentClaimVersions() {
      return [];
    },
    async supersedeClaimVersions() {
      return { persisted: 0, missed: 0 };
    },
    async writeUnitsAndRelations() {
      seq++;
      return { units: [], relations: 0 };
    },
    async storeGroups() {
      return { groups: 0 };
    },
    async setEmbeddings() {
      return 0;
    },
    async setValidation() {
      return 0;
    },
    async setEvidence() {
      return { persisted: 0, missed: 0, versionIdByUnitId: new Map<string, string>() };
    },
    async setVerificationStates() {
      return { persisted: 0, missed: 0 };
    },
    async recordJudgments() {
      return { persisted: 0, missed: 0 };
    },
    async updateUnitText() {},
    async deleteUnit() {},
    async excludeUnit() {},
  };
  return writer;
}

function surrealJob(text: string) {
  return {
    id: "job-1",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    projectId: null,
    status: "pending",
    label: null,
    currentStage: null,
    currentAction: null,
    progress: null,
    stages: [],
    sources: [{ title: "Utilitarianism notes", url: "https://example.com/util", text }],
    stopAfterStage: "extracting", // stop early; the guard runs at registration
    pipelineProfileId: null,
    domainPackId: "pack-1",
    graphTargetId: null,
    error: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  } as never;
}

async function runSurreal(store: { query: (sql: string) => Promise<unknown> }, text: string) {
  const { buildWorkspaceGraphStore } = await import("$lib/server/connect/surreal-graph-store");
  vi.mocked(buildWorkspaceGraphStore).mockResolvedValue(store as never);
  const writer = makeSurrealWriterOverStore(store);
  const { runFullExtraction } = await import("./ingest-full-runner");
  return runFullExtraction({
    job: surrealJob(text),
    writer: writer as never,
    generates: {
      extraction: vi.fn(async () => JSON.stringify({ units: [], relations: [] })),
      grouping: vi.fn(async () => JSON.stringify({ groups: [] })),
      validation: vi.fn(async () => JSON.stringify({ results: [] })),
      remediation: vi.fn(async () => JSON.stringify({ results: [] })),
    } as never,
    validationModelId: "judge#test",
  });
}

describe("P2b (A) — read-back guard decides cache-clear vs cache-keep", () => {
  const DOC = "Bentham founded classical utilitarianism. Mill ranked higher pleasures.";

  it("read-back CONFIRMED → drops the Postgres cache copy (metadata-only), store is authoritative", async () => {
    clearTextSpy.mockClear();
    const { store } = makeInMemorySurrealStore(); // inline text sticks → read-back matches
    await runSurreal(store, DOC);
    // The runner verified the store holds the exact bound bytes, so it cleared the cache.
    expect(clearTextSpy).toHaveBeenCalledTimes(1);
    const arg = clearTextSpy.mock.calls[0]![0];
    expect(arg.workspaceId).toBe("22222222-2222-4222-8222-222222222222");
    expect(arg.url).toBe("https://example.com/util");
    expect(arg.graphSourceKey).toMatch(/^source:/);
  });

  it("read-back FAILS (SCHEMAFULL store drops the inline text field) → KEEPS the cache (no clear call)", async () => {
    clearTextSpy.mockClear();
    const { store } = makeInMemorySurrealStore({ schemafullDropsInlineText: true });
    await runSurreal(store, DOC);
    // The store silently dropped the text → read-back returns nothing → cache must be kept.
    expect(clearTextSpy).not.toHaveBeenCalled();
  });
});
