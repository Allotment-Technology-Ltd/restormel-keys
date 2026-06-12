<script lang="ts">
  /**
   * DossierRail — the one shared right-rail drawer (Stage R6, §3.2).
   *
   * Neo-brutalist drawer: hard 3px border, offset shadow, full-height, 420px,
   * Escape-to-close, focus-trapped, returns focus to the opener, aria-modal.
   * It owns the chrome and keyboard contract; consumers supply only the content
   * via the `body` snippet (and an optional `footer`).
   *
   * First consumer (this stage): the Runs-list quick-peek (RunQuickPeek.svelte).
   * The three bespoke drawers — the explorer detail panel (which hosts the W2.2
   * Evidence Dossier), the logs drawer, and the proof provenance drawer — migrate
   * onto this standard OVER TIME; that migration rides W4.4 (the soft-card /
   * drawer-drift enforcement stage), not R6. R6 ships the component + ONE consumer.
   *
   * API:
   *   open       (bind) — controls visibility; setting false closes + restores focus.
   *   title             — heading text; wired to aria-labelledby.
   *   labelId           — id used for the heading / aria-labelledby (default unique).
   *   onClose           — optional callback fired on Escape / backdrop / close button.
   *   body              — required snippet: the drawer content.
   *   footer            — optional snippet: pinned actions row.
   */
  import { onMount, tick, type Snippet } from "svelte";

  export let open = false;
  export let title: string;
  export let labelId = `dossier-rail-${Math.random().toString(36).slice(2, 9)}`;
  export let onClose: (() => void) | undefined = undefined;
  export let body: Snippet;
  export let footer: Snippet | undefined = undefined;

  let drawerEl: HTMLElement | null = null;
  let closeBtn: HTMLButtonElement | null = null;
  /** The element focused when the rail opened — focus returns here on close. */
  let opener: Element | null = null;

  function close(): void {
    open = false;
    onClose?.();
  }

  function focusables(): HTMLElement[] {
    if (!drawerEl) return [];
    const all = drawerEl.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    return [...all].filter((el) => !el.hasAttribute("disabled"));
  }

  function onKeydown(event: KeyboardEvent): void {
    if (!open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const items = focusables();
    if (items.length === 0) {
      // Nothing focusable but the dialog itself — keep focus trapped on it.
      event.preventDefault();
      drawerEl?.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // Open / close transitions: capture + restore focus, move focus into the rail.
  let wasOpen = false;
  $: if (open && !wasOpen) {
    wasOpen = true;
    opener = typeof document !== "undefined" ? document.activeElement : null;
    void focusInto();
  } else if (!open && wasOpen) {
    wasOpen = false;
    restoreFocus();
  }

  async function focusInto(): Promise<void> {
    await tick();
    closeBtn?.focus();
  }

  function restoreFocus(): void {
    if (opener instanceof HTMLElement) opener.focus();
    opener = null;
  }

  onMount(() => {
    document.addEventListener("keydown", onKeydown);
    return () => document.removeEventListener("keydown", onKeydown);
  });
</script>

{#if open}
  <!-- Backdrop closes on click; presentational, not in the tab order. -->
  <div class="dossier-rail-backdrop" role="presentation" on:click={close}></div>
  <div
    class="dossier-rail"
    role="dialog"
    aria-modal="true"
    aria-labelledby={labelId}
    tabindex="-1"
    bind:this={drawerEl}
  >
    <header class="dossier-rail-head">
      <h2 id={labelId} class="dossier-rail-title">{title}</h2>
      <button
        type="button"
        class="dossier-rail-close"
        aria-label="Close panel"
        on:click={close}
        bind:this={closeBtn}
      >
        ×
      </button>
    </header>
    <div class="dossier-rail-body">
      {@render body()}
    </div>
    {#if footer}
      <footer class="dossier-rail-footer">
        {@render footer()}
      </footer>
    {/if}
  </div>
{/if}

<style>
  .dossier-rail-backdrop {
    position: fixed;
    inset: 0;
    background: color-mix(in oklab, var(--brut-ink) 32%, transparent);
    z-index: 60;
  }
  .dossier-rail {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 420px;
    max-width: 100vw;
    background: var(--brut-white);
    border-left: var(--brut-border-width) solid var(--brut-ink);
    box-shadow: var(--brut-shadow);
    border-radius: 0;
    display: flex;
    flex-direction: column;
    z-index: 61;
    overflow: hidden;
  }
  .dossier-rail-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-bottom: var(--brut-border-width) solid var(--brut-ink);
    background: var(--brut-white);
    flex: 0 0 auto;
  }
  .dossier-rail-title {
    margin: 0;
    font-family: var(--brut-font);
    font-size: var(--text-base);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    color: var(--brut-ink);
  }
  .dossier-rail-close {
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
    color: var(--brut-ink);
    border-radius: 0;
    width: 44px;
    height: 44px;
    font-size: 1.5rem;
    line-height: 1;
    font-weight: 700;
    cursor: pointer;
    flex: 0 0 auto;
  }
  .dossier-rail-close:hover {
    background: var(--brut-neon);
  }
  .dossier-rail-close:focus-visible {
    outline: 2px solid var(--brut-ink);
    outline-offset: 2px;
  }
  .dossier-rail-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-4);
  }
  .dossier-rail-footer {
    flex: 0 0 auto;
    padding: var(--space-3) var(--space-4);
    border-top: var(--brut-border-width) solid var(--brut-ink);
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  @media (max-width: 520px) {
    .dossier-rail {
      width: 100vw;
      border-left: 0;
    }
  }
</style>
