import { describe, expect, it, vi } from "vitest";
import { formatConfigErrors, loadConfigFromString } from "@restormel/testing-config";
import { createStubKeysTransport } from "@restormel/testing-keys-adapter";
import type { TestingBrowserSession } from "@restormel/testing-browser-playwright";
import type { Locator, Page } from "playwright";
import { runSuiteFromConfig } from "./run-suite.js";

const JUDGE_REF = "ref:restormel-keys:test/judge";

function loadConfig(yaml: string) {
  const r = loadConfigFromString(yaml, "yaml");
  if (!r.ok) {
    throw new Error(formatConfigErrors(r.errors));
  }
  return r.config;
}

function createLocatorMock(
  handlers: Partial<{ innerText: string; count: number; visible: boolean }> = {},
): Locator {
  const chain = {
    first: () => chain,
    count: async () => handlers.count ?? 1,
    innerText: async () => handlers.innerText ?? "",
    isVisible: async () => handlers.visible ?? true,
    waitFor: async () => {
      /* noop */
    },
  };
  return chain as unknown as Locator;
}

function createPageMock(opts: {
  url?: string;
  bodyText?: string;
  bySelector?: Record<string, Partial<{ innerText: string; count: number; visible: boolean }>>;
}): Page {
  const url = opts.url ?? "https://example.com/app";
  return {
    url: () => url,
    locator: (sel: string) => {
      if (sel === "body") {
        return createLocatorMock({ innerText: opts.bodyText ?? "" }) as unknown as Locator;
      }
      const h = opts.bySelector?.[sel];
      return createLocatorMock(h ?? { count: 0, innerText: "", visible: false });
    },
    setDefaultTimeout: () => {
      /* noop */
    },
    setDefaultNavigationTimeout: () => {
      /* noop */
    },
  } as unknown as Page;
}

function createMockBrowserSession(page: Page): TestingBrowserSession {
  return {
    page,
    navigate: async () => {
      /* noop */
    },
    click: async () => {
      /* noop */
    },
    fill: async () => {
      /* noop */
    },
    waitForLoad: async () => {
      /* noop */
    },
    waitForVisible: async () => {
      /* noop */
    },
    getVisibleText: async () => "",
    screenshot: async () => ({ kind: "screenshot", path: "/tmp/x.png", mimeType: "image/png" }),
    getConsoleSnapshot: () => [],
    getNetworkSnapshot: () => [],
    drainTraceEntries: () => [],
    dispose: async () => {
      /* noop */
    },
  };
}

const baseYaml = `
schema_version: "1"
environments:
  local:
    base_url: https://example.com
suites:
  - id: suite-a
    environment: local
    goals:
      - id: g1
        type: browser
        description: Test goal
        success_criteria:
          text_present:
            - Hello
`;

