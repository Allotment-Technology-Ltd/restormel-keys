/**
 * Structured onboarding / next-step content for MCP `testing.journey` and human docs alignment.
 * Dashboard paths are hosted examples; self-host replaces origin only.
 */

export type JourneyStep = {
  title: string;
  detail: string;
  dashboardHref?: string;
  docsHref?: string;
  suggestedMcpTools?: string[];
};

export type JourneyPhase = {
  id: string;
  title: string;
  goal: string;
  steps: JourneyStep[];
};

const HOST = "https://restormel.dev";

const PHASES_ALL: JourneyPhase[] = [
  {
    id: "account",
    title: "Account & orientation",
    goal: "Land in the dashboard and know where to go next.",
    steps: [
      {
        title: "Open Overview",
        detail: "Progress checklist, Restormel Testing in CI track, and quick links.",
        dashboardHref: `${HOST}/keys/dashboard`,
        docsHref: `${HOST}/keys/docs`,
        suggestedMcpTools: ["docs.search"],
      },
    ],
  },
  {
    id: "testing_ci",
    title: "Restormel Testing in CI (judge / resolve)",
    goal: "Run @restormel/testing-cli with Keys-backed models without wiring live traffic rules first.",
    steps: [
      {
        title: "Connections",
        detail: "Add a hosted provider key or vault reference (encrypted at rest when configured).",
        dashboardHref: `${HOST}/keys/dashboard/integrations`,
        docsHref: `${HOST}/keys/docs/guides/keys-testing-onboarding`,
        suggestedMcpTools: ["testing.ci_env_template", "testing.hub_snapshot", "docs.search"],
      },
      {
        title: "Gateway keys",
        detail: "Create an rk_… key scoped to your project for automation (not the raw provider secret).",
        dashboardHref: `${HOST}/keys/dashboard/access`,
        suggestedMcpTools: ["projects.list", "project.gateway_keys.list", "project.gateway_keys.create", "testing.resolve_probe"],
      },
      {
        title: "Restormel Testing hub",
        detail: "Copy RESTORMEL_KEYS_BASE, RESTORMEL_GATEWAY_KEY, RESTORMEL_PROJECT_ID.",
        dashboardHref: `${HOST}/keys/dashboard/testing`,
        docsHref: `${HOST}/testing/docs/guides/keys-ci-checklist`,
        suggestedMcpTools: [
          "testing.hub_snapshot",
          "project.environments.list",
          "testing.ci_env_template",
          "testing.resolve_probe",
        ],
      },
      {
        title: "Verify locally",
        detail: "pnpm exec testing doctor — checks resolve HTTP status (no body logged).",
        docsHref: `${HOST}/testing/docs/oss-consumption`,
      },
    ],
  },
  {
    id: "keys_routing",
    title: "Keys routing (live traffic)",
    goal: "Send model calls through Restormel routes and fallbacks.",
    steps: [
      {
        title: "Model catalog",
        detail: "Confirm models you plan to route.",
        dashboardHref: `${HOST}/keys/dashboard/models`,
        suggestedMcpTools: ["models.list", "project_models.list", "catalog.sync_check"],
      },
      {
        title: "Rules (routes)",
        detail: "Create routes: primary model + fallbacks.",
        dashboardHref: `${HOST}/keys/dashboard/routes`,
        suggestedMcpTools: ["projects.list", "routes.list", "routes.create", "fallback_chain.set"],
      },
      {
        title: "Test & Preview",
        detail: "Exercise a resolve path before production.",
        dashboardHref: `${HOST}/keys/dashboard/sandbox`,
      },
    ],
  },
  {
    id: "guardrails",
    title: "Guard rails & policy",
    goal: "Enforce allow/deny by plan, role, or model.",
    steps: [
      {
        title: "Guard rails",
        detail: "Attach policies to routes; tune limits.",
        dashboardHref: `${HOST}/keys/dashboard/policies`,
        suggestedMcpTools: ["projects.list", "policies.list", "policies.create", "entitlements.check", "policy.simulate"],
      },
      {
        title: "Policy evaluate (API)",
        detail: "Use RESTORMEL_EVALUATE_URL + Gateway key for live checks from automation.",
        docsHref: `${HOST}/keys/docs/cloud-api`,
      },
    ],
  },
  {
    id: "observability",
    title: "Monitor & operate",
    goal: "See usage, debug failures, validate health.",
    steps: [
      {
        title: "Usage & Analytics",
        detail: "Request volume and routing signals.",
        dashboardHref: `${HOST}/keys/dashboard/analytics`,
      },
      {
        title: "Logs",
        detail: "Debug routing, policy blocks, and latency.",
        dashboardHref: `${HOST}/keys/dashboard/logs`,
      },
      {
        title: "System Health",
        detail: "Operational checks for the deployment.",
        dashboardHref: `${HOST}/keys/dashboard/healthcheck`,
        suggestedMcpTools: ["readiness.check", "testing.resolve_probe"],
      },
    ],
  },
  {
    id: "billing",
    title: "Plan & workspace",
    goal: "Understand limits, upgrade when traffic grows, keep workspace settings current.",
    steps: [
      {
        title: "Billing",
        detail: "Review plan limits and upgrade paths when you outgrow free tier.",
        dashboardHref: `${HOST}/keys/dashboard/billing`,
        docsHref: `${HOST}/keys/pricing`,
      },
      {
        title: "Profile & settings",
        detail: "Account basics; pair with Connections for provider custody.",
        dashboardHref: `${HOST}/keys/dashboard/settings`,
      },
    ],
  },
  {
    id: "developer",
    title: "Automation & agents",
    goal: "IDE, MCP, CI snippets.",
    steps: [
      {
        title: "Dev Tools",
        detail: "MCP, CLI, AAIF entry points.",
        dashboardHref: `${HOST}/keys/dashboard/dev-tools`,
        suggestedMcpTools: [
          "testing.journey",
          "testing.hub_snapshot",
          "projects.list",
          "project_models.list",
          "project.environments.list",
          "docs.search",
        ],
      },
      {
        title: "GitHub Setup",
        detail: "Copy env and workflow snippets for CI.",
        dashboardHref: `${HOST}/keys/dashboard/copy-for-ci`,
      },
    ],
  },
];

