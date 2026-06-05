<script lang="ts">
  import type { UseCase } from "$lib/content/use-cases";
  import { USE_CASE_COLOR_VARS } from "$lib/content/use-case-colors";
  import UseCaseIcon from "$lib/components/marketing/UseCaseIcon.svelte";
  import { useCaseIconName } from "$lib/content/use-case-icons";

  export let useCases: UseCase[];
</script>

<ul class="teaser-grid" role="list">
  {#each useCases as useCase (useCase.id)}
    {@const colors = USE_CASE_COLOR_VARS[useCase.color]}
    <li>
      <a
        class="teaser-card"
        href="/use-cases#{useCase.id}"
        style="--uc-accent: {colors.accent}; --uc-icon-bg: {colors.iconBg}"
      >
        <span class="teaser-icon" aria-hidden="true">
          <UseCaseIcon name={useCaseIconName(useCase)} size={20} strokeWidth={2.25} />
        </span>
        <span class="teaser-text">
          <span class="teaser-title">{useCase.title}</span>
          <span class="teaser-tagline">{useCase.tagline}</span>
        </span>
      </a>
    </li>
  {/each}
</ul>

<style>
  .teaser-grid {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: var(--space-4);
    grid-template-columns: 1fr;
  }
  @media (min-width: 40rem) {
    .teaser-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media (min-width: 56rem) {
    .teaser-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  /* Frame + shadow: marketing-ledger.css (.teaser-grid .teaser-card) */
  .teaser-card {
    display: flex;
    gap: var(--space-3);
    align-items: flex-start;
    height: 100%;
    padding: var(--space-4);
    text-decoration: none;
    color: inherit;
    background: var(--color-surface);
    border-radius: 0;
    transition: transform 100ms ease, box-shadow 100ms ease;
  }
  .teaser-card:hover {
    transform: translate(-2px, -2px);
  }
  .teaser-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 2.5rem;
    height: 2.5rem;
    background: var(--uc-icon-bg);
    border: var(--brut-border-width) solid var(--brut-ink);
    border-radius: 0;
    color: var(--uc-accent);
  }
  .teaser-text {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .teaser-title {
    font-family: var(--brut-font);
    font-size: var(--text-sm);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: -0.02em;
    color: var(--brut-ink);
  }
  .teaser-tagline {
    font-size: var(--text-xs);
    line-height: 1.4;
    color: var(--brut-muted);
  }
</style>
