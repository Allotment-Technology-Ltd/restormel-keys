/**
 * Cron-drain route auth (Stage 1.6): the drain must fail closed in production —
 * an unauthenticated drain endpoint would let anyone force queue processing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$lib/server/connect-ingest-worker", () => ({
  drainConnectIngestQueue: vi.fn(async () => ({ reclaimed: 1, processed: 2 })),
}));

const mockEnv: Record<string, string | undefined> = {};
vi.mock("$env/dynamic/private", () => ({ env: mockEnv }));
vi.mock("$app/environment", () => ({ dev: false, building: false, browser: false }));

async function callDrain(args: { authorization?: string; query?: string }) {
  const { GET } = await import(
    "../../routes/keys/dashboard/api/connect/ingest/drain/+server"
  );
  const url = new URL(`http://localhost/keys/dashboard/api/connect/ingest/drain${args.query ?? ""}`);
  const request = new Request(url, {
    headers: args.authorization ? { authorization: args.authorization } : {},
  });
  return GET({ request, url } as never);
}

describe("connect ingest drain route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete mockEnv.CRON_SECRET;
  });

  it("fails closed (503) in production when CRON_SECRET is not configured", async () => {
    const res = await callDrain({});
    expect(res.status).toBe(503);
    const { drainConnectIngestQueue } = await import("$lib/server/connect-ingest-worker");
    expect(drainConnectIngestQueue).not.toHaveBeenCalled();
  });

  it("rejects a wrong or missing bearer token (401)", async () => {
    mockEnv.CRON_SECRET = "s3cret";
    expect((await callDrain({})).status).toBe(401);
    expect((await callDrain({ authorization: "Bearer nope" })).status).toBe(401);
    const { drainConnectIngestQueue } = await import("$lib/server/connect-ingest-worker");
    expect(drainConnectIngestQueue).not.toHaveBeenCalled();
  });

  it("drains with the Vercel cron bearer convention and bounds ?max", async () => {
    mockEnv.CRON_SECRET = "s3cret";
    const res = await callDrain({ authorization: "Bearer s3cret", query: "?max=99" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, reclaimed: 1, processed: 2 });
    const { drainConnectIngestQueue } = await import("$lib/server/connect-ingest-worker");
    expect(drainConnectIngestQueue).toHaveBeenCalledWith({ maxJobs: 10 });
  });
});
