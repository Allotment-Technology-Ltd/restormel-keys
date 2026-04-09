import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  suiteMemoryPreview,
  suiteResolveCanonical,
  suiteSummarizeTrace,
  suiteValidateGraphFixture,
  suiteValidateTestingConfig,
} from "./suite-tools-logic.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "../test/fixtures");

function readFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf8");
}

describe("Horizon suite MCP logic", () => {
  it("docs.canonical_resolve: known topic", () => {
    const r = suiteResolveCanonical("horizon_programme");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.entry.repoPath).toContain("HORIZON-PLATFORM-PROGRAMME");
    }
  });

  it("docs.canonical_resolve: unknown topic returns RST_SUITE_UNKNOWN_TOPIC", () => {
    const r = suiteResolveCanonical("not_a_topic");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("RST_SUITE_UNKNOWN_TOPIC");
      expect(r.message).toMatch(/Unknown topic/);
    }
  });

  it("testing.config_validate: valid YAML", () => {
    const r = suiteValidateTestingConfig(readFixture("testing-valid.yaml"), "yaml");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valid).toBe(true);
  });

  it("testing.config_validate: invalid YAML returns structured errors", () => {
    const r = suiteValidateTestingConfig(readFixture("testing-invalid.yaml"), "yaml");
    expect(r.ok).toBe(true);
    if (r.ok && r.valid === false) {
      expect(Array.isArray(r.errors)).toBe(true);
      expect(r.errors.length).toBeGreaterThan(0);
      const first = r.errors[0];
      expect(first).toMatchObject({
        path: expect.any(String),
        code: expect.any(String),
        message: expect.any(String),
      });
    }
  });

  it("observability.trace_summarize: minimal RunTrace", () => {
    const r = suiteSummarizeTrace(readFixture("trace-min.json"));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.summary).toMatch(/traceId=/);
      expect(r.eventCount).toBe(1);
      expect(typeof r.traceId).toBe("string");
    }
  });

  it("graph.fixture_validate: empty GraphData", () => {
    const r = suiteValidateGraphFixture(readFixture("graph-valid.json"));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.nodeCount).toBe(0);
      expect(r.edgeCount).toBe(0);
    }
  });

  it("graph.fixture_validate: bad shape returns RST_SUITE_GRAPH_SHAPE", () => {
    const r = suiteValidateGraphFixture("{}");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("RST_SUITE_GRAPH_SHAPE");
  });

  it("state.memory_preview: redacts text, returns lengths", () => {
    const r = suiteMemoryPreview(readFixture("state-events.json"));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.scope_ids).toContain("session");
      expect(r.cells_preview?.[0]?.textLength).toBe(5);
      expect(JSON.stringify(r)).not.toContain("hello");
    }
  });
});
