<script lang="ts">
  /**
   * RES-113 PR-4 — the STRIPPED journey nav (flag-ON branch only; the flag-OFF
   * Work section in +layout.svelte is untouched).
   *
   * Founder decisions implemented (REC-ADR-022 Consequences / plan §4):
   *   • STRIPPED/minimal: plain-text items. Unreachable items render DIMMED —
   *     no status dots, no count badges, no inline lock-reason text in the chrome.
   *   • The lock reason lives BEHIND the click: activating a dimmed item opens an
   *     inline disclosure with the copy pack §5.3 template instance, verbatim
   *     ("Connect unlocks once you've added documents. [Add your documents]").
   *     PR-7 may replace this with plain navigation to Connect S0 (the pack's
   *     primary mechanism) once that locked surface exists.
   *   • Verify enters per `resolveJourneyNav` (monotonic — the item is simply
   *     present/absent in `items`; no badge, no count).
   *
   * Dimmed-item accessibility pattern (documented decision, restormel-accessibility):
   * the dimmed item is a REAL, FOCUSABLE `<button>` acting as a disclosure
   * (`aria-expanded` + `aria-controls`), NOT `aria-disabled` and NOT removed from
   * the tab order. Justification:
   *   • WCAG 4.1.2 (name/role/value): `aria-disabled` asserts "perceivable but not
   *     operable" — but this element IS operable (it discloses why the section is
   *     locked), so `aria-disabled` would be a false state claim and some AT would
   *     discourage activating the only discovery mechanism. Role `button` +
   *     `aria-expanded` states the truth.
   *   • WCAG 2.1.1 / 2.4.3 / 3.2.3: keeping the item focusable preserves one
   *     consistent tab order for the spine across ALL journey states — the nav
   *     never reorders or drops stops as the workspace progresses.
   *   • The locked state is available WITHOUT activation via `aria-describedby`
   *     ("Locked. {reason}"), so screen-reader users get what sighted users get
   *     from the dimming — colour/opacity is never the only signal (1.4.1).
   *   • The dimmed text uses `--rm-dim` (#7a7060 on #fffef0 ≈ 4.8:1), which passes
   *     WCAG 1.4.3 AA — pinned in brutalist-contrast.test.ts — so we do not rely
   *     on the "inactive component" contrast exemption (the element is active).
   *   • Escape closes the disclosure and returns focus to the button (X10); the
   *     panel takes focus on open (focus relocation on `{#if}` swaps). The
   *     disclosure is an inline expansion, not an overlay — nothing is obscured.
   */
  import { tick } from "svelte";
  import { isJourneyNavActive, type JourneyNavItem } from "$lib/nav-config";

  export let items: JourneyNavItem[];
  export let currentPath: string;
  export let pendingHref: string | null = null;

  /** href of the dimmed item whose explanation is open (one at a time). */
  let openLockHref: string | null = null;
  let lockNoteEl: HTMLDivElement | null = null;
  const lockButtonEls: Record<string, HTMLButtonElement | null> = {};

  function slugFor(href: string): string {
    return href.split("/").filter(Boolean).pop() ?? "item";
  }

  async function toggleLock(href: string) {
    openLockHref = openLockHref === href ? null : href;
    if (openLockHref) {
      // Focus relocation: move focus into the newly revealed explanation so
      // screen-reader/keyboard users land on the reason they just requested.
      await tick();
      lockNoteEl?.focus();
    }
  }

  function closeLock() {
    if (openLockHref === null) return;
    const button = lockButtonEls[openLockHref];
    openLockHref = null;
    // Escape/close returns focus to the opener (X10) — never drop it to <body>.
    button?.focus();
  }

  function onWindowKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && openLockHref !== null) {
      event.stopPropagation();
      closeLock();
    }
  }
</script>

<svelte:window on:keydown={onWindowKeydown} />

