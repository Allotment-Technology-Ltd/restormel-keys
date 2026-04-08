<script lang="ts">
  import { base } from "$app/paths";
  import DocArticle from "$lib/components/docs/DocArticle.svelte";
</script>

<DocArticle
  title="Compatibility"
  description="Runtime, package manager, and CI targets. This matrix will tighten as releases ship."
>
  <div class="doc-prose">
    <p>Initial targets:</p>
    <ul>
      <li><strong>Node.js</strong> — 20.x (engines field on the web app matches the Restormel module default).</li>
      <li><strong>pnpm</strong> — 9.x workspaces for authoring; consumers may use other managers once packages publish.</li>
      <li><strong>Browser automation</strong> — Playwright (MVP default adaptor).</li>
      <li><strong>CI</strong> — GitHub Actions first; other runners supported via CLI invocation.</li>
    </ul>
    <p>For Keys compatibility (frameworks, gateways, providers), see Keys’ own compatibility and integration guides.</p>
    <p><a href="{base}/docs">← Docs home</a></p>
  </div>
</DocArticle>
