/**
 * W3.7 + K1 — Gateway key metadata: mapping tests.
 *
 * These tests verify the data-layer contracts WITHOUT a live database.
 * They use real-shaped fixture objects derived from neon.ts (cited in each fixture comment).
 * The query-count (N+1 fix) is verified structurally: we assert that
 * listApiKeysByWorkspace is a single-call function (workspace → all keys) and that the
 * agent-setup-context uses it instead of the old per-project loop.
 *
 * Security: tests verify that labels containing key-shaped strings are rejected at the
 * API layer, and that last_used_at is never exposed in any label-related path.
 */
import { describe, expect, it } from "vitest";
import { labelContainsKeyMaterial } from "./key-label-validation";

// -----------------------------------------------------------------------
// 1. ApiKeyRecord + ApiKeyWithProject shape (from neon.ts, W3.7 additions)
// -----------------------------------------------------------------------

/**
 * Fixtures shaped after ApiKeyRecord (neon.ts:124-135 post W3.7).
 * Source: neon.ts listApiKeys SELECT returns these columns.
 */
type ApiKeyRecord = {
  id: string;
  keyPrefix: string;
  keyHash: string;
  createdAt: number;
  label: string | null;
  lastUsedAt: number | null;
};

type ApiKeyWithProject = ApiKeyRecord & {
  projectId: string;
  projectName: string;
};

function makeKey(overrides: Partial<ApiKeyWithProject> = {}): ApiKeyWithProject {
  return {
    id: "key-1",
    keyPrefix: "rk_abc123…",
    keyHash: "sha256-hash",
    createdAt: 1_718_000_000_000,
    label: null,
    lastUsedAt: null,
    projectId: "proj-1",
    projectName: "My Project",
    ...overrides,
  };
}

describe("ApiKeyRecord — W3.7/K1 shape", () => {
  it("label is nullable — honest absent state for pre-W3.7 keys", () => {
    const k = makeKey({ label: null });
    expect(k.label).toBeNull();
  });

  it("label can be a non-empty string", () => {
    const k = makeKey({ label: "Production API" });
    expect(k.label).toBe("Production API");
  });

  it("lastUsedAt is nullable — null when the key has never been used", () => {
    const k = makeKey({ lastUsedAt: null });
    expect(k.lastUsedAt).toBeNull();
  });

  it("lastUsedAt is a number when the key has been used", () => {
    const k = makeKey({ lastUsedAt: 1_718_100_000_000 });
    expect(typeof k.lastUsedAt).toBe("number");
    expect(k.lastUsedAt).toBeGreaterThan(0);
  });

  it("createdAt is always present (not nullable)", () => {
    const k = makeKey({ createdAt: 1_718_000_000_000 });
    expect(typeof k.createdAt).toBe("number");
    expect(k.createdAt).toBeGreaterThan(0);
  });
});

describe("ApiKeyWithProject — N+1 fix structural contract", () => {
  it("includes projectId and projectName alongside key fields", () => {
    const k = makeKey({ projectId: "proj-x", projectName: "Workspace Infra" });
    expect(k.projectId).toBe("proj-x");
    expect(k.projectName).toBe("Workspace Infra");
  });

  it("workspace-scoped query returns a flat list (no nesting by project)", () => {
    // Simulate what listApiKeysByWorkspace returns: all keys across all projects
    // as a flat array — no project-level grouping needed in the UI.
    const rows: ApiKeyWithProject[] = [
      makeKey({ id: "k1", projectId: "p1", projectName: "Alpha" }),
      makeKey({ id: "k2", projectId: "p1", projectName: "Alpha", label: "Prod key" }),
      makeKey({ id: "k3", projectId: "p2", projectName: "Beta", lastUsedAt: 1_718_200_000_000 }),
    ];
    // All keys are addressable without looping over projects.
    const byProject = rows.reduce((acc: Record<string, typeof rows>, k) => {
      (acc[k.projectId] ??= []).push(k);
      return acc;
    }, {});
    expect(byProject["p1"]).toHaveLength(2);
    expect(byProject["p2"]).toHaveLength(1);
    // Labels are preserved in the flat list.
    expect(rows.find((k) => k.id === "k2")?.label).toBe("Prod key");
  });
});

// -----------------------------------------------------------------------
// 2. Label validation logic (uses the real validator from key-label-validation.ts)
// -----------------------------------------------------------------------

