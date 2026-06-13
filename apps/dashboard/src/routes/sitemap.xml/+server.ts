import type { RequestHandler } from "./$types";
import { resolveModuleFlagsSync } from "$lib/server/module-flags";

// ---------------------------------------------------------------------------
// Public route registry
// All routes that should appear in the sitemap, grouped by feature flag guard.
// Route groups like (marketing) resolve to their real paths (no parens in URL).
// Dashboard/admin/auth/API paths are intentionally excluded.
// ---------------------------------------------------------------------------

/** Always-on public routes (no feature flag required). */
const ALWAYS_ON_PATHS: string[] = [
  // Marketing hub
  "/",
  "/product",
  "/use-cases",
  "/roadmap",
  "/changelog",
  "/founders",
  "/integrations",
  "/pricing",

  // Keys marketing
  "/keys",
  "/keys/pricing",
  "/keys/use-cases",
  "/keys/privacy",
  "/keys/terms",
  "/keys/refund-policy",

  // Keys docs core
  "/keys/docs",
  "/keys/docs/how-it-fits-together",
  "/keys/docs/cloud-api",
  "/keys/docs/api-reference",
  "/keys/docs/compatibility",
  "/keys/docs/search",
  "/keys/docs/reference/cli",

  // Keys docs journeys (always on — user-journey landing pages)
  "/keys/docs/journeys/new-project",
  "/keys/docs/journeys/existing-stack",
  "/keys/docs/journeys/byok-saas",
  "/keys/docs/journeys/agent-ide",
  "/keys/docs/journeys/platform-ops",

  // Keys docs walkthrough (core phases always visible)
  "/keys/docs/walkthrough",
  "/keys/docs/walkthrough/phase-0-inventory",
  "/keys/docs/walkthrough/phase-1-install",
  "/keys/docs/walkthrough/phase-2-resolve",
  "/keys/docs/walkthrough/phase-3-routes",
  "/keys/docs/walkthrough/phase-5-ui",
  "/keys/docs/walkthrough/phase-6-golive",
  "/keys/docs/walkthrough/verification-strategy",

  // Keys docs guides (always-on)
  "/keys/docs/guides/canonical-catalog",
  "/keys/docs/guides/integration-catalog",
  "/keys/docs/guides/integration-vs-hosted-vault",
  "/keys/docs/guides/provider-access-modes",
  "/keys/docs/guides/verified-context",
  "/keys/docs/guides/mcp-verified-context",
  "/keys/docs/guides/context-regression-ci",
  "/keys/docs/guides/third-party-brand-marks",
  "/keys/docs/guides/model-registry",
  "/keys/docs/guides/resolve-to-execution-contract",
  "/keys/docs/guides/routing-contract",
  "/keys/docs/guides/integration-failure-attribution",
  "/keys/docs/guides/release-pack-and-merge-gates",
  "/keys/docs/guides/gtm-self-serve-first",
  "/keys/docs/guides/private-openai-compatible-endpoints",

  // Keys docs integrations
  "/keys/docs/integrations",
  "/keys/docs/integrations/mcp",
  "/keys/docs/integrations/cli",
  "/keys/docs/integrations/aaif",
  "/keys/docs/integrations/hosted-mcp-byo",
  "/keys/docs/integrations/webhooks-audit",

  // Keys integrations walkthrough
  "/keys/docs/integrations-walkthrough",
  "/keys/docs/integrations-walkthrough/phase-0-overview",
  "/keys/docs/integrations-walkthrough/phase-1-choose-workflow",
  "/keys/docs/integrations-walkthrough/phase-2-cli",
  "/keys/docs/integrations-walkthrough/phase-3-mcp",
  "/keys/docs/integrations-walkthrough/phase-4-aaif",
  "/keys/docs/integrations-walkthrough/phase-5-dashboard-docs",
  "/keys/docs/integrations-walkthrough/phase-6-verify",
  "/keys/docs/integrations-walkthrough/prompt-index",

  // Suite docs (top-level /docs)
  "/docs",
  "/docs/quickstart",
  "/docs/how-it-fits-together",
  "/docs/operator-model",
  "/docs/run-vs-embed",
  "/docs/connect",
];

