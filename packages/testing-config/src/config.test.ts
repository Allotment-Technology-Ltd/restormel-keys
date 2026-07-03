import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadConfigFromFile, loadConfigFromString } from "./load.js";
import { resolveSuite, validateConfigDocument } from "./validate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Repo root (tests may run with any `process.cwd()`). */
const repoRoot = join(__dirname, "../../..");
const exampleYamlPath = join(repoRoot, "examples/testing-basic-web/restormel-testing.yaml");

describe("loadConfigFromString", () => {
  it("accepts a valid YAML document", () => {
    const yaml = `
schema_version: "1"
environments:
  staging:
    base_url: https://example.com
suites:
  - id: web-critical
    environment: staging
    goals:
      - id: g1
        type: browser
        description: d
        success_criteria:
          url_matches: "/"
`;
    const r = loadConfigFromString(yaml, "yaml");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.schemaVersion).toBe("1");
      expect(r.config.suites[0]?.id).toBe("web-critical");
      expect(r.config.suites[0]?.retryPolicy?.maxRetries).toBeUndefined();
    }
  });

  it("accepts valid JSON", () => {
    const json = JSON.stringify({
      schemaVersion: "1",
      environments: {
        e1: { baseUrl: "https://ex.test" },
      },
      suites: [
        {
          id: "s1",
          environment: "e1",
          goals: [
            {
              id: "g1",
              type: "browser",
              description: "x",
              successCriteria: { textPresent: ["ok"] },
            },
          ],
        },
      ],
    });
    const r = loadConfigFromString(json, "json");
    expect(r.ok).toBe(true);
  });

  it("rejects missing schema_version", () => {
    const r = loadConfigFromString(
      `
environments:
  a:
    base_url: https://a.test
suites:
  - id: s
    environment: a
    goals:
      - id: g
        type: browser
        description: d
        success_criteria:
          url_matches: "/"
`,
      "yaml",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === "required" && e.path === "schema_version")).toBe(true);
    }
  });

  it("rejects empty suites", () => {
    const r = validateConfigDocument({
      schema_version: "1",
      environments: { a: { base_url: "https://a.test" } },
      suites: [],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.path === "suites")).toBe(true);
    }
  });

  it("rejects suite referencing unknown environment", () => {
    const r = validateConfigDocument({
      schema_version: "1",
      environments: { local: { base_url: "http://127.0.0.1:8080" } },
      suites: [
        {
          id: "s1",
          environment: "production",
          goals: [
            {
              id: "g1",
              type: "browser",
              description: "d",
              success_criteria: { url_matches: "/" },
            },
          ],
        },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === "unknown_environment")).toBe(true);
    }
  });

  it("rejects invalid goal type", () => {
    const r = validateConfigDocument({
      schema_version: "1",
      environments: { local: { base_url: "http://127.0.0.1:8080" } },
      suites: [
        {
          id: "s1",
          environment: "local",
          goals: [
            {
              id: "g1",
              type: "robot",
              description: "d",
              success_criteria: { url_matches: "/" },
            },
          ],
        },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.path.endsWith(".type") && e.code === "enum")).toBe(true);
    }
  });

  it("rejects empty success_criteria", () => {
    const r = validateConfigDocument({
      schema_version: "1",
      environments: { local: { base_url: "http://127.0.0.1:8080" } },
      suites: [
        {
          id: "s1",
          environment: "local",
          goals: [
            {
              id: "g1",
              type: "browser",
              description: "d",
              success_criteria: {},
            },
          ],
        },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === "success_criteria_empty")).toBe(true);
    }
  });

  it("rejects keys slot that looks like a secret", () => {
    const r = validateConfigDocument({
      schema_version: "1",
      keys: { bad: "sk-12345678901234567890123456789012" },
      environments: { local: { base_url: "http://127.0.0.1:8080" } },
      suites: [
        {
          id: "s1",
          environment: "local",
          goals: [
            {
              id: "g1",
              type: "browser",
              description: "d",
              success_criteria: { url_matches: "/" },
            },
          ],
        },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === "unsafe")).toBe(true);
    }
  });

  it("rejects opaque keys ref with wrong format", () => {
    const r = validateConfigDocument({
      schema_version: "1",
      keys: { llm: "https://api.openai.com/v1" },
      environments: { local: { base_url: "http://127.0.0.1:8080" } },
      suites: [
        {
          id: "s1",
          environment: "local",
          goals: [
            {
              id: "g1",
              type: "browser",
              description: "d",
              success_criteria: { url_matches: "/" },
            },
          ],
        },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === "ref_format")).toBe(true);
    }
  });

  it("rejects unknown root key", () => {
    const r = validateConfigDocument({
      schema_version: "1",
      surprise: true,
      environments: { local: { base_url: "http://127.0.0.1:8080" } },
      suites: [
        {
          id: "s1",
          environment: "local",
          goals: [
            {
              id: "g1",
              type: "browser",
              description: "d",
              success_criteria: { url_matches: "/" },
            },
          ],
        },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === "unknown_root_key")).toBe(true);
    }
  });

  it("resolveSuite fails for missing suite id", async () => {
    const r = await loadConfigFromFile(exampleYamlPath, { allowedRoot: repoRoot });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const missing = resolveSuite(r.config, "does-not-exist");
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.errors[0]?.code).toBe("suite_not_found");
    }
    const found = resolveSuite(r.config, "web-critical");
    expect(found.ok).toBe(true);
  });

  it("loads examples/testing-basic-web/restormel-testing.yaml", async () => {
    const r = await loadConfigFromFile(exampleYamlPath, { allowedRoot: repoRoot });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.suites.some((s) => s.id === "web-critical")).toBe(true);
      expect(r.config.defaults?.retryPolicy?.maxRetries).toBe(1);
      expect(r.config.suites[0]?.defaultTimeoutMs).toBe(30_000);
      expect(r.config.suites[0]?.goals.map((g) => g.id)).toEqual(["home-shell", "about-shell"]);
    }
  });

  it("rejects config paths that escape allowedRoot", async () => {
    const outside = join(repoRoot, "..", "outside-restormel-config.yaml");
    const r = await loadConfigFromFile(outside, { allowedRoot: repoRoot });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.code === "io")).toBe(true);
  });

  it("accepts environments egress_allow_hosts", () => {
    const r = validateConfigDocument({
      schema_version: "1",
      environments: {
        local: {
          base_url: "https://app.example.com",
          egress_allow_hosts: ["api.example.com", "https://cdn.example.net/path"],
        },
      },
      suites: [
        {
          id: "s1",
          environment: "local",
          goals: [
            {
              id: "g1",
              type: "browser",
              description: "d",
              success_criteria: { url_matches: "/" },
            },
          ],
        },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.environments.local?.egressAllowHosts).toEqual([
        "api.example.com",
        "https://cdn.example.net/path",
      ]);
    }
  });

  it("accepts adapter_hooks and preconditions (runner executes them unless RESTORMEL_TESTING_SKIP_SHELL_HOOKS=1)", () => {
    const r = validateConfigDocument({
      schema_version: "1",
      environments: { local: { base_url: "https://example.com" } },
      adapter_hooks: { setup: "echo noop" },
      suites: [
        {
          id: "s1",
          environment: "local",
          goals: [
            {
              id: "g1",
              type: "browser",
              description: "d",
              preconditions: ["echo precondition"],
              success_criteria: { url_matches: "/" },
            },
          ],
        },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it("rejects any_of with fewer than two branches", () => {
    const r = validateConfigDocument({
      schema_version: "1",
      environments: { local: { base_url: "https://example.com" } },
      suites: [
        {
          id: "s1",
          environment: "local",
          goals: [
            {
              id: "g1",
              type: "browser",
              description: "d",
              success_criteria: {
                any_of: [{ url_matches: "/" }],
              },
            },
          ],
        },
      ],
    });
    expect(r.ok).toBe(false);
  });

  it("accepts any_of with two branches", () => {
    const r = validateConfigDocument({
      schema_version: "1",
      environments: { local: { base_url: "https://example.com" } },
      suites: [
        {
          id: "s1",
          environment: "local",
          goals: [
            {
              id: "g1",
              type: "browser",
              description: "d",
              success_criteria: {
                any_of: [{ dom_signals: ["#a"] }, { dom_signals: ["#b"] }],
              },
            },
          ],
        },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it("accepts execution_mode agent with mission and mission_executor", () => {
    const r = validateConfigDocument({
      schema_version: "1",
      environments: { local: { base_url: "https://example.com" } },
      suites: [
        {
          id: "s1",
          environment: "local",
          goals: [
            {
              id: "g1",
              type: "browser",
              description: "Agent checkout flow",
              execution_mode: "agent",
              mission: "Complete checkout",
              mission_executor: "pnpm run agent:checkout",
              success_criteria: { url_matches: "/done" },
            },
          ],
        },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const g = r.config.suites[0]?.goals[0];
      expect(g?.executionMode).toBe("agent");
      expect(g?.mission).toBe("Complete checkout");
    }
  });

  it("allows after_agent.success_criteria without top-level success_criteria for agent goals", () => {
    const r = validateConfigDocument({
      schema_version: "1",
      environments: { local: { base_url: "https://example.com" } },
      suites: [
        {
          id: "s1",
          environment: "local",
          goals: [
            {
              id: "g1",
              type: "browser",
              description: "d",
              execution_mode: "agent",
              mission: "m",
              mission_executor: "true",
              after_agent: {
                start_path: "/app",
                success_criteria: { text_present: ["Done"] },
              },
            },
          ],
        },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it("accepts execution_mode ac_sequence with ac_sequence block and auto acceptance_criterion_ids", () => {
    const r = validateConfigDocument({
      schema_version: "1",
      environments: { local: { base_url: "https://example.com" } },
      suites: [
        {
          id: "s1",
          environment: "local",
          acceptance_criteria: [
            { id: "ac-1", text: "First" },
            { id: "ac-2", text: "Second" },
          ],
          goals: [
            {
              id: "g1",
              type: "browser",
              description: "Walk ACs",
              execution_mode: "ac_sequence",
              ac_sequence: {
                built_in_agent: { max_rounds_per_criterion: 4 },
              },
            },
          ],
        },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const g = r.config.suites[0]?.goals[0];
      expect(g?.executionMode).toBe("ac_sequence");
      expect(g?.acceptanceCriterionIds).toEqual(["ac-1", "ac-2"]);
      expect(g?.acSequence?.builtInAgent.maxRoundsPerCriterion).toBe(4);
    }
  });

  it("rejects ac_sequence without suite acceptance_criteria", () => {
    const r = validateConfigDocument({
      schema_version: "1",
      environments: { local: { base_url: "https://example.com" } },
      suites: [
        {
          id: "s1",
          environment: "local",
          goals: [
            {
              id: "g1",
              type: "browser",
              description: "d",
              execution_mode: "ac_sequence",
              ac_sequence: { built_in_agent: {} },
            },
          ],
        },
      ],
    });
    expect(r.ok).toBe(false);
  });

  it("rejects ac_sequence block when execution_mode is observe", () => {
    const r = validateConfigDocument({
      schema_version: "1",
      environments: { local: { base_url: "https://example.com" } },
      suites: [
        {
          id: "s1",
          environment: "local",
          acceptance_criteria: [{ id: "ac-1", text: "t" }],
          goals: [
            {
              id: "g1",
              type: "browser",
              description: "d",
              success_criteria: { url_matches: "/" },
              ac_sequence: { built_in_agent: {} },
            },
          ],
        },
      ],
    });
    expect(r.ok).toBe(false);
  });

  it("rejects mission_executor on observe browser goals", () => {
    const r = validateConfigDocument({
      schema_version: "1",
      environments: { local: { base_url: "https://example.com" } },
      suites: [
        {
          id: "s1",
          environment: "local",
          goals: [
            {
              id: "g1",
              type: "browser",
              description: "d",
              mission_executor: "true",
              success_criteria: { url_matches: "/" },
            },
          ],
        },
      ],
    });
    expect(r.ok).toBe(false);
  });

  it("rejects after_agent on observe goals", () => {
    const r = validateConfigDocument({
      schema_version: "1",
      environments: { local: { base_url: "https://example.com" } },
      suites: [
        {
          id: "s1",
          environment: "local",
          goals: [
            {
              id: "g1",
              type: "browser",
              description: "d",
              after_agent: { start_path: "/x" },
              success_criteria: { url_matches: "/" },
            },
          ],
        },
      ],
    });
    expect(r.ok).toBe(false);
  });

  it("loads examples/testing-business-acceptance/restormel-testing.yaml", async () => {
    const p = join(repoRoot, "examples/testing-business-acceptance/restormel-testing.yaml");
    const r = await loadConfigFromFile(p, { allowedRoot: repoRoot });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const s = r.config.suites.find((x) => x.id === "household-planning-story");
      expect(s?.userStory).toMatch(/household work/);
      expect(s?.acceptanceCriteria?.map((c) => c.id)).toEqual([
        "ac-001-create-project",
        "ac-002-add-phase",
        "ac-003-add-task",
        "ac-004-add-supply",
      ]);
      expect(s?.goals[0]?.acceptanceCriterionIds?.length).toBe(4);
    }
  });

  it("rejects acceptance_criterion_ids when suite has no acceptance_criteria", () => {
    const r = validateConfigDocument({
      schema_version: "1",
      environments: { local: { base_url: "https://example.com" } },
      suites: [
        {
          id: "s1",
          environment: "local",
          goals: [
            {
              id: "g1",
              type: "browser",
              description: "d",
              acceptance_criterion_ids: ["ac-1"],
              success_criteria: { url_matches: "/" },
            },
          ],
        },
      ],
    });
    expect(r.ok).toBe(false);
  });

  it("rejects unknown acceptance_criterion id on goal", () => {
    const r = validateConfigDocument({
      schema_version: "1",
      environments: { local: { base_url: "https://example.com" } },
      suites: [
        {
          id: "s1",
          environment: "local",
          acceptance_criteria: [{ id: "ac-1", text: "t" }],
          goals: [
            {
              id: "g1",
              type: "browser",
              description: "d",
              acceptance_criterion_ids: ["ac-999"],
              success_criteria: { url_matches: "/" },
            },
          ],
        },
      ],
    });
    expect(r.ok).toBe(false);
  });

  it("rejects duplicate acceptance_criteria ids", () => {
    const r = validateConfigDocument({
      schema_version: "1",
      environments: { local: { base_url: "https://example.com" } },
      suites: [
        {
          id: "s1",
          environment: "local",
          acceptance_criteria: [
            { id: "ac-1", text: "a" },
            { id: "ac-1", text: "b" },
          ],
          goals: [
            {
              id: "g1",
              type: "browser",
              description: "d",
              acceptance_criterion_ids: ["ac-1"],
              success_criteria: { url_matches: "/" },
            },
          ],
        },
      ],
    });
    expect(r.ok).toBe(false);
  });

  it("accepts suite llm_budget and maps to TestSuite.llmBudget", () => {
    const r = validateConfigDocument({
      schema_version: "1",
      environments: { local: { base_url: "https://example.com" } },
      suites: [
        {
          id: "s1",
          environment: "local",
          llm_budget: {
            max_rounds: 20,
            max_wall_clock_ms: 120_000,
            max_completions: 50,
          },
          goals: [
            {
              id: "g1",
              type: "browser",
              description: "d",
              success_criteria: { url_matches: "/" },
            },
          ],
        },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const su = resolveSuite(r.config, "s1");
    expect(su.ok).toBe(true);
    if (!su.ok) return;
    expect(su.suite.llmBudget).toEqual({
      maxRounds: 20,
      maxWallClockMs: 120_000,
      maxCompletions: 50,
    });
  });

  it("rejects goal llm_budget.max_wall_clock_ms (suite-only)", () => {
    const r = validateConfigDocument({
      schema_version: "1",
      environments: { local: { base_url: "https://example.com" } },
      suites: [
        {
          id: "s1",
          environment: "local",
          goals: [
            {
              id: "g1",
              type: "browser",
              description: "d",
              success_criteria: { url_matches: "/" },
              llm_budget: { max_wall_clock_ms: 1 },
            },
          ],
        },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === "forbidden" && e.path.includes("max_wall_clock_ms"))).toBe(true);
    }
  });
});