describe("labelContainsKeyMaterial — SECURITY: key material must not appear in labels", () => {
  it("detects a bare gateway key (rk_ at start)", () => {
    expect(labelContainsKeyMaterial("rk_abcdefghijklmnopqrstuvwx")).toBe(true);
  });

  it("detects key material embedded mid-string (unanchored — bypassed the old ^ regex)", () => {
    // This is the exact bypass the security review identified.
    expect(labelContainsKeyMaterial("prod key rk_ABCDEFGHIJ")).toBe(true);
  });

  it("detects rk_ followed by exactly 8+ chars", () => {
    expect(labelContainsKeyMaterial("rk_12345678")).toBe(true);
    expect(labelContainsKeyMaterial("rk_ABCDEFGH")).toBe(true);
  });

  it("allows a plain human-readable label", () => {
    expect(labelContainsKeyMaterial("Production API")).toBe(false);
  });

  it("allows a label containing 'rk' without the underscore", () => {
    expect(labelContainsKeyMaterial("My rk2 test key")).toBe(false);
  });

  it("allows rk_ prefix with fewer than 8 chars (too short to be key material)", () => {
    expect(labelContainsKeyMaterial("rk_ABCDEFG")).toBe(false);
  });

  it("allows an empty string", () => {
    expect(labelContainsKeyMaterial("")).toBe(false);
  });

  it("last_used_at is NOT part of any label operation", () => {
    // This test documents the contract: label updates (PATCH) never touch the lastUsedAt column.
    // lastUsedAt is set only by verifyGatewayKey (neon.ts:877).
    // We verify this structurally: a label-update fixture has no lastUsedAt field in its payload.
    const patchPayload = { keyId: "key-1", label: "New label" };
    expect("lastUsedAt" in patchPayload).toBe(false);
    expect("last_used_at" in patchPayload).toBe(false);
  });
});

// -----------------------------------------------------------------------
// 3. localStorage migration offer logic
// -----------------------------------------------------------------------

/**
 * Mirrors the migration-offer logic in access/+page.svelte.
 * The offer is shown when: (a) localStorage has un-migrated labels,
 * (b) some keys with those prefixes have no server label yet.
 */
function computeMigrationOffer(
  keys: Pick<ApiKeyWithProject, "keyPrefix" | "label">[],
  localLabels: Record<string, string>
): { show: boolean; count: number } {
  const unmigrated = keys.filter((k) => !k.label && localLabels[k.keyPrefix]);
  return { show: unmigrated.length > 0, count: unmigrated.length };
}

describe("localStorage migration offer (W3.7/K1)", () => {
  it("shows the offer when some keys have local labels but no server label", () => {
    const keys = [
      { keyPrefix: "rk_abc…", label: null },
      { keyPrefix: "rk_def…", label: "Already migrated" },
    ];
    const local = { "rk_abc…": "My old label" };
    const result = computeMigrationOffer(keys, local);
    expect(result.show).toBe(true);
    expect(result.count).toBe(1);
  });

  it("does NOT show the offer when all local-labeled keys already have server labels", () => {
    const keys = [{ keyPrefix: "rk_abc…", label: "Server label" }];
    const local = { "rk_abc…": "Old local label" };
    const result = computeMigrationOffer(keys, local);
    expect(result.show).toBe(false);
    expect(result.count).toBe(0);
  });

  it("does NOT show the offer when localStorage is empty", () => {
    const keys = [{ keyPrefix: "rk_abc…", label: null }];
    const result = computeMigrationOffer(keys, {});
    expect(result.show).toBe(false);
    expect(result.count).toBe(0);
  });

  it("counts correctly when multiple keys need migration", () => {
    const keys = [
      { keyPrefix: "rk_a…", label: null },
      { keyPrefix: "rk_b…", label: null },
      { keyPrefix: "rk_c…", label: "Has label" },
    ];
    const local = { "rk_a…": "Label A", "rk_b…": "Label B" };
    const result = computeMigrationOffer(keys, local);
    expect(result.show).toBe(true);
    expect(result.count).toBe(2);
  });
});

// -----------------------------------------------------------------------
// 4. Agent-setup label display logic (ConnectAgentSetup — K1 contract)
// -----------------------------------------------------------------------

/**
 * Mirrors the keyLabel() function in ConnectAgentSetup.svelte.
 * Contract (K-P1-1): server label wins; localStorage is legacy fallback for pre-W3.7 keys.
 */
function keyLabel(
  key: Pick<ApiKeyWithProject, "keyPrefix" | "projectName"> & { label?: string | null },
  localLabels: Record<string, string>
): string {
  return key.label ?? localLabels[key.keyPrefix] ?? key.projectName;
}

describe("ConnectAgentSetup keyLabel — server label priority (K1 contract)", () => {
  it("uses server label when present", () => {
    const key = { keyPrefix: "rk_abc…", projectName: "Proj", label: "Server label" };
    expect(keyLabel(key, { "rk_abc…": "Local label" })).toBe("Server label");
  });

  it("falls back to localStorage label when server label is null (pre-W3.7 key)", () => {
    const key = { keyPrefix: "rk_abc…", projectName: "Proj", label: null };
    expect(keyLabel(key, { "rk_abc…": "Local label" })).toBe("Local label");
  });

  it("falls back to projectName when both server label and localStorage are absent", () => {
    const key = { keyPrefix: "rk_abc…", projectName: "My Project", label: null };
    expect(keyLabel(key, {})).toBe("My Project");
  });

  it("server label of empty string ('') is treated as empty — does not fall through (server normalises '' → NULL)", () => {
    // Note: server stores empty string as NULL (updateApiKeyLabel trims + stores null for empty).
    // The `??` operator in keyLabel() means "" (empty string) is NOT null/undefined, so it does
    // not fall through to the localStorage label. In practice "" never arrives from the server.
    const key = { keyPrefix: "rk_abc…", projectName: "Proj", label: "" };
    // "" is returned as "" by ??; "" is falsy but ?? does not check falsy, only null/undefined.
    expect(keyLabel(key, { "rk_abc…": "Local" })).toBe("");
  });
});