<div class="journey-nav">
  <div class="journey-links" role="group" aria-label="Sections">
    {#each items as item (item.href)}
      {#if item.reachable}
        <a
          href={item.href}
          class="journey-link"
          class:journey-link-active={isJourneyNavActive(currentPath, item.href)}
          class:journey-link-pending={pendingHref === item.href &&
            !isJourneyNavActive(currentPath, item.href)}
          aria-current={isJourneyNavActive(currentPath, item.href) ? "page" : undefined}
        >
          {item.label}
        </a>
      {:else}
        <button
          type="button"
          class="journey-link journey-link-locked"
          bind:this={lockButtonEls[item.href]}
          aria-expanded={openLockHref === item.href}
          aria-controls={openLockHref === item.href ? `journey-lock-note-${slugFor(item.href)}` : undefined}
          aria-describedby={`journey-lock-hint-${slugFor(item.href)}`}
          on:click={() => toggleLock(item.href)}
        >
          {item.label}
        </button>
        <!-- The locked state + reason, available to AT BEFORE activation. -->
        <span class="sr-only" id={`journey-lock-hint-${slugFor(item.href)}`}>
          Locked. {item.lockReason}
        </span>
        {#if openLockHref === item.href}
          <!-- Copy pack §5.3 in-place template: one sentence + one link, no heading. -->
          <div
            class="journey-lock-note"
            id={`journey-lock-note-${slugFor(item.href)}`}
            role="note"
            tabindex="-1"
            bind:this={lockNoteEl}
          >
            <p class="journey-lock-note-text">
              <strong>{item.lockReason}</strong>
              {#if item.lockAction}
                <a href={item.lockAction.href} class="journey-lock-note-action">{item.lockAction.label}</a>
              {/if}
            </p>
          </div>
        {/if}
      {/if}
    {/each}
  </div>
</div>

<style>
  /* Mirrors the layout's .nav-section / .nav-link recipe (scoped styles do not
     cross the component boundary). Tokens only — zero new design tokens. */
  .journey-nav {
    padding-bottom: var(--space-2);
    margin-bottom: var(--space-2);
    border-bottom: var(--brut-border-micro) solid var(--brut-ink);
  }
  .journey-links {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .journey-link {
    padding: var(--space-2) var(--space-4);
    min-height: 44px;
    display: flex;
    align-items: center;
    color: var(--brut-ink);
    font-size: var(--text-sm);
    font-weight: 700;
    border-bottom: var(--brut-border-micro) solid var(--brut-ink);
  }
  .journey-link:hover {
    color: var(--brut-ink);
    background: var(--brut-neon);
    text-decoration: none;
  }
  /* Ink-paired focus ring (accessibility skill: never a bare yellow ring on
     cream/white — the outer 2px ink band gives the boundary its 3:1). */
  .journey-link:focus-visible,
  .journey-lock-note-action:focus-visible {
    outline: 2px solid var(--color-yellow);
    outline-offset: -2px;
    box-shadow: inset 0 0 0 4px var(--brut-ink);
  }
  .journey-link-active {
    color: var(--color-ink);
    background: var(--color-yellow);
    font-weight: 900;
  }
  /* Pending modifier — same mechanics as the layout's .nav-link-pending
     (hard-edged pulsing left bar, static under prefers-reduced-motion). */
  .journey-link-pending {
    color: var(--color-ink);
    background: color-mix(in srgb, var(--color-yellow) 55%, transparent);
    font-weight: 900;
    position: relative;
  }
  .journey-link-pending::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--brut-ink);
    animation: journey-pending-pulse 0.8s steps(2) infinite;
  }
  @keyframes journey-pending-pulse {
    0%   { opacity: 1; }
    50%  { opacity: 0.25; }
    100% { opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .journey-link-pending::before {
      animation: none;
      opacity: 1;
    }
  }
  /* Dimmed (locked) item — STRIPPED: plain dimmed text, no dot, no badge, no
     inline reason. --rm-dim on the white sidebar ≈ 4.8:1 (pinned in
     brutalist-contrast.test.ts), so the still-operable text stays AA. */
  .journey-link-locked {
    width: 100%;
    border: 0;
    border-bottom: var(--brut-border-micro) solid var(--brut-ink);
    border-radius: 0;
    background: transparent;
    color: var(--rm-dim);
    font-family: inherit;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
  }
  .journey-link-locked:hover {
    color: var(--brut-ink);
    background: var(--brut-canvas);
  }
  /* The click-through explanation: an inline expansion (not an overlay), copy
     pack §5.3 — one sentence + one link. No animation, so no motion to guard. */
  .journey-lock-note {
    padding: var(--space-3) var(--space-4);
    background: var(--brut-canvas);
    border-bottom: var(--brut-border-micro) solid var(--brut-ink);
  }
  .journey-lock-note-text {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--brut-ink);
    line-height: var(--leading-normal);
  }
  .journey-lock-note-action {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--brut-ink);
    font-weight: 700;
    text-decoration: underline;
  }
  .journey-lock-note-action:hover {
    background: var(--brut-neon);
  }
  /* Visually hidden, accessible to AT (clip pattern, never display:none). */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
