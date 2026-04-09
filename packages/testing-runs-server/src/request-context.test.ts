import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { IncomingMessage } from "node:http";
import { Socket } from "node:net";
import { clientRateLimitKey, getOrCreateRequestId } from "./request-context.js";

function mockReq(headers: Record<string, string | undefined>, remoteAddress?: string): IncomingMessage {
  const socket = new Socket();
  if (remoteAddress !== undefined) {
    Object.defineProperty(socket, "remoteAddress", { value: remoteAddress, configurable: true });
  }
  const req = new IncomingMessage(socket);
  for (const [k, v] of Object.entries(headers)) {
    if (v !== undefined) req.headers[k.toLowerCase()] = v;
  }
  return req;
}

describe("getOrCreateRequestId", () => {
  it("generates a UUID when header missing", () => {
    const req = mockReq({});
    const id = getOrCreateRequestId(req);
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("accepts valid inbound UUID", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const req = mockReq({ "x-request-id": uuid });
    expect(getOrCreateRequestId(req)).toBe(uuid);
  });

  it("rejects non-UUID inbound and generates new", () => {
    const req = mockReq({ "x-request-id": "not-a-uuid" });
    const id = getOrCreateRequestId(req);
    expect(id).not.toBe("not-a-uuid");
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe("clientRateLimitKey", () => {
  beforeEach(() => {
    vi.stubEnv("RESTORMEL_RUNS_TRUST_PROXY", undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses remoteAddress by default", () => {
    const req = mockReq({}, "192.0.2.1");
    expect(clientRateLimitKey(req)).toBe("192.0.2.1");
  });

  it("uses first X-Forwarded-For when trust proxy set", () => {
    vi.stubEnv("RESTORMEL_RUNS_TRUST_PROXY", "1");
    const req = mockReq({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }, "192.0.2.1");
    expect(clientRateLimitKey(req)).toBe("xff:203.0.113.5");
  });
});