const FOCUS_TO_PHASE_IDS: Record<string, string[] | undefined> = {
  all: undefined,
  testing_ci: ["account", "testing_ci"],
  keys_routing: ["account", "keys_routing"],
  guardrails: ["account", "guardrails"],
  observability: ["observability"],
  developer: ["developer"],
  integrations: ["account", "testing_ci", "keys_routing"],
  billing: ["billing", "account"],
};

export function getJourneyPhases(focus: string): { focus: string; phases: JourneyPhase[] } {
  const f = focus.trim().toLowerCase() || "all";
  const ids = FOCUS_TO_PHASE_IDS[f];
  if (!ids) {
    return { focus: f, phases: PHASES_ALL };
  }
  const idSet = new Set(ids);
  return { focus: f, phases: PHASES_ALL.filter((p) => idSet.has(p.id)) };
}

export function testingCiEnvTemplateLines(keysBasePlaceholder: string): {
  lines: string[];
  variableNames: string[];
  docUrls: string[];
} {
  const base = keysBasePlaceholder.trim() || "https://restormel.dev";
  return {
    lines: [
      `RESTORMEL_KEYS_BASE=${base}`,
      "RESTORMEL_GATEWAY_KEY=rk_…your_gateway_key",
      "RESTORMEL_PROJECT_ID=…copy_from_keys_dashboard_testing_hub",
      "",
      "# Compatibility (same values as above):",
      "# RESTORMEL_KEYS_API_BASE_URL=",
      "# RESTORMEL_KEYS_API_TOKEN=",
    ],
    variableNames: [
      "RESTORMEL_KEYS_BASE",
      "RESTORMEL_GATEWAY_KEY",
      "RESTORMEL_PROJECT_ID",
      "RESTORMEL_KEYS_API_BASE_URL",
      "RESTORMEL_KEYS_API_TOKEN",
    ],
    docUrls: [
      "https://restormel.dev/keys/docs/guides/environment-vocabulary",
      "https://restormel.dev/keys/docs/guides/keys-testing-onboarding",
    ],
  };
}
