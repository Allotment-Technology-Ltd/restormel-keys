<script lang="ts">
  /**
   * Compact “works with” band: logos when `logoId` matches static SVG; otherwise label text.
   */
  import { INTEGRATION_CATALOG } from "@restormel/aaif";
  import type { IntegrationCatalogCategory } from "@restormel/aaif";

  /** "full" = more items; "compact" = fewer for module landings */
  export let variant: "full" | "compact" = "full";
  export let heading = "Works with your stack";
  export let intro: string | null =
    "Restormel documents and tests paths with the services you already use — no migration story required.";
  export let catalogHref = "/keys/docs/guides/integration-catalog";

  const categoryOrder: IntegrationCatalogCategory[] = [
    "database",
    "hosting",
    "gateway",
    "model_provider",
    "ci",
    "auth",
  ];

  const maxFull = 10;
  const maxCompact = 6;

  $: entries = (() => {
    const list = [...INTEGRATION_CATALOG].sort(
      (a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category),
    );
    const cap = variant === "full" ? maxFull : maxCompact;
    return list.slice(0, cap);
  })();
</script>

<section class="eco" aria-labelledby="eco-heading">
  <div class="eco-inner">
    <div class="eco-copy">
      <h2 id="eco-heading" class="eco-title">{heading}</h2>
      {#if intro}
        <p class="eco-intro">{intro}</p>
      {/if}
      <p class="eco-cta">
        <a class="eco-link" href={catalogHref}>Integration catalog →</a>
      </p>
    </div>
    <ul class="eco-grid" aria-label="Third-party integrations">
      {#each entries as item}
        <li class="eco-item">
          <a class="eco-card" href={item.docsPath}>
            {#if item.logoId}
              <span class="eco-logo-wrap" aria-hidden="true">
                <img
                  class="eco-logo"
                  src="/integrations/brands/{item.logoId}.svg"
                  alt=""
                  width="28"
                  height="28"
                  loading="lazy"
                />
              </span>
            {/if}
            <span class="eco-label">{item.label}</span>
          </a>
        </li>
      {/each}
    </ul>
  </div>
</section>

<style>
  .eco {
    padding: var(--space-6) 0;
    border-top: 1px solid var(--rm-border);
    border-bottom: 1px solid var(--rm-border);
    background: var(--rm-surface-raised);
  }
  .eco-inner {
    max-width: var(--rm-container-max);
    margin: 0 auto;
    padding: 0 var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  @media (min-width: 52rem) {
    .eco-inner {
      flex-direction: row;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-8);
    }
  }
  .eco-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
  }
  .eco-intro {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-2);
    max-width: 40ch;
  }
  .eco-cta {
    margin: 0;
  }
  .eco-link {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--rm-sage);
    text-decoration: none;
  }
  .eco-link:hover {
    text-decoration: underline;
  }
  .eco-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    flex: 1;
    justify-content: flex-start;
  }
  .eco-card {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    border: 1px solid var(--rm-border);
    background: var(--rm-surface);
    text-decoration: none;
    color: var(--rm-text);
    font-size: var(--text-sm);
    font-weight: 500;
    min-height: 44px;
    transition: border-color 0.15s ease;
  }
  .eco-card:hover {
    border-color: var(--rm-sage);
    color: var(--rm-sage);
  }
  .eco-logo-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--rm-text);
  }
  .eco-logo {
    width: 1.5rem;
    height: 1.5rem;
    object-fit: contain;
    filter: opacity(0.92);
  }
  .eco-label {
    white-space: nowrap;
  }
</style>