/** Paths that require flags.testing. */
const TESTING_PATHS: string[] = [
  "/testing",
  "/testing/docs",
  "/testing/docs/overview",
  "/testing/docs/architecture",
  "/testing/docs/compatibility",
  "/testing/docs/examples",
  "/testing/docs/how-it-fits-together",

  // Testing journeys
  "/testing/docs/journeys/new-project",
  "/testing/docs/journeys/existing-stack",
  "/testing/docs/journeys/ci",
  "/testing/docs/journeys/from-e2e",
  "/testing/docs/journeys/keys",

  // Testing walkthrough
  "/testing/docs/walkthrough",
  "/testing/docs/walkthrough/phase-0-inventory",
  "/testing/docs/walkthrough/phase-1-install",
  "/testing/docs/walkthrough/phase-2-keys",
  "/testing/docs/walkthrough/phase-3-first-goal",
  "/testing/docs/walkthrough/phase-4-local-run",
  "/testing/docs/walkthrough/phase-5-ci",
  "/testing/docs/walkthrough/verification-strategy",
  "/testing/docs/walkthrough/secrets-and-ci-setup",
  "/testing/docs/walkthrough/migration-paths",

  // Testing guides
  "/testing/docs/guides/test-definition",
  "/testing/docs/guides/config",
  "/testing/docs/guides/ci",
  "/testing/docs/guides/ci-security",
  "/testing/docs/guides/http-runs-and-actions",
  "/testing/docs/guides/telemetry",
  "/testing/docs/guides/performance-goals",
  "/testing/docs/guides/plot-dogfooding",
  "/testing/docs/guides/keys-ci-checklist",
  "/testing/docs/guides/keys-dashboard-onboarding",

  // Testing integrations
  "/testing/docs/integrations/keys",

  // Keys docs that cross-reference testing
  "/keys/docs/walkthrough/staging-and-ci-setup",
  "/keys/docs/guides/keys-testing-onboarding",
  "/keys/docs/guides/byo-gpu-kubernetes",
  "/keys/docs/guides/byo-gpu-vm",
  "/keys/docs/guides/testing-gpu-route-smoke",
];

/** Paths that require flags.graph !== "disabled". */
const GRAPH_PATHS: string[] = [
  "/graph",
  "/graph/docs",
  "/graph/docs/overview",
  "/graph/docs/how-it-fits-together",
  "/graph/docs/integration/sveltekit",
  "/graph/docs/integration/web-components",
  "/graph/docs/extensions/reasoning",
  "/graph/docs/extensions/state",
  "/graph/docs/guides/migration-from-custom-canvas",
  "/graph/docs/guides/recipes",
  "/graph/docs/reference/api",
  "/graph/docs/reference/accessibility",
  "/graph/docs/reference/performance",
  "/graph/docs/reference/contract-v0-scope",
  "/graph/docs/reference/releases-and-support",
  "/keys/docs/guides/connect-first-graph-onboarding",
];

/** Paths that require flags.connect. */
const CONNECT_PATHS: string[] = [
  "/connect",
  "/connect/docs",
];

/** Paths that require flags.gatewayProviders. */
const GATEWAY_PROVIDER_PATHS: string[] = [
  "/keys/docs/guides/openrouter",
  "/keys/docs/guides/portkey",
  "/keys/docs/guides/vercel-ai-gateway",
  "/keys/docs/guides/aizolo",
  "/keys/docs/walkthrough/migration-paths",
];

/** Paths that require flags.environments. */
const ENVIRONMENT_PATHS: string[] = [
  "/keys/docs/guides/environment-vocabulary",
  "/keys/docs/guides/database-neon-for-self-hosters",
];

/** Paths that require flags.guardrails. */
const GUARDRAILS_PATHS: string[] = [
  "/keys/docs/walkthrough/phase-4-policies",
];

function staticPathsForModuleFlags(): string[] {
  const flags = resolveModuleFlagsSync();
  const paths: string[] = [...ALWAYS_ON_PATHS];

  if (flags.testing) {
    paths.push(...TESTING_PATHS);
  }

  if (flags.graph !== "disabled") {
    paths.push(...GRAPH_PATHS);
  }

  if (flags.connect) {
    paths.push(...CONNECT_PATHS);
  }

  if (flags.gatewayProviders) {
    paths.push(...GATEWAY_PROVIDER_PATHS);
  }

  if (flags.environments) {
    paths.push(...ENVIRONMENT_PATHS);
  }

  if (flags.guardrails) {
    paths.push(...GUARDRAILS_PATHS);
  }

  return paths;
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
}

export const GET: RequestHandler = async ({ url }) => {
  const base = `${url.protocol}//${url.host}`;
  const now = new Date().toISOString();
  const paths = staticPathsForModuleFlags();

  const urls = paths
    .map((p) => {
      const loc = xmlEscape(base + p);
      return [
        "  <url>",
        `    <loc>${loc}</loc>`,
        `    <lastmod>${now}</lastmod>`,
        "  </url>",
      ].join("\n");
    })
    .join("\n");

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
};
