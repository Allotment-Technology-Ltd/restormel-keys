import { afterEach, describe, expect, it, vi } from "vitest";
import { cookieHeaderMayCarrySession, getSession } from "./auth";

describe("cookieHeaderMayCarrySession", () => {
  it("rejects empty and session-less cookie headers", () => {
    expect(cookieHeaderMayCarrySession("")).toBe(false);
    expect(cookieHeaderMayCarrySession("ph_distinct_id=abc; _ga=GA1.2")).toBe(false);
  });

  it("accepts Neon Auth production and localhost-alias cookies", () => {
    expect(cookieHeaderMayCarrySession("__Secure-neon-auth.session_token=x")).toBe(true);
    expect(cookieHeaderMayCarrySession("ph_distinct_id=abc; __Secure-x.session=y")).toBe(true);
    expect(cookieHeaderMayCarrySession("rksecure-session=test")).toBe(true);
  });
});

describe("getSession cookie gate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("skips the Neon Auth round-trip when no session cookie is present", async () => {
    vi.stubEnv("NEON_AUTH_BASE_URL", "https://auth.example.com");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const request = new Request("https://restormel.dev/", {
      headers: { cookie: "ph_distinct_id=anon-123" },
    });
    const result = await getSession(request, "restormel.dev");

    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