describe("runSuiteFromConfig", () => {
  it("happy path: assertion passes on first attempt", async () => {
    const config = loadConfig(baseYaml);
    const res = await runSuiteFromConfig({
      config,
      suiteId: "suite-a",
      createBrowserSession: async () => createMockBrowserSession(createPageMock({ bodyText: "Hello world" })),
    });
    expect(res.ok).toBe(true);
    expect(res.run?.verdict).toBe("passed");
    expect(res.run?.goalRuns[0]?.verdict).toBe("passed");
    expect(res.run?.goalRuns[0]?.retriesUsed).toBe(0);
    expect(res.suiteMeta?.id).toBe("suite-a");
    expect(res.suiteMeta?.goalCount).toBe(1);
  });

  it("missing environment → ok false with errors", async () => {
    const config = loadConfig(baseYaml);
    const res = await runSuiteFromConfig({
      config,
      suiteId: "suite-a",
      environmentId: "nonexistent-env",
    });
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toMatch(/nonexistent-env|No environment/i);
    expect(res.run).toBeUndefined();
  });

  it("failed assertion with no retries", async () => {
    const yaml = baseYaml.replace("goals:", "retry_policy:\n      max_retries: 0\n    goals:");
    const config = loadConfig(yaml);
    const res = await runSuiteFromConfig({
      config,
      suiteId: "suite-a",
      createBrowserSession: async () => createMockBrowserSession(createPageMock({ bodyText: "nope" })),
    });
    expect(res.ok).toBe(true);
    expect(res.run?.verdict).toBe("failed");
    expect(res.run?.goalRuns[0]?.reasonCode).toBe("TEXT_NOT_FOUND");
    expect(res.run?.goalRuns[0]?.retriesUsed).toBe(0);
  });

  it("retry then pass", async () => {
    const yaml = baseYaml.replace("goals:", "retry_policy:\n      max_retries: 2\n    goals:");
    const config = loadConfig(yaml);
    let attempt = 0;
    const res = await runSuiteFromConfig({
      config,
      suiteId: "suite-a",
      createBrowserSession: async () => {
        const body = attempt++ === 0 ? "missing" : "Hello there";
        return createMockBrowserSession(createPageMock({ bodyText: body }));
      },
    });
    expect(res.ok).toBe(true);
    expect(res.run?.verdict).toBe("passed");
    expect(res.run?.goalRuns[0]?.retriesUsed).toBe(1);
  });

  it("retry then indeterminate (judge uncertain after assertion passes)", async () => {
    const yaml = `
schema_version: "1"
environments:
  local:
    base_url: https://example.com
    keys:
      llm_primary: '${JUDGE_REF}'
suites:
  - id: suite-a
    environment: local
    retry_policy:
      max_retries: 2
    goals:
      - id: g1
        type: browser
        description: Judge goal
        success_criteria:
          text_present:
            - SEED_OK_TOKEN
          judge_rubric:
            id: jr1
            summary: Is the page ready?
`;
    const config = loadConfig(yaml);
    process.env.RESTORMEL_TESTING_STUB_KEY = "stub-key-not-real";

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ verdict: "uncertain" }) } }],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    let attempt = 0;
    const res = await runSuiteFromConfig({
      config,
      suiteId: "suite-a",
      keysAdapterOptions: {
        transport: createStubKeysTransport({
          [JUDGE_REF]: {
            provider: "openai",
            model: "gpt-4o-mini",
            secretEnvVar: "RESTORMEL_TESTING_STUB_KEY",
          },
        }),
      },
      createBrowserSession: async () => {
        const body = attempt++ === 0 ? "not ready yet" : "ok SEED_OK_TOKEN done";
        return createMockBrowserSession(createPageMock({ bodyText: body }));
      },
    });

    vi.unstubAllGlobals();

    expect(res.ok).toBe(true);
    expect(res.run?.verdict).toBe("indeterminate");
    expect(res.run?.goalRuns[0]?.reasonCode).toBe("JUDGE_UNCERTAIN");
    expect(res.run?.goalRuns[0]?.retriesUsed).toBe(1);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("adapter failure: session create throws → failed, no retries", async () => {
    const yaml = baseYaml.replace("goals:", "retry_policy:\n      max_retries: 2\n    goals:");
    const config = loadConfig(yaml);
    const res = await runSuiteFromConfig({
      config,
      suiteId: "suite-a",
      createBrowserSession: async () => {
        throw new Error("playwright launch failed");
      },
    });
    expect(res.ok).toBe(true);
    expect(res.run?.verdict).toBe("failed");
    expect(res.run?.goalRuns[0]?.reasonCode).toBe("ADAPTER_ERROR");
    expect(res.run?.goalRuns[0]?.retriesUsed).toBe(0);
  });

  it("rejects invalid target_url override", async () => {
    const config = loadConfig(baseYaml);
    const res = await runSuiteFromConfig({
      config,
      suiteId: "suite-a",
      targetUrlOverride: "not-a-valid-url",
    });
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toMatch(/target_url|Invalid/i);
  });

  it("execution_mode agent: runs mission_executor then evaluates post-mission criteria", async () => {
    const yaml = `
schema_version: "1"
environments:
  local:
    base_url: https://example.com
suites:
  - id: suite-a
    environment: local
    goals:
      - id: g-agent
        type: browser
        description: Agent goal smoke test
        execution_mode: agent
        mission: "noop mission for test"
        mission_executor: 'node -e "process.exit(0)"'
        success_criteria:
          text_present:
            - Hello
`;
    const config = loadConfig(yaml);
    const res = await runSuiteFromConfig({
      config,
      suiteId: "suite-a",
      createBrowserSession: async () => createMockBrowserSession(createPageMock({ bodyText: "Hello world" })),
    });
    expect(res.ok).toBe(true);
    expect(res.run?.verdict).toBe("passed");
    expect(res.run?.goalRuns[0]?.verdict).toBe("passed");
  });

  it("acceptance criteria roll up from goals linked via acceptance_criterion_ids", async () => {
    const yaml = `
schema_version: "1"
environments:
  local:
    base_url: https://example.com
suites:
  - id: suite-a
    environment: local
    acceptance_criteria:
      - id: ac-1
        text: First outcome
      - id: ac-2
        text: Second outcome
    goals:
      - id: g1
        type: browser
        description: d1
        acceptance_criterion_ids: [ac-1]
        success_criteria:
          text_present:
            - Hello
      - id: g2
        type: browser
        description: d2
        acceptance_criterion_ids: [ac-2]
        success_criteria:
          text_present:
            - Missing
`;
    const config = loadConfig(yaml);
    const res = await runSuiteFromConfig({
      config,
      suiteId: "suite-a",
      createBrowserSession: async () => createMockBrowserSession(createPageMock({ bodyText: "Hello world" })),
    });
    expect(res.ok).toBe(true);
    expect(res.run?.acceptanceResults).toHaveLength(2);
    const byId = new Map(res.run!.acceptanceResults!.map((a) => [a.id, a]));
    expect(byId.get("ac-1")?.verdict).toBe("passed");
    expect(byId.get("ac-2")?.verdict).toBe("failed");
  });

  it("acceptanceCriterionIds filter runs only mapped goals and marks other ACs skipped", async () => {
    const yaml = `
schema_version: "1"
environments:
  local:
    base_url: https://example.com
suites:
  - id: suite-a
    environment: local
    acceptance_criteria:
      - id: ac-1
        text: First
      - id: ac-2
        text: Second
    goals:
      - id: g1
        type: browser
        description: d1
        acceptance_criterion_ids: [ac-1]
        success_criteria:
          text_present:
            - Hello
      - id: g2
        type: browser
        description: d2
        acceptance_criterion_ids: [ac-2]
        success_criteria:
          text_present:
            - Nope
`;
    const config = loadConfig(yaml);
    const res = await runSuiteFromConfig({
      config,
      suiteId: "suite-a",
      acceptanceCriterionIds: ["ac-1"],
      createBrowserSession: async () => createMockBrowserSession(createPageMock({ bodyText: "Hello world" })),
    });
    expect(res.ok).toBe(true);
    expect(res.run?.goalRuns).toHaveLength(1);
    expect(res.run?.goalRuns[0]?.goalId).toBe("g1");
    const byId = new Map(res.run!.acceptanceResults!.map((a) => [a.id, a]));
    expect(byId.get("ac-1")?.verdict).toBe("passed");
    expect(byId.get("ac-2")?.verdict).toBe("skipped");
  });

  it("execution_mode agent: mission_executor non-zero → MISSION_EXECUTOR_FAILED", async () => {
    const yaml = `
schema_version: "1"
environments:
  local:
    base_url: https://example.com
suites:
  - id: suite-a
    environment: local
    goals:
      - id: g-agent
        type: browser
        description: Agent mission executor failure test
        execution_mode: agent
        mission: "fail executor"
        mission_executor: 'node -e "process.exit(3)"'
        success_criteria:
          text_present:
            - Hello
`;
    const config = loadConfig(yaml);
    const res = await runSuiteFromConfig({
      config,
      suiteId: "suite-a",
      createBrowserSession: async () => createMockBrowserSession(createPageMock({ bodyText: "Hello world" })),
    });
    expect(res.ok).toBe(true);
    expect(res.run?.verdict).toBe("failed");
    expect(res.run?.goalRuns[0]?.reasonCode).toBe("MISSION_EXECUTOR_FAILED");
  });
});
