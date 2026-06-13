/**
 * P2b — confirm the Postgres cache fallback still resolves source text for older /
 * cache-only sources (we must NOT remove the fallback; the read-back guard only stops NEW
 * writes where the store provably holds the text). A legacy source with no store record and
 * no inline job text resolves through findConnectSourceDocumentText, full quality.
 */
import { describe, expect, it, vi } from "vitest";

const CACHE_TEXT = "Bentham founded classical utilitarianism. Mill ranked higher pleasures.";

vi.mock("$lib/server/neon", () => ({
  // No inline job sources carry the text → the resolver must fall through to the cache.
  listConnectIngestJobsForWorkspace: vi.fn(async () => []),
  findConnectSourceDocumentText: vi.fn(async () => CACHE_TEXT),
}));

describe("P2b — cache-only legacy source resolves via the Postgres fallback", () => {
  it("resolveConnectSourceTextRaw returns the cached text at full quality (fallback intact)", async () => {
    const { resolveConnectSourceTextRaw } = await import("./connect-source-text-resolve");
    const resolved = await resolveConnectSourceTextRaw({
      workspaceId: "ws-1",
      title: "Legacy notes",
      url: "https://example.com/legacy",
      textPreview: "preview only",
      // No surrealFullText: store has nothing for this older source.
      surrealFullText: null,
    });
    expect(resolved.quality).toBe("full");
    expect(resolved.text).toBe(CACHE_TEXT);

    const { findConnectSourceDocumentText } = await import("$lib/server/neon");
    expect(findConnectSourceDocumentText).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      name: "Legacy notes",
      url: "https://example.com/legacy",
    });
  });

  it("store-first wins when surrealFullText is present (fallback only when the store is empty)", async () => {
    const { resolveConnectSourceTextRaw } = await import("./connect-source-text-resolve");
    const resolved = await resolveConnectSourceTextRaw({
      workspaceId: "ws-1",
      title: "Notes",
      url: null,
      textPreview: null,
      surrealFullText: "STORE WINS — authoritative bytes.",
    });
    expect(resolved.quality).toBe("full");
    expect(resolved.text).toBe("STORE WINS — authoritative bytes.");
  });
});
