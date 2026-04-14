<svelte:head>
  <title>Third-party brand marks — Guides — Restormel Keys</title>
  <meta
    name="description"
    content="Policy for vendor logos on Restormel surfaces: sourcing, monochrome tokens, accessibility, and no implied endorsement."
  />
</svelte:head>

<h1 class="docs-h1">Third-party brand marks</h1>
<p class="docs-intro">
  Canonical reference: <code class="inline-code">docs/guides/third-party-brand-marks.md</code> in the repository. This
  page mirrors the policy for in-product readers.
</p>

<h2 class="docs-h2">Sourcing</h2>
<ul class="docs-list">
  <li>Prefer <a href="https://github.com/simple-icons/simple-icons" rel="noopener noreferrer" target="_blank">Simple Icons</a> (CC0) or official vendor press kits.</li>
  <li>Record provenance in <code class="inline-code">apps/dashboard/static/integrations/brands/ATTRIBUTION.md</code>.</li>
  <li>Do not hotlink third-party CDNs for production logos.</li>
</ul>

<h2 class="docs-h2">Visual treatment</h2>
<ul class="docs-list">
  <li>Monochrome on Restormel shells; use <code class="inline-code">currentColor</code> or <code class="inline-code">--rm-*</code> tokens.</li>
  <li>Typical strip height ~22–28px; avoid logo soup.</li>
</ul>

<h2 class="docs-h2">Copy and legal posture</h2>
<ul class="docs-list">
  <li>Use “Works with” / “Compatible with” — not “Official partner” unless legally approved.</li>
  <li>Logos indicate documented technical paths, not a commercial relationship.</li>
</ul>

<h2 class="docs-h2">Accessibility</h2>
<ul class="docs-list">
  <li>Meaningful <code class="inline-code">alt</code> text, or <code class="inline-code">aria-hidden</code> on redundant decorative marks.</li>
</ul>

<p class="docs-p">
  <a href="/keys/docs/guides/integration-catalog">← Integration catalog</a>
</p>

<style>
  .docs-h1 {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-3);
  }
  .docs-intro {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-4);
    max-width: 44rem;
  }
  .docs-h2 {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--rm-text);
    margin: var(--space-5) 0 var(--space-2);
  }
  .docs-list {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    max-width: 44rem;
  }
  .docs-p {
    font-size: var(--text-sm);
    margin-top: var(--space-6);
  }
  .docs-p a {
    color: var(--rm-sage);
  }
  .inline-code {
    font-size: 0.85em;
    padding: 0.1em 0.35em;
    border-radius: var(--radius-sm);
    background: var(--rm-surface-raised);
    border: 1px solid var(--rm-border);
  }
</style>
