<script lang="ts">
  import { onMount } from "svelte";
  import { ADMIN_BASE, DASHBOARD_BASE } from "$lib/dashboard-base";

  export let user: { uid: string; email?: string | null; name?: string | null; isServiceAdmin?: boolean };
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
      {#if user.isServiceAdmin}
        <a class="user-menu-item" role="menuitem" href={ADMIN_BASE + "/users"} on:click={close}>Admin</a>
      {/if}
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
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
    color: var(--brut-ink);
    border-radius: 0;
    padding: var(--space-1) var(--space-2);
    min-height: 44px;
    cursor: pointer;
  }

  .user-menu-trigger:hover {
    background: var(--brut-neon);
  }

  .user-menu-trigger:focus-visible {
    outline: 2px solid var(--brut-ink);
    outline-offset: 2px;
  }

  .avatar {
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 0;
    background: var(--brut-neon);
    border: var(--brut-border-micro) solid var(--brut-ink);
    color: var(--brut-ink);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: 900;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .avatar-icon {
    font-size: 0.95rem;
    line-height: 1;
  }

  .user-menu-caret {
    color: var(--brut-ink);
    font-size: var(--text-xs);
    margin-right: 0.1rem;
  }

  .user-menu-popover {
    position: absolute;
    top: calc(100% + 0.25rem);
    min-width: 14rem;
    background: var(--brut-white);
    border: var(--brut-border-width) solid var(--brut-ink);
    border-radius: 0;
    box-shadow: var(--brut-shadow);
    padding: var(--space-1);
    z-index: var(--z-modal);
  }

  .user-menu[data-align="right"] .user-menu-popover {
    right: 0;
  }

  .user-menu[data-align="left"] .user-menu-popover {
    left: 0;
  }

  .user-menu-header {
    padding: var(--space-2) var(--space-3);
    border-bottom: var(--brut-border-micro) solid var(--brut-ink);
    margin-bottom: var(--space-1);
  }

  .user-menu-name {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--brut-ink);
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

  .user-menu-item {
    display: block;
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border-radius: 0;
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--brut-ink);
    text-decoration: none;
  }

  .user-menu-item:hover,
  .user-menu-item:focus-visible {
    background: var(--brut-neon);
    color: var(--brut-ink);
    outline: none;
    text-decoration: none;
  }

  .user-menu-danger:hover,
  .user-menu-danger:focus-visible {
    background: var(--brut-coral);
    color: var(--brut-ink);
  }
</style>

