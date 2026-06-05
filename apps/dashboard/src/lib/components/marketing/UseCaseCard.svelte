<script lang="ts">
  import type { UseCase } from "$lib/content/use-cases";
  import { USE_CASE_COLOR_VARS } from "$lib/content/use-case-colors";
  import UseCaseIcon from "$lib/components/marketing/UseCaseIcon.svelte";
  import { useCaseIconName } from "$lib/content/use-case-icons";
  import { useCaseTemplateLoginHref } from "$lib/content/use-case-template-url";

  export let useCase: UseCase;
  export let showQueries = true;
  export let showCta = true;
  export let compact = false;
  /** 1-based display index for brutal stamp (optional). */
  export let index = 0;

  $: colors = USE_CASE_COLOR_VARS[useCase.color];
  $: loginHref = useCaseTemplateLoginHref(useCase.id);
  $: queries = useCase.exampleQueries.slice(0, 3);
  $: displayIndex = index > 0 ? String(index).padStart(2, "0") : null;
  $: categoryLabel = useCase.category === "professional" ? "Work" : "Obsession";
</script>

<article
  id={useCase.id}
  class="use-case-card"
  class:use-case-card--compact={compact}
  style="--uc-accent: {colors.accent}; --uc-icon-bg: {colors.iconBg}; --uc-accent-muted: {colors.accentMuted}"
