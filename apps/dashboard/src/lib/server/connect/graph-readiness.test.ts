import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("$lib/server/connect/graph-explorer-service", () => ({
  peekConnectGraphStats: vi.fn(),
}));
vi.mock("$lib/server/connect/graph-source-link-options", () => ({
  loadGraphSourceLinkOptions: vi.fn(),
}));
vi.mock("$lib/server/connect/graph-provenance-audit", () => ({
  loadGraphProvenanceAudit: vi.fn(),
}));
vi.mock("$lib/server/connect/graph-source-catalog-status", () => ({
  loadGraphSourceCatalogStatus: vi.fn(),
}));
vi.mock("$lib/server/neon", () => ({
  getConnectGraphTargetForWorkspace: vi.fn(),
}));

import { peekConnectGraphStats } from "$lib/server/connect/graph-explorer-service";
import { loadGraphSourceLinkOptions } from "$lib/server/connect/graph-source-link-options";
import { loadGraphProvenanceAudit } from "$lib/server/connect/graph-provenance-audit";
import { loadGraphSourceCatalogStatus } from "$lib/server/connect/graph-source-catalog-status";
import { getConnectGraphTargetForWorkspace } from "$lib/server/neon";
import { evaluateGraphReadiness } from "./graph-readiness";

describe("evaluateGraphReadiness", () => {
  beforeEach(() => {
    vi.mocked(getConnectGraphTargetForWorkspace).mockResolvedValue({
      provider: "surreal",
    } as never);
    vi.mocked(loadGraphSourceCatalogStatus).mockResolvedValue({
      pipelineCatalogCount: 224,
      sourcesInPipeline: true,
    });
    vi.mocked(loadGraphSourceLinkOptions).mockResolvedValue({
      enabled: true,
      unitsNeedingLink: 0,
      candidateSources: 224,
      totalUnits: 33980,
    });
    vi.mocked(loadGraphProvenanceAudit).mockResolvedValue({
      store: "surreal",
      totalUnits: 33980,
      graphLinked: 33980,
      unlinked: 0,
      legacyPlaceholder: 0,
      needsEdgeRepair: 0,
      pipelineCatalogSources: 224,
      verdict: "native",
      headline: "Graph-native",
    });
    vi.mocked(peekConnectGraphStats).mockResolvedValue({
      units: 33980,
      embedded: 33980,
      relations: 0,
      groups: 0,
      validation: {
        ok: 0,
        weak: 0,
        unsupported: 0,
        unvalidated: 100,
        awaiting_triage: 5,
        unsupported_untriaged: 0,
      },
    });
  });

  it("blocks auto-remediation when validation backlog remains", async () => {
    const result = await evaluateGraphReadiness("ws-1");
    expect(result.catalogComplete).toBe(true);
    expect(result.linkComplete).toBe(true);
    expect(result.embedComplete).toBe(true);
    expect(result.validateComplete).toBe(false);
    expect(result.complete).toBe(false);
    expect(result.blockers.some((b) => b.includes("validation"))).toBe(true);
  });

  it("allows auto-remediation when all readiness steps are satisfied", async () => {
    vi.mocked(peekConnectGraphStats).mockResolvedValue({
      units: 100,
      embedded: 100,
      relations: 0,
      groups: 0,
      validation: {
        ok: 80,
        weak: 10,
        unsupported: 10,
        unvalidated: 0,
        awaiting_triage: 2,
        unsupported_untriaged: 0,
      },
    });
    const result = await evaluateGraphReadiness("ws-1");
    expect(result.complete).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });
});
