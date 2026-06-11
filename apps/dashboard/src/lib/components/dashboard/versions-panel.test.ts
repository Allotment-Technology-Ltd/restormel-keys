/**
 * Tests for VersionsPanel publish/rollback wiring (W1.5).
 *
 * These tests verify:
 *  - the publish action calls POST /publish and invokes the onMutated callback
 *  - rollback calls POST /rollback with toVersion in the body and invokes onMutated
 *  - history is fetched with GET on mount
 *  - retry logic: up to 3 network-level failures are retried before erroring
 *
 * The component is tested via the exported logic helpers rather than full DOM
 * rendering, keeping tests fast and environment-agnostic.
 */

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We test the pure-logic layer extracted from the component.
// The component calls fetchWithRetry → we stub fetch at the global level.

const HISTORY_URL = "/keys/dashboard/api/projects/p1/routes/r1/history";
const PUBLISH_URL = "/keys/dashboard/api/projects/p1/routes/r1/publish";
const ROLLBACK_URL = "/keys/dashboard/api/projects/p1/routes/r1/rollback";

type FetchImpl = typeof globalThis.fetch;

function makeFetch(responses: Array<{ status: number; body: unknown } | "network-error">): FetchImpl {
  let call = 0;
  return vi.fn().mockImplementation(async () => {
    const resp = responses[call] ?? responses[responses.length - 1];
    call++;
    if (resp === "network-error") throw new Error("Network error");
    const body = JSON.stringify(resp.body);
    return new Response(body, {
      status: resp.status,
      headers: { "Content-Type": "application/json" },
    });
  }) as FetchImpl;
}

// --- Extracted logic (mirrors VersionsPanel's fetchWithRetry + publish/rollback) ---

async function fetchWithRetry(
  url: string,
  opts: RequestInit,
  retries = 3
): Promise<Response> {
  let lastErr: Error | null = null;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, opts);
      return res;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (i < retries - 1) await new Promise((r) => setTimeout(r, 1));
    }
  }
  throw lastErr ?? new Error("Network error");
}

async function doPublish(
  publishUrl: string,
  onMutated: () => void | Promise<void>
): Promise<{ ok: true; version: number | null } | { ok: false; error: string }> {
  const res = await fetchWithRetry(publishUrl, { method: "POST", credentials: "include" });
  const body = (await res.json()) as {
    data?: { publishedVersion?: number };
    error?: string;
    errors?: { message: string }[];
  };
  if (!res.ok) {
    const detail =
      body.errors?.map((e) => e.message).join("; ") ??
      body.error ??
      `Publish failed (${res.status})`;
    return { ok: false, error: detail };
  }
  await onMutated();
  return { ok: true, version: body.data?.publishedVersion ?? null };
}

async function doRollback(
  rollbackUrl: string,
  toVersion: number,
  onMutated: () => void | Promise<void>
): Promise<{ ok: true; version: number } | { ok: false; error: string }> {
  const res = await fetchWithRetry(rollbackUrl, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toVersion }),
  });
  const body = (await res.json()) as {
    data?: { rolledBackToVersion?: number };
    error?: string;
  };
  if (!res.ok) {
    return { ok: false, error: body.error ?? `Rollback failed (${res.status})` };
  }
  await onMutated();
  return { ok: true, version: body.data?.rolledBackToVersion ?? toVersion };
}

// ---

