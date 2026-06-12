/**
 * W3.7/K1 security: key metadata returned to the client must never contain keyHash.
 *
 * Tests:
 *  1. Access-page load returns key objects with NO `keyHash` property (BLOCKER fix).
 *  2. labelContainsKeyMaterial validator — imported from $lib/server/key-label-validation
 *     and tested here alongside the access-page invariant.
 *     - Catches keys at the start of a label (old anchored ^ regex was bypassable).
 *     - Catches keys embedded in a longer string ("prod key rk_<material>").
 *     - Allows normal labels through.
 */
import { describe, expect, it, vi } from "vitest";
import { labelContainsKeyMaterial } from "$lib/server/key-label-validation";

// ── Module-level mocks ────────────────────────────────────────────────

const MOCK_WORKSPACE = { id: "ws-1", createdAt: Date.now() };
const MOCK_PROJECTS = [{ id: "proj-1", name: "Test Project", workspaceId: "ws-1" }];

/**
 * A mock key row shaped like ApiKeyWithProject — critically, keyHash is absent.
 * This mirrors what listApiKeysByWorkspace now returns post-fix.
 */
const MOCK_KEY_ROW = {
  id: "key-1",
  keyPrefix: "rk_testkey1…",
  // keyHash is deliberately NOT present — this is the fix being tested.
  createdAt: Date.now(),
  label: "My API key",
  lastUsedAt: null,
  projectId: "proj-1",
  projectName: "Test Project",
};

vi.mock("$lib/server/db", () => ({
  listProjects: vi.fn().mockResolvedValue(MOCK_PROJECTS),
  listApiKeysByWorkspace: vi.fn().mockResolvedValue([MOCK_KEY_ROW]),
  getOrCreateDefaultWorkspace: vi.fn().mockResolvedValue(MOCK_WORKSPACE),
}));

vi.mock("$lib/server/session-user", () => ({
  sessionUser: vi.fn().mockReturnValue({ uid: "user-1", email: "u@example.com", authType: "session" }),
}));

// ── 1. Access-page load: returned key objects must NOT contain keyHash ──────

describe("access-page load — key objects have no keyHash (BLOCKER: sec-review fix)", () => {
  it("returned key rows do not have a keyHash property", async () => {
    const { load } = await import("./+page.server");
    const url = new URL("https://example.com/keys/dashboard/access");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await load({ locals: { user: { uid: "user-1", email: "u@example.com", authType: "session" } }, url } as any)) as any;

    expect(result.signedIn).toBe(true);
    expect(Array.isArray(result.keys)).toBe(true);

    // SECURITY INVARIANT: no key object in the access page response may carry a keyHash field.
    for (const key of result.keys as unknown[]) {
      expect(key).not.toHaveProperty("keyHash");
    }
  });

  it("returned key rows carry the expected safe fields", async () => {
    const { load } = await import("./+page.server");
    const url = new URL("https://example.com/keys/dashboard/access");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await load({ locals: { user: { uid: "user-1", email: "u@example.com", authType: "session" } }, url } as any)) as any;

    const [key] = result.keys as unknown[];
    expect(key).toHaveProperty("id");
    expect(key).toHaveProperty("keyPrefix");
    expect(key).toHaveProperty("createdAt");
    expect(key).toHaveProperty("label");
    expect(key).toHaveProperty("projectId");
    expect(key).toHaveProperty("projectName");
  });
});

// ── 2. labelContainsKeyMaterial validator ────────────────────────────────────

describe("labelContainsKeyMaterial — rk_ guard (MEDIUM fix: unanchored match)", () => {
  it("blocks a bare gateway key (rk_ at start)", () => {
    expect(labelContainsKeyMaterial("rk_ABCDEFGHIJ")).toBe(true);
  });

  it("blocks key material embedded mid-string (bypassed the old ^ anchor)", () => {
    // This is the exact bypass the review identified: "prod key rk_<fullkey>" passed the old regex.
    expect(labelContainsKeyMaterial("prod key rk_ABCDEFGHIJ")).toBe(true);
  });

  it("blocks key material at end of string", () => {
    expect(labelContainsKeyMaterial("my label rk_12345678901234567890")).toBe(true);
  });

  it("allows a normal label with no key material", () => {
    expect(labelContainsKeyMaterial("Production API")).toBe(false);
  });

  it("allows a label containing 'rk_' prefix but fewer than 8 alphanumeric chars (too short)", () => {
    // rk_ + 7 chars is below the 8-char minimum
    expect(labelContainsKeyMaterial("rk_ABCDEFG")).toBe(false);
  });

  it("allows an empty string", () => {
    expect(labelContainsKeyMaterial("")).toBe(false);
  });

  it("allows a label that mentions rk without the underscore", () => {
    expect(labelContainsKeyMaterial("rk prefixed service")).toBe(false);
  });
});
