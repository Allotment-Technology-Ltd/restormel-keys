<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";

  /** Current pathname (e.g. from $page.url.pathname). */
  export let currentPath: string;
  export let user: unknown | null;
  export let journeySignals: { integrationCount: number; gatewayKeyCount: number } | null;

  const base = DASHBOARD_BASE.replace(/\/$/, "");

  type Hint = { text: string; cta: string; href: string };

  function isOverviewPath(path: string): boolean {
    return path === base || path === base + "/";
  }

  function computeHint(path: string, sig: typeof journeySignals): Hint | null {
    if (!sig) return null;
    if (isOverviewPath(path)) return null;
    if (path.startsWith(base + "/login") || path.startsWith(base + "/logout")) return null;

    if (path.startsWith(base + "/testing")) {
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
          text: "Save a connection to unlock model bindings and Testing resolve.",
          cta: "Why Connections matter",
          href: "/keys/docs/guides/keys-testing-onboarding",
        };
      }
      return {
        text: "Use a Gateway key (rk_…) for automation — not your raw provider secret.",
        cta: "Gateway keys",
        href: `${base}/access`,
      };
    }
    if (path.startsWith(base + "/access")) {
      return {
        text: "Copy RESTORMEL_KEYS_BASE, RESTORMEL_GATEWAY_KEY, and project ID from one place.",
        cta: "Restormel Testing hub",
        href: `${base}/testing`,
      };
    }
    if (path.startsWith(base + "/routes")) {
      return {
        text: "Attach guard rails to routes to enforce limits in production.",
        cta: "Guard rails",
        href: `${base}/policies`,
      };
    }
    if (path.startsWith(base + "/policies")) {
      return {
        text: "Monitor usage and failures after policies are live.",
        cta: "Usage & Analytics",
        href: `${base}/analytics`,
      };
    }
    if (path.startsWith(base + "/models")) {
      return {
        text: "Use catalog model IDs when you create or edit rules.",
        cta: "Rules",
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
        text: "Promote a working model choice into a named rule.",
        cta: "Rules",
        href: `${base}/routes`,
      };
    }
    if (path.startsWith(base + "/healthcheck")) {
      return {
        text: "New to the dashboard? Use Overview for two setup tracks (Keys routing + Testing in CI).",
        cta: "Overview",
        href: `${base}/`,
      };
    }
    if (path.startsWith(base + "/dev-tools/cli")) {
      return {
        text: "CLI and MCP share the same Gateway key model; use testing.hub_snapshot from an agent to pull env ids.",
        cta: "MCP tools",
        href: `${base}/dev-tools/mcp`,
      };
    }
    if (path.startsWith(base + "/dev-tools/aaif")) {
      return {
        text: "Define routes and guard rails first so AAIF calls land on governed model paths.",
        cta: "Rules",
        href: `${base}/routes`,
      };
    }
    if (path.startsWith(base + "/dev-tools")) {
      return {
        text: "Agents: testing.journey, testing.hub_snapshot, project.environments.list, project.gateway_keys.* (server env only).",
        cta: "Environment vocabulary",
        href: "/keys/docs/guides/environment-vocabulary",
      };
    }
    if (path.startsWith(base + "/billing")) {
      return {
        text: "After changing plan, confirm Analytics and Logs reflect expected traffic and limits.",
        cta: "Usage & Analytics",
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
      return {
        text: "Overview lists two tracks: live traffic (rules) vs Restormel Testing in CI (resolve + doctor).",
        cta: "Overview",
        href: `${base}/`,
      };
    }
    if (path.startsWith(base + "/copy-for-ci") || path.startsWith(base + "/copy-for-cli")) {
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

  $: hint = user ? computeHint(currentPath, journeySignals) : null;
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
