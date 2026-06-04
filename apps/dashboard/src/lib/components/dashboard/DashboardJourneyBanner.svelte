<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import type { ModuleFlags } from "$lib/module-flags-types";
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";

  /** Current pathname (e.g. from $page.url.pathname). */
  export let currentPath: string;
  export let user: unknown | null;
  export let journeySignals: { integrationCount: number; gatewayKeyCount: number } | null;
  export let moduleFlags: ModuleFlags | null = null;

  const base = DASHBOARD_BASE.replace(/\/$/, "");

  type Hint = { text: string; cta: string; href: string };

  import { CONNECT_HUB_HREF, WORKSPACE_HOME_HREF } from "$lib/nav-config";

  function isConnectHubPath(path: string): boolean {
    return path === CONNECT_HUB_HREF || path.startsWith(CONNECT_HUB_HREF + "/");
  }

  function computeHint(
    path: string,
    sig: typeof journeySignals,
    flags: ModuleFlags,
  ): Hint | null {
    if (!sig) return null;
    if (isConnectHubPath(path)) return null;
    if (path.startsWith(base + "/login") || path.startsWith(base + "/logout")) return null;

    if (path === WORKSPACE_HOME_HREF || path === `${base}/`) {
      return {
        text: "Confirm your project context above, then open Connect to configure ingest and graph storage.",
        cta: "Open Connect",
        href: `${base}/connect`,
      };
    }
    if (path.startsWith(base + "/testing")) {
      if (!flags.testing) return null;
      if (sig.gatewayKeyCount === 0) {
        return {
          text: "Create a Gateway key before copying env for the Testing CLI.",
          cta: "Open Gateway keys",
          href: `${base}/access`,
        };
      }
      if (sig.integrationCount === 0) {
        return {
          text: "Add a Connection so resolve can bind to provider models.",
          cta: "Open Connections",
          href: `${base}/integrations`,
        };
      }
      return {
        text: "Paste RESTORMEL_* into CI or local env, then run pnpm exec testing doctor.",
        cta: "Keys + Testing guide",
        href: "/keys/docs/guides/keys-testing-onboarding",
      };
    }
    if (path.startsWith(base + "/integrations")) {
      if (sig.integrationCount === 0) {
        return {
          text: "Connections power Connect ingest stages — add one to unlock the pipeline.",
          cta: "Open Connect",
          href: `${base}/connect`,
        };
      }
      return {
        text: "Use a Gateway key (rk_…) for automation — not your raw provider secret.",
        cta: "Gateway keys",
        href: `${base}/access`,
      };
    }
    if (path.startsWith(base + "/access")) {
      if (flags.testing) {
        return {
          text: "Copy RESTORMEL_KEYS_BASE, RESTORMEL_GATEWAY_KEY, and project ID from one place.",
          cta: "Restormel Testing hub",
          href: `${base}/testing`,
        };
      }
      return {
        text: "Copy RESTORMEL_KEYS_BASE and RESTORMEL_GATEWAY_KEY for your app, CLI, or MCP setup.",
        cta: "CLI & agents",
        href: `${base}/dev-tools`,
      };
    }
    if (path.startsWith(base + "/routes")) {
      if (!flags.guardrails) {
        return {
          text: "Promote a working model choice from sandbox into a named route.",
          cta: "Try a request",
          href: `${base}/sandbox`,
        };
      }
      return {
        text: "Attach guard rails to routes to enforce limits in production.",
        cta: "Guard rails",
        href: `${base}/policies`,
      };
    }
    if (path.startsWith(base + "/policies")) {
      return {
        text: "Monitor usage and failures after policies are live.",
        cta: "Usage",
        href: `${base}/analytics`,
      };
    }
    if (path.startsWith(base + "/models")) {
      return {
        text: "Use catalog model IDs when you create or edit routes.",
        cta: "Routes",
        href: `${base}/routes`,
      };
    }
    if (path.startsWith(base + "/analytics")) {
      return {
        text: "Inspect individual requests and routing issues.",
        cta: "Logs",
        href: `${base}/logs`,
      };
    }
    if (path.startsWith(base + "/logs")) {
      return {
        text: "Validate deployment health and dependencies.",
        cta: "System Health",
        href: `${base}/healthcheck`,
      };
    }
    if (path.startsWith(base + "/sandbox")) {
      return {
        text: "Promote a working model choice into a named route.",
        cta: "Routes",
        href: `${base}/routes`,
      };
    }
    if (path.startsWith(base + "/connect")) {
      return {
        text: "Follow the Connect hub steps — pipeline profile before your first ingest run.",
        cta: "Operator model",
        href: "/docs/operator-model",
      };
    }
    if (path.startsWith(base + "/graph")) {
      return {
        text: "Graph is embed-first: use the SvelteKit integrator guide when wiring the canvas in your app.",
        cta: "SvelteKit guide",
        href: "/graph/docs/integration/sveltekit",
      };
    }
    if (path.startsWith(base + "/healthcheck")) {
      if (flags.testing) {
        return {
          text: "New to the dashboard? Use Overview for two setup tracks (Keys routing + Testing in CI).",
          cta: "Overview",
          href: WORKSPACE_HOME_HREF,
        };
      }
      return {
        text: "New to the dashboard? Finish the setup checklist on Overview.",
        cta: "Overview",
        href: WORKSPACE_HOME_HREF,
      };
    }
    if (path.startsWith(base + "/dev-tools/cli")) {
      return {
        text: flags.testing
          ? "CLI and MCP share the same Gateway key model; use testing.hub_snapshot from an agent to pull env ids."
          : "CLI and MCP share the same Gateway key model — wire RESTORMEL_GATEWAY_KEY in server env only.",
        cta: "MCP tools",
        href: `${base}/dev-tools/mcp`,
      };
    }
    if (path.startsWith(base + "/dev-tools/aaif")) {
      return {
        text: flags.guardrails
          ? "Define routes and guard rails first so AAIF calls land on governed model paths."
          : "Define routes first so AAIF calls land on consistent model paths.",
        cta: "Routes",
        href: `${base}/routes`,
      };
    }
    if (path.startsWith(base + "/dev-tools")) {
      if (flags.testing && flags.environments) {
        return {
          text: "Agents: testing.journey, testing.hub_snapshot, project.environments.list, project.gateway_keys.* (server env only).",
          cta: "Environment vocabulary",
          href: "/keys/docs/guides/environment-vocabulary",
        };
      }
      return {
        text: "Wire MCP with RESTORMEL_GATEWAY_KEY and server-only env — see the MCP setup guide.",
        cta: "MCP setup",
        href: "/keys/docs/integrations/mcp",
      };
    }
    if (path.startsWith(base + "/billing")) {
      return {
        text: "After changing plan, confirm Analytics and Logs reflect expected traffic and limits.",
        cta: "Usage",
        href: `${base}/analytics`,
      };
    }
    if (path.startsWith(base + "/settings")) {
      return {
        text: "Provider custody lives under Connections; automation uses Gateway keys, not raw provider secrets.",
        cta: "Connections",
        href: `${base}/integrations`,
      };
    }
    if (path.startsWith(base + "/lifecycle")) {
      if (!flags.testing) return null;
      return {
        text: "Overview lists two tracks: live traffic (routes) vs Restormel Testing in CI (resolve + doctor).",
        cta: "Overview",
        href: WORKSPACE_HOME_HREF,
      };
    }
    if (path.startsWith(base + "/copy-for-ci") || path.startsWith(base + "/copy-for-cli")) {
      if (!flags.testing) return null;
      return {
        text: "Restormel Testing shares the same Gateway key model; grab IDs from the Testing hub.",
        cta: "Restormel Testing",
        href: `${base}/testing`,
      };
    }
    if (path.startsWith(base + "/projects")) {
      return {
        text: "Connect providers and create Gateway keys in the context of your project.",
        cta: "Connections",
        href: `${base}/integrations`,
      };
    }
    return null;
  }

  $: flags = moduleFlags ?? MVP_MODULE_DEFAULTS;
  $: hint = user ? computeHint(currentPath, journeySignals, flags) : null;
</script>

{#if hint}
  <div class="journey-banner" role="region" aria-label="Suggested next step">
    <p class="journey-banner__text"><span class="journey-banner__kicker">Next</span> {hint.text}</p>
    <a class="journey-banner__cta" href={hint.href}>{hint.cta} →</a>
  </div>
{/if}

<style>
  .journey-banner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin: 0 0 var(--space-4);
    padding: var(--space-3) var(--space-4);
    border: 1px solid color-mix(in oklab, var(--rm-sage) 35%, var(--rm-border));
    border-radius: var(--rm-radius);
    background: color-mix(in oklab, var(--rm-sage) 10%, var(--rm-surface-raised));
  }
  .journey-banner__text {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    max-width: 42rem;
  }
  .journey-banner__kicker {
    font-weight: 600;
    color: var(--rm-text);
    margin-right: var(--space-1);
  }
  .journey-banner__cta {
    flex-shrink: 0;
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--rm-sage);
    text-decoration: none;
  }
  .journey-banner__cta:hover {
    text-decoration: underline;
  }
</style>