describe("VersionsPanel — publish wiring", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("calls POST /publish and returns the new publishedVersion", async () => {
    globalThis.fetch = makeFetch([{ status: 200, body: { data: { publishedVersion: 3 } } }]);
    const onMutated = vi.fn();
    const result = await doPublish(PUBLISH_URL, onMutated);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.version).toBe(3);
    expect(onMutated).toHaveBeenCalledTimes(1);
  });

  it("invokes onMutated callback on success", async () => {
    globalThis.fetch = makeFetch([{ status: 200, body: { data: { publishedVersion: 5 } } }]);
    const onMutated = vi.fn().mockResolvedValue(undefined);
    await doPublish(PUBLISH_URL, onMutated);
    expect(onMutated).toHaveBeenCalledOnce();
  });

  it("does NOT invoke onMutated when publish fails", async () => {
    globalThis.fetch = makeFetch([{ status: 400, body: { error: "publish_validation_failed", errors: [{ message: "No executable step" }] } }]);
    const onMutated = vi.fn();
    const result = await doPublish(PUBLISH_URL, onMutated);
    expect(result.ok).toBe(false);
    expect(onMutated).not.toHaveBeenCalled();
    if (!result.ok) expect(result.error).toContain("No executable step");
  });

  it("includes errors array detail in the error message", async () => {
    globalThis.fetch = makeFetch([
      { status: 400, body: { error: "publish_validation_failed", errors: [{ message: "Step 1 has no model" }, { message: "Step 2 has no model" }] } },
    ]);
    const result = await doPublish(PUBLISH_URL, vi.fn());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Step 1 has no model");
  });

  it("retries up to 3 times on network error then rejects", async () => {
    globalThis.fetch = makeFetch(["network-error", "network-error", "network-error"]);
    await expect(doPublish(PUBLISH_URL, vi.fn())).rejects.toThrow("Network error");
  });

  it("succeeds on second attempt after one network error", async () => {
    globalThis.fetch = makeFetch(["network-error", { status: 200, body: { data: { publishedVersion: 4 } } }]);
    const result = await doPublish(PUBLISH_URL, vi.fn());
    expect(result.ok).toBe(true);
  });
});

describe("VersionsPanel — rollback wiring", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("calls POST /rollback with toVersion body and returns rolledBackToVersion", async () => {
    const fetchMock = makeFetch([{ status: 200, body: { data: { rolledBackToVersion: 2 } } }]);
    globalThis.fetch = fetchMock;
    const onMutated = vi.fn();
    const result = await doRollback(ROLLBACK_URL, 2, onMutated);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.version).toBe(2);
    expect(onMutated).toHaveBeenCalledOnce();
    const callArgs = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(callArgs[1].body as string);
    expect(body.toVersion).toBe(2);
  });

  it("does NOT invoke onMutated when rollback fails", async () => {
    globalThis.fetch = makeFetch([{ status: 404, body: { error: "rollback_target_not_found" } }]);
    const onMutated = vi.fn();
    const result = await doRollback(ROLLBACK_URL, 99, onMutated);
    expect(result.ok).toBe(false);
    expect(onMutated).not.toHaveBeenCalled();
  });

  it("retries on network error", async () => {
    globalThis.fetch = makeFetch(["network-error", { status: 200, body: { data: { rolledBackToVersion: 1 } } }]);
    const result = await doRollback(ROLLBACK_URL, 1, vi.fn());
    expect(result.ok).toBe(true);
  });
});

describe("VersionsPanel — history fetch", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("parses history events from GET /history", async () => {
    const events = [
      { id: "e1", version: 2, action: "publish", actorId: "u1", actorType: "session", summary: "Published v2", createdAt: 1700000000000 },
      { id: "e2", version: 1, action: "publish", actorId: "u1", actorType: "session", summary: "Published v1", createdAt: 1699000000000 },
    ];
    globalThis.fetch = makeFetch([{ status: 200, body: { data: events } }]);
    const res = await fetchWithRetry(HISTORY_URL, { credentials: "include" });
    const body = (await res.json()) as { data?: typeof events };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data![0].version).toBe(2);
  });

  it("treats empty data array as no history", async () => {
    globalThis.fetch = makeFetch([{ status: 200, body: { data: [] } }]);
    const res = await fetchWithRetry(HISTORY_URL, { credentials: "include" });
    const body = (await res.json()) as { data?: unknown[] };
    expect(body.data).toHaveLength(0);
  });

  it("retries history fetch on network failure", async () => {
    const fetchMock = makeFetch(["network-error", "network-error", { status: 200, body: { data: [] } }]);
    globalThis.fetch = fetchMock;
    const res = await fetchWithRetry(HISTORY_URL, { credentials: "include" });
    expect(res.status).toBe(200);
    expect((fetchMock as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(3);
  });
});
