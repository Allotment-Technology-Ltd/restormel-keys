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
      expect(r.config.suites[0]?.goals.map((g) => g.id)).toEqual(["home-welcome", "hero-heading-exact"]);
    }
  });

  it("rejects config paths that escape allowedRoot", async () => {
    const outside = join(repoRoot, "..", "outside-restormel-config.yaml");
    const r = await loadConfigFromFile(outside, { allowedRoot: repoRoot });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.code === "io")).toBe(true);
  });

  it("rejects non-empty adapter_hooks (MVP runner does not execute them)", () => {
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
              success_criteria: { url_matches: "/" },
            },
          ],
        },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === "unsupported_mvp" && e.path === "adapter_hooks")).toBe(true);
    }
  });

  it("rejects goal preconditions (MVP runner does not execute them)", () => {
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
              preconditions: ["seed-db"],
              success_criteria: { url_matches: "/" },
            },
          ],
        },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === "unsupported_mvp" && e.path.includes("preconditions"))).toBe(
        true,
      );
    }
  });
});
