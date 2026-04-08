<script lang="ts">
  import { testingBase as base } from "$lib/testing/paths.js";
  import DocArticle from "$lib/testing/components/docs/DocArticle.svelte";
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
      <li>
        <strong>Goal types</strong> — <code>browser</code> is the primary path; <code>performance</code> uses the same navigation contract and
        supports in-page Web Vitals checks plus optional Lighthouse category paths in <code>structured_checks</code> (see
        <a href="{base}/docs/guides/performance-goals">Performance goals</a>). <code>native</code> (Maestro / Appium-style) is not supported yet
        (<a href="{base}/docs/architecture">Architecture</a>).
      </li>
      <li><strong>CI</strong> — GitHub Actions first; other runners supported via CLI invocation.</li>
    </ul>
    <p>For Keys compatibility (frameworks, gateways, providers), see Keys’ own compatibility and integration guides.</p>
    <p><a href="{base}/docs">← Docs home</a></p>
  </div>
</DocArticle>
