<script lang="ts">
  import IntegrationCard from "$lib/components/integrations/IntegrationCard.svelte";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
</script>

<h1 class="page-title">Developer Tools</h1>
<p class="page-desc">
  Connect Restormel to your development workflow — CLI, agent tools (MCP), and structured AI interaction (AAIF).
</p>

<div class="cards-grid">
  <IntegrationCard
    title="CLI"
    description="Debug, validate, and inspect configuration from your terminal."
    status="available"
    cta="CLI details"
    href="{DASHBOARD_BASE}/dev-tools/cli"
  />
  <IntegrationCard
    title="MCP"
    description="Use Restormel inside agent workflows and IDEs via Model Context Protocol."
    status="early"
    cta="MCP details"
    href="{DASHBOARD_BASE}/dev-tools/mcp"
  />
  <IntegrationCard
    title="AAIF"
    description="Structured request/response contract for predictable AI interactions."
    status="advanced"
    cta="AAIF details"
    href="{DASHBOARD_BASE}/dev-tools/aaif"
  />
</div>

<style>
  .page-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
  }
  .page-desc {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-5);
  }
  .cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: var(--space-4);
  }
</style>
