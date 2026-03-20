<script lang="ts">
  import { onMount } from "svelte";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";

  export let user: { uid: string; email?: string | null; name?: string | null };
  export let align: "left" | "right" = "right";

  let open = false;
  let rootEl: HTMLElement | null = null;
  let buttonEl: HTMLButtonElement | null = null;
  let menuEl: HTMLDivElement | null = null;

  const menuId = `user-menu-${Math.random().toString(16).slice(2)}`;

  function displayName(u: { uid: string; email?: string | null; name?: string | null }): string {
    return u.name?.trim() || u.email?.trim() || u.uid;
  }

  function initials(u: { uid: string; email?: string | null; name?: string | null }): string {
    const email = u.email?.trim();
    if (!email) return "";
    return email.slice(0, 1).toUpperCase();
  }

  function close() {
    open = false;
  }

  function toggle() {
    open = !open;
    if (open) {
      // Allow menu to render before focusing.
      queueMicrotask(() => {
        const first = menuEl?.querySelector<HTMLElement>('a,[role="menuitem"]');
        first?.focus();
      });
    }
  }

  function onDocPointerDown(e: PointerEvent) {
    if (!open) return;
    const t = e.target as Node | null;
    if (t && rootEl && rootEl.contains(t)) return;
    close();
  }

  function onDocKeyDown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      buttonEl?.focus();
    }
  }

  function onButtonKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) toggle();
    }
  }

  onMount(() => {
    document.addEventListener("pointerdown", onDocPointerDown, true);
    document.addEventListener("keydown", onDocKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown, true);
      document.removeEventListener("keydown", onDocKeyDown);
    };
  });
</script>

<div class="user-menu" data-align={align} bind:this={rootEl}>
  <button
    type="button"
    class="user-menu-trigger"
    aria-label="Account menu"
    aria-haspopup="menu"
    aria-expanded={open}
    aria-controls={menuId}
    on:click={toggle}
    on:keydown={onButtonKeyDown}
    bind:this={buttonEl}
  >
    <span class="avatar" aria-hidden="true">
      {#if initials(user)}
        {initials(user)}
      {:else}
        <span class="avatar-icon">👤</span>
      {/if}
    </span>
    <span class="user-menu-caret" aria-hidden="true">▾</span>
  </button>

  {#if open}
    <div class="user-menu-popover" id={menuId} role="menu" bind:this={menuEl}>
      <div class="user-menu-header">
        <div class="user-menu-name">{displayName(user)}</div>
        {#if user.email}
          <div class="user-menu-email">{user.email}</div>
        {/if}
      </div>
      <div class="user-menu-sep" aria-hidden="true"></div>
      <a class="user-menu-item" role="menuitem" href={DASHBOARD_BASE + "/settings"} on:click={close}>
        Profile &amp; settings
      </a>
      <a class="user-menu-item" role="menuitem" href={DASHBOARD_BASE + "/billing"} on:click={close}>
        Subscription
      </a>
      <a
        class="user-menu-item user-menu-danger"
        role="menuitem"
        href={DASHBOARD_BASE + "/logout"}
        data-sveltekit-reload
        on:click={close}
      >
        Sign out
      </a>
    </div>
  {/if}
</div>

<style>
  .user-menu {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  .user-menu-trigger {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    border: 1px solid var(--rm-border);
    background: var(--rm-bg);
    color: var(--rm-text);
    border-radius: var(--rm-radius);
    padding: 0.25rem 0.5rem;
    cursor: pointer;
  }

  .user-menu-trigger:hover {
    background: var(--rm-surface);
  }

  .user-menu-trigger:focus-visible {
    outline: 2px solid var(--rm-sage);
    outline-offset: 2px;
  }

  .avatar {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border-radius: 999px;
    background: color-mix(in oklab, var(--rm-sage) 18%, var(--rm-surface-raised));
    border: 1px solid color-mix(in oklab, var(--rm-sage) 35%, var(--rm-border));
    color: var(--rm-text);
    font-family: var(--rm-font-ui);
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .avatar-icon {
    font-size: 0.95rem;
    line-height: 1;
  }

  .user-menu-caret {
    color: var(--rm-muted);
    font-size: var(--text-xs);
    margin-right: 0.15rem;
  }

  .user-menu-popover {
    position: absolute;
    top: calc(100% + 0.35rem);
    min-width: 14rem;
    background: var(--rm-surface);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
    padding: var(--space-2);
    z-index: var(--z-modal);
  }

  .user-menu[data-align="right"] .user-menu-popover {
    right: 0;
  }

  .user-menu[data-align="left"] .user-menu-popover {
    left: 0;
  }

  .user-menu-header {
    padding: var(--space-2) var(--space-2);
  }

  .user-menu-name {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--rm-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 18rem;
  }

  .user-menu-email {
    margin-top: 0.1rem;
    font-size: var(--text-xs);
    color: var(--rm-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 18rem;
  }

  .user-menu-sep {
    height: 1px;
    background: var(--rm-border);
    margin: var(--space-2) 0;
  }

  .user-menu-item {
    display: block;
    width: 100%;
    padding: var(--space-2) var(--space-2);
    border-radius: var(--rm-radius);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    text-decoration: none;
  }

  .user-menu-item:hover,
  .user-menu-item:focus-visible {
    background: var(--rm-sage-bg);
    color: var(--rm-sage);
    outline: none;
    text-decoration: none;
  }

  .user-menu-danger:hover,
  .user-menu-danger:focus-visible {
    background: color-mix(in oklab, var(--coral-alert, #c95c5c) 15%, transparent);
    color: var(--coral-alert, #c95c5c);
  }
</style>

