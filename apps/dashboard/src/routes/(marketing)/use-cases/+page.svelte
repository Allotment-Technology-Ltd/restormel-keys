<script lang="ts">
  import "$lib/styles/suite-landing.css";
  import "$lib/styles/use-cases-brutal.css";
  import { professionalUseCases, hobbyUseCases, USE_CASES } from "$lib/content/use-cases";
  import UseCaseCard from "$lib/components/marketing/UseCaseCard.svelte";
  import SophiaShowcaseCard from "$lib/components/marketing/SophiaShowcaseCard.svelte";

  const templateCount = USE_CASES.length;
</script>

<svelte:head>
  <title>Use cases — Restormel Connect</title>
  <meta
    name="description"
    content="Starter templates for Connect knowledge graphs: engineering docs, compliance corpora, competitive intelligence, mythology, music genealogy, and more."
  />
</svelte:head>

<div class="use-cases-landing">
  <section class="uc-hero" aria-labelledby="uc-hero-heading">
    <div class="suite-section-inner">
      <span class="suite-section-tag suite-section-tag--inverted">Connect templates</span>
      <h1 id="uc-hero-heading" class="suite-section-title">What will you build first?</h1>
      <p class="suite-section-sub">
        From compliance corpora to mythology pantheons — Restormel works for any structured knowledge problem. Pick a
        starter template and we pre-fill your domain config in the pipeline.
      </p>
      <p class="uc-hero-count suite-stat-chip" aria-label="{templateCount} starter templates">
        <span>{templateCount} templates</span>
        <span aria-hidden="true">·</span>
        <span>Pre-filled domain config</span>
      </p>
    </div>
  </section>

  <section class="uc-section" aria-labelledby="professional-heading">
    <div class="suite-section-inner">
      <span class="suite-section-tag">Built for your work</span>
      <h2 id="professional-heading" class="suite-section-title">Professional corpora</h2>
      <ul class="uc-grid" role="list">
        {#each professionalUseCases as useCase, i (useCase.id)}
          <li>
            <UseCaseCard {useCase} index={i + 1} />
          </li>
        {/each}
      </ul>
    </div>
  </section>

  <section class="uc-section uc-section--hobby suite-section--hatch" aria-labelledby="hobby-heading">
    <div class="suite-section-inner">
      <span class="suite-section-tag">Start with something you love</span>
      <h2 id="hobby-heading" class="suite-section-title">Hobby &amp; obsession graphs</h2>
      <p class="uc-hobby-intro suite-callout-frame">
        Restormel isn't only for your stack. The same pipeline that grounds your AI agents at work is just as good at
        building a living, queryable version of whatever you're obsessed with. These are starting points — pick the one
        closest to your thing.
      </p>
      <ul class="uc-grid uc-grid--hobby" role="list">
        <li class="uc-grid-span-full">
          <SophiaShowcaseCard featured stacked />
        </li>
        {#each hobbyUseCases as useCase, i (useCase.id)}
          <li>
            <UseCaseCard {useCase} index={professionalUseCases.length + i + 1} />
          </li>
        {/each}
      </ul>
    </div>
  </section>
</div>

<style>
  .use-cases-landing {
    padding-bottom: var(--space-12);
  }
  .uc-hero {
    padding: 0;
  }
  .uc-section {
    padding: 0;
  }
  .uc-section .suite-section-inner {
    padding-top: var(--space-10);
    padding-bottom: var(--space-10);
  }
  .uc-hobby-intro {
    margin: 0 0 var(--space-6);
  }
  .uc-grid {
    margin: var(--space-6) 0 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: var(--space-4);
    grid-template-columns: 1fr;
    align-items: stretch;
  }
  @media (min-width: 48rem) {
    .uc-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media (min-width: 72rem) {
    .uc-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  .uc-grid > li {
    display: flex;
    min-height: 0;
  }
  .uc-grid-span-full {
    grid-column: 1 / -1;
  }
</style>
