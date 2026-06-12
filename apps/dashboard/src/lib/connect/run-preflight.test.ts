/**
 * Stage K3: client-safe preflight contract — launch gate semantics, failing-row
 * selection, and the K-P2-1 worker-failure → human copy mapping.
 */
import { describe, it, expect } from "vitest";
import {
  failingPreflightRows,
  mapConnectRunFailure,
  preflightAllowsLaunch,
  preflightIssueCopy,
  type ConnectRunPreflightProviderRow,
  type ConnectRunPreflightResult,
} from "./run-preflight";

const BASE = "/keys/dashboard";

function row(over: Partial<ConnectRunPreflightProviderRow> = {}): ConnectRunPreflightProviderRow {
  return {
    provider: "openai",
    stages: ["extraction"],
    hasBinding: true,
    credentialExecutable: true,
    issue: null,
    bind: null,
    fixHref: `${BASE}/integrations`,
    fixLabel: "Open Connections",
    ...over,
  };
}

function preflight(over: Partial<ConnectRunPreflightResult> = {}): ConnectRunPreflightResult {
  return {
    status: "pass",
    projectId: "proj-1",
    environmentId: "env-1",
    providers: [row()],
    issues: [],
    checkedAt: new Date().toISOString(),
    ...over,
  };
}

describe("preflightAllowsLaunch", () => {
  it("null preflight (compute failure) never bricks the gate", () => {
    expect(preflightAllowsLaunch(null, false)).toBe(true);
    expect(preflightAllowsLaunch(undefined, false)).toBe(true);
  });

  it("pass allows launch regardless of override", () => {
    expect(preflightAllowsLaunch(preflight(), false)).toBe(true);
    expect(preflightAllowsLaunch(preflight(), true)).toBe(true);
  });

  it("blocked never allows launch — even with the legacy override checked", () => {
    const blocked = preflight({ status: "blocked" });
    expect(preflightAllowsLaunch(blocked, false)).toBe(false);
    expect(preflightAllowsLaunch(blocked, true)).toBe(false);
  });

  it("legacy_env requires the explicit override", () => {
    const legacy = preflight({ status: "legacy_env", providers: [] });
    expect(preflightAllowsLaunch(legacy, false)).toBe(false);
    expect(preflightAllowsLaunch(legacy, true)).toBe(true);
  });
});

describe("failingPreflightRows", () => {
  it("returns only rows with a non-null issue", () => {
    const p = preflight({
      providers: [
        row(),
        row({ provider: "anthropic", issue: "no_provider_binding", hasBinding: false, credentialExecutable: false }),
      ],
    });
    expect(failingPreflightRows(p).map((r) => r.provider)).toEqual(["anthropic"]);
    expect(failingPreflightRows(null)).toEqual([]);
  });
});

describe("preflightIssueCopy", () => {
  it("names the provider for every issue code", () => {
    for (const issue of [
      "no_provider_binding",
      "integration_not_found",
      "credential_unavailable",
      "verification_failed",
    ] as const) {
      expect(preflightIssueCopy(row({ issue, provider: "voyage" }))).toContain("voyage");
    }
  });
});

describe("mapConnectRunFailure (K-P2-1)", () => {
  it("maps the runtime credential lookup codes to Connections repairs", () => {
    const noBinding = mapConnectRunFailure(
      "Provider credentials missing (no_provider_binding)",
      BASE,
    );
    expect(noBinding?.fixHref).toBe(`${BASE}/integrations`);
    expect(noBinding?.title).toMatch(/not bound/i);

    const gone = mapConnectRunFailure(
      "Provider credentials missing (integration_not_found)",
      BASE,
    );
    expect(gone?.fixHref).toBe(`${BASE}/integrations`);
    expect(gone?.title).toMatch(/no longer exists/i);

    const dead = mapConnectRunFailure(
      "Route fallback exhausted after: Provider credentials missing (credential_unavailable)",
      BASE,
    );
    expect(dead?.fixLabel).toBe("Re-enter key");
  });

  it("maps unsupported chat/embedding providers to the Models page", () => {
    const chat = mapConnectRunFailure(
      "Provider anthropic is not OpenAI-compatible for Knowledge ingestion yet",
      BASE,
    );
    expect(chat?.fixHref).toBe(`${BASE}/connect/models`);

    const embed = mapConnectRunFailure(
      "Embedding via anthropic is not supported in Connect ingest yet — use openai, voyage, together, or vercel",
      BASE,
    );
    expect(embed?.fixHref).toBe(`${BASE}/connect/models`);
    expect(embed?.title).toMatch(/embedding/i);
  });

  it("returns null for unknown errors and empty input — raw rendering unchanged", () => {
    expect(mapConnectRunFailure("HTTP 500 from upstream", BASE)).toBeNull();
    expect(mapConnectRunFailure(null, BASE)).toBeNull();
    expect(mapConnectRunFailure(undefined, BASE)).toBeNull();
    expect(mapConnectRunFailure("", BASE)).toBeNull();
  });
});