>
  {#if displayIndex}
    <div class="use-case-stamp">
      <span class="use-case-stamp-idx" aria-hidden="true">{displayIndex}</span>
      <span class="use-case-stamp-tag">{categoryLabel}</span>
    </div>
  {/if}

  <header class="use-case-card-head">
    <span class="use-case-icon" aria-hidden="true">
      <UseCaseIcon name={useCaseIconName(useCase)} size={22} strokeWidth={2.25} />
    </span>
    <div class="use-case-head-text">
      <h3 class="use-case-title">{useCase.title}</h3>
      <p class="use-case-tagline">{useCase.tagline}</p>
    </div>
  </header>

  {#if !compact}
    <div class="use-case-body">
      <p class="use-case-audience">
        <span class="use-case-audience-label">For</span>
        {useCase.audience}
      </p>

      {#if showQueries && queries.length > 0}
        <div class="use-case-queries-wrap">
          <p class="use-case-queries-label">Agents ask</p>
          <ul class="use-case-queries" aria-label="Example questions">
            {#each queries as q}
              <li><span class="use-case-query-prefix" aria-hidden="true">›</span> {q}</li>
            {/each}
          </ul>
        </div>
      {/if}

      <div class="use-case-shape" aria-label="Graph shape hints">
        {#each useCase.graphShape.nodeTypes.slice(0, 3) as nodeType}
          <span class="use-case-chip">{nodeType}</span>
        {/each}
      </div>
    </div>

    {#if showCta}
      <footer class="use-case-foot">
        <a class="use-case-cta" href={loginHref}>
          <span>Use this template</span>
          <span class="use-case-cta-arrow" aria-hidden="true">→</span>
        </a>
      </footer>
    {/if}
  {/if}
</article>

<style>
  .use-case-card {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 22rem;
    margin: 0;
    padding: 0;
    background: var(--color-surface);
    border: 2px solid var(--color-ink);
    box-shadow: var(--shadow-md);
    scroll-margin-top: 5rem;
    overflow: hidden;
    transition: transform 100ms ease, background 100ms ease;
  }

  .use-case-card::before {
    content: "TEMPLATE";
    position: absolute;
    right: -0.25rem;
    bottom: 3.5rem;
    font-family: var(--font-display);
    font-size: clamp(3rem, 12vw, 4.5rem);
    font-weight: 900;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-ink);
    opacity: 0.04;
    pointer-events: none;
    line-height: 1;
    transform: rotate(-8deg);
  }

  .use-case-card:hover {
    transform: translate(-2px, -2px);
    z-index: 2;
    background: color-mix(in srgb, var(--uc-accent) 4%, var(--color-surface));
  }

  .use-case-card--compact {
    min-height: auto;
    gap: var(--space-2);
    padding: var(--space-4);
    border: 2px solid var(--color-ink);
    box-shadow: 3px 3px 0 var(--color-ink);
  }

  .use-case-card--compact::before {
    display: none;
  }

  .use-case-stamp {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2) var(--space-3);
    border-bottom: 2px solid var(--color-ink);
    background: var(--color-bg-deep);
  }

  .use-case-stamp-idx {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--color-ink-faint);
  }

  .use-case-stamp-tag {
    font-family: var(--font-mono);
    font-size: 0.5625rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    padding: 0.125rem 0.375rem;
    border: 2px solid var(--color-ink);
    background: var(--uc-accent);
    color: var(--color-ink);
  }

  .use-case-card-head {
    display: flex;
    gap: var(--space-3);
    align-items: flex-start;
    padding: var(--space-4);
    border-bottom: 2px solid var(--color-ink);
    background: var(--uc-accent);
    min-height: 6.5rem;
    box-sizing: border-box;
  }

  .use-case-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 3rem;
    height: 3rem;
    background: var(--color-surface);
    border: 2px solid var(--color-ink);
    box-shadow: 3px 3px 0 var(--color-ink);
    color: var(--uc-accent);
  }

  .use-case-head-text {
    flex: 1;
    min-width: 0;
  }

  .use-case-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--text-display-sm);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: var(--text-display-tracking);
    line-height: 1.05;
    color: var(--color-ink);
  }

  .use-case-tagline {
    margin: var(--space-2) 0 0;
    font-size: var(--text-body-sm);
    line-height: 1.4;
    color: var(--color-ink);
    font-weight: 500;
  }

  .use-case-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
  }

  .use-case-audience {
    margin: 0;
    font-size: var(--text-body-sm);
    line-height: 1.45;
    color: var(--color-ink-muted);
  }

  .use-case-audience-label {
    display: inline-block;
    margin-right: var(--space-2);
    padding: 0.125rem 0.375rem;
    font-family: var(--font-mono);
    font-size: 0.5625rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    border: 2px solid var(--color-ink);
    background: var(--color-yellow);
    color: var(--color-ink);
    vertical-align: middle;
  }

  .use-case-queries-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 9.5rem;
  }

  .use-case-queries-label {
    margin: 0 0 var(--space-2);
    font-family: var(--font-mono);
    font-size: 0.5625rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--color-ink-muted);
  }

  .use-case-queries {
    margin: 0;
    padding: var(--space-3);
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    flex: 1;
    border: 2px solid var(--color-ink);
    border-left: 4px solid var(--uc-accent);
    background: var(--color-bg);
    box-shadow: 3px 3px 0 color-mix(in srgb, var(--uc-accent) 55%, var(--color-ink));
  }

  .use-case-queries li {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    line-height: 1.4;
    color: var(--color-ink);
  }

  .use-case-query-prefix {
    color: var(--uc-accent);
    font-weight: 900;
  }

  .use-case-shape {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    margin-top: auto;
  }

  .use-case-chip {
    font-family: var(--font-mono);
    font-size: 0.5625rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 0.2rem 0.4rem;
    border: 2px solid var(--color-ink);
    background: var(--color-surface);
    color: var(--color-ink-muted);
  }

  .use-case-foot {
    margin-top: auto;
    border-top: 2px solid var(--color-ink);
    background: var(--color-bg-deep);
  }

  .use-case-cta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-decoration: none;
    color: var(--color-ink);
    background: var(--color-yellow);
    border: none;
    transition: background 100ms ease, transform 100ms ease;
  }

  .use-case-cta:hover {
    background: var(--color-ink);
    color: var(--color-yellow);
  }

  .use-case-cta:focus-visible {
    outline: 2px solid var(--color-ink);
    outline-offset: -4px;
  }

  .use-case-cta-arrow {
    font-size: 1.125rem;
    line-height: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .use-case-card:hover {
      transform: none;
    }
  }
</style>
