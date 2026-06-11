<script lang="ts">
  /**
   * Command palette — ⌘K / Ctrl+K.
   *
   * A11y: focus-trap while open, aria-combobox pattern, arrow/enter/escape keyboard nav,
   * focus returns to trigger on close. Neo-brutalist: hard frame, ink borders, mono labels,
   * yellow selection highlight (ux-contracts §1, neu-brutalist-ui skill).
   */
  import { onMount, onDestroy, tick } from "svelte";
  import { goto } from "$app/navigation";
  import {
    NAV_COMMANDS,
    filterNavCommands,
    groupSearchResults,
    loadRecentItems,
    saveRecentItem,
    type SearchResultItem,
    type SearchResultGroup,
    type NavCommand,
    type RecentItem,
  } from "$lib/command-palette";

  // Props
  export let open = false;

  // Internal state
  let query = "";
  let inputEl: HTMLInputElement | null = null;
  let dialogEl: HTMLElement | null = null;
  let triggerEl: HTMLElement | null = null; // set from parent via bind:this workaround
  let listboxId = "palette-listbox";
  let selectedIndex = 0;

  // Search results
  let searchGroups: SearchResultGroup[] = [];
  let searchLoading = false;
  let searchError = false;
  let searchDebounce: ReturnType<typeof setTimeout> | null = null;

  // Recent items (shown when query is empty)
  let recentItems: RecentItem[] = [];

  // Flat list of all navigable items (for keyboard nav)
  type FlatItem =
    | { type: "nav"; cmd: NavCommand }
    | { type: "search"; item: SearchResultItem }
    | { type: "recent"; item: RecentItem };

  let flatItems: FlatItem[] = [];

  $: navMatches = filterNavCommands(NAV_COMMANDS, query);

  $: {
    const items: FlatItem[] = [];
    if (!query.trim()) {
      // Empty query: show recent items first, then all nav commands grouped by section
      for (const r of recentItems) {
        items.push({ type: "recent", item: r });
      }
      for (const cmd of NAV_COMMANDS) {
        items.push({ type: "nav", cmd });
      }
    } else {
      // Query present: search results first, then matching nav commands
      for (const group of searchGroups) {
        for (const item of group.items) {
          items.push({ type: "search", item });
        }
      }
      for (const cmd of navMatches) {
        items.push({ type: "nav", cmd });
      }
    }
    flatItems = items;
    selectedIndex = 0;
  }

  // Sections for grouped rendering
  type PaletteSection =
    | { kind: "recent"; items: RecentItem[] }
    | { kind: "search"; group: SearchResultGroup }
    | { kind: "nav"; section: string; items: NavCommand[] };

  $: sections = buildSections(query, recentItems, searchGroups, navMatches);

  function buildSections(
    q: string,
    recent: RecentItem[],
    sGroups: SearchResultGroup[],
    navCmds: NavCommand[],
  ): PaletteSection[] {
    const out: PaletteSection[] = [];
    if (!q.trim()) {
      if (recent.length > 0) out.push({ kind: "recent", items: recent });
      // Nav commands grouped by section
      const navSections = new Map<string, NavCommand[]>();
      for (const cmd of navCmds) {
        const list = navSections.get(cmd.section) ?? [];
        list.push(cmd);
        navSections.set(cmd.section, list);
      }
      for (const [section, items] of navSections) {
        out.push({ kind: "nav", section, items });
      }
    } else {
      for (const g of sGroups) {
        out.push({ kind: "search", group: g });
      }
      if (navCmds.length > 0) {
        const navSections = new Map<string, NavCommand[]>();
        for (const cmd of navCmds) {
          const list = navSections.get(cmd.section) ?? [];
          list.push(cmd);
          navSections.set(cmd.section, list);
        }
        for (const [section, items] of navSections) {
          out.push({ kind: "nav", section, items });
        }
      }
    }
    return out;
  }

  // Flat index for each rendered item (for keyboard selection tracking)
  function itemIndex(type: "nav" | "search" | "recent", id: string): number {
    for (let i = 0; i < flatItems.length; i++) {
      const fi = flatItems[i];
      if (fi.type === "nav" && type === "nav" && fi.cmd.id === id) return i;
      if (fi.type === "search" && type === "search" && fi.item.id === id) return i;
      if (fi.type === "recent" && type === "recent" && fi.item.id === id) return i;
    }
    return -1;
  }

  // Open / close
  export function openPalette() {
    open = true;
    tick().then(() => inputEl?.focus());
    recentItems = loadRecentItems();
  }

  export function closePalette() {
    open = false;
    query = "";
    searchGroups = [];
    searchError = false;
    selectedIndex = 0;
    if (searchDebounce) clearTimeout(searchDebounce);
  }

  // Query change → debounce search
  function onQueryInput() {
    if (searchDebounce) clearTimeout(searchDebounce);
    if (!query.trim()) {
      searchGroups = [];
      searchLoading = false;
      return;
    }
    searchLoading = true;
    searchError = false;
    searchDebounce = setTimeout(() => doSearch(query), 220);
  }

  async function doSearch(q: string) {
    try {
      const res = await fetch(`/keys/dashboard/api/search?q=${encodeURIComponent(q)}`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        searchError = true;
        searchLoading = false;
        return;
      }
      const data = (await res.json()) as { groups?: SearchResultGroup[] };
      searchGroups = data.groups ?? [];
      searchError = false;
    } catch {
      searchError = true;
    } finally {
      searchLoading = false;
    }
  }

  function navigate(item: FlatItem) {
    let url: string;
    let id: string;
    let label: string;
    let kind: RecentItem["kind"];

    if (item.type === "nav") {
      url = item.cmd.url;
      id = item.cmd.id;
      label = item.cmd.label;
      kind = "nav";
    } else if (item.type === "search") {
      url = item.item.url;
      id = `search:${item.item.kind}:${item.item.id}`;
      label = item.item.title;
      kind = item.item.kind;
    } else {
      url = item.item.url;
      id = item.item.id;
      label = item.item.label;
      kind = item.item.kind;
    }

    saveRecentItem({ id, label, url, kind, visitedAt: Date.now() });
    closePalette();
    goto(url);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, flatItems.length - 1);
      scrollSelectedIntoView();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      scrollSelectedIntoView();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatItems[selectedIndex];
      if (item) navigate(item);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closePalette();
    } else if (e.key === "Tab") {
      // Keep focus inside the palette
      e.preventDefault();
    }
  }

  function onGlobalKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      if (open) closePalette();
      else openPalette();
    }
  }

  function scrollSelectedIntoView() {
    tick().then(() => {
      const el = dialogEl?.querySelector<HTMLElement>(`[data-palette-index="${selectedIndex}"]`);
      el?.scrollIntoView({ block: "nearest" });
    });
  }

  function onBackdropClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (dialogEl && !dialogEl.contains(target)) {
      closePalette();
    }
  }

  onMount(() => {
    document.addEventListener("keydown", onGlobalKeyDown);
    return () => document.removeEventListener("keydown", onGlobalKeyDown);
  });
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="palette-backdrop" on:click={onBackdropClick} aria-hidden="true"></div>
  <div
    class="palette-dialog"
    role="dialog"
    aria-label="Command palette"
    aria-modal="true"
    tabindex="-1"
    bind:this={dialogEl}
    on:keydown={onKeyDown}
  >
    <div class="palette-header">
      <label class="palette-search-label" for="palette-input" aria-label="Search commands and entities">
        <span class="palette-search-icon" aria-hidden="true">⌕</span>
      </label>
      <!-- svelte-ignore a11y-role-has-required-aria-props -->
      <input
        id="palette-input"
        class="palette-input"
        type="text"
        placeholder="Search or navigate…"
        autocomplete="off"
        spellcheck="false"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={flatItems.length > 0}
        aria-controls={listboxId}
        aria-activedescendant={flatItems[selectedIndex] ? `palette-item-${selectedIndex}` : undefined}
        bind:this={inputEl}
        bind:value={query}
        on:input={onQueryInput}
      />
      {#if searchLoading}
        <span class="palette-spinner" aria-label="Searching…" aria-live="polite">…</span>
      {/if}
      <kbd class="palette-esc-hint" aria-label="Press Escape to close">Esc</kbd>
    </div>

    <div class="palette-body" id={listboxId} role="listbox" aria-label="Results">
      {#if searchError && query.trim()}
        <div class="palette-error" role="status">
          <span>Search unavailable — showing navigation commands only.</span>
        </div>
      {/if}

      {#each sections as section}
        {#if section.kind === "recent"}
          <div class="palette-section">
            <div class="palette-section-label" aria-hidden="true">RECENT</div>
            {#each section.items as recentItem}
              {@const idx = itemIndex("recent", recentItem.id)}
              <!-- svelte-ignore a11y-click-events-have-key-events -->
              <!-- svelte-ignore a11y-interactive-supports-focus -->
              <div
                id={`palette-item-${idx}`}
                class="palette-item"
                class:palette-item-selected={idx === selectedIndex}
                role="option"
                aria-selected={idx === selectedIndex}
                data-palette-index={idx}
                on:click={() => navigate({ type: "recent", item: recentItem })}
                on:mouseenter={() => selectedIndex = idx}
              >
                <span class="palette-item-kind" aria-hidden="true">↩</span>
                <span class="palette-item-title">{recentItem.label}</span>
                <span class="palette-item-sub">{recentItem.url}</span>
              </div>
            {/each}
          </div>

        {:else if section.kind === "search"}
          <div class="palette-section">
            <div class="palette-section-label" aria-hidden="true">{section.group.label.toUpperCase()}</div>
            {#each section.group.items as item}
              {@const idx = itemIndex("search", item.id)}
              <!-- svelte-ignore a11y-click-events-have-key-events -->
              <!-- svelte-ignore a11y-interactive-supports-focus -->
              <div
                id={`palette-item-${idx}`}
                class="palette-item"
                class:palette-item-selected={idx === selectedIndex}
                role="option"
                aria-selected={idx === selectedIndex}
                data-palette-index={idx}
                on:click={() => navigate({ type: "search", item })}
                on:mouseenter={() => selectedIndex = idx}
              >
                <span class="palette-item-kind palette-item-kind-{item.kind}" aria-hidden="true">
                  {kindGlyph(item.kind)}
                </span>
                <span class="palette-item-title">{item.title}</span>
                {#if item.subtitle}
                  <span class="palette-item-sub">{item.subtitle}</span>
                {/if}
              </div>
            {/each}
          </div>

        {:else if section.kind === "nav"}
          <div class="palette-section">
            <div class="palette-section-label" aria-hidden="true">{section.section.toUpperCase()}</div>
            {#each section.items as cmd}
              {@const idx = itemIndex("nav", cmd.id)}
              <!-- svelte-ignore a11y-click-events-have-key-events -->
              <!-- svelte-ignore a11y-interactive-supports-focus -->
              <div
                id={`palette-item-${idx}`}
                class="palette-item"
                class:palette-item-selected={idx === selectedIndex}
                role="option"
                aria-selected={idx === selectedIndex}
                data-palette-index={idx}
                on:click={() => navigate({ type: "nav", cmd })}
                on:mouseenter={() => selectedIndex = idx}
              >
                <span class="palette-item-kind" aria-hidden="true">→</span>
                <span class="palette-item-title">{cmd.label}</span>
                {#if cmd.shortcut}
                  <kbd class="palette-item-kbd">{cmd.shortcut}</kbd>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      {/each}

      {#if flatItems.length === 0 && !searchLoading}
        <div class="palette-empty" role="status">
          {#if query.trim()}
            <span>No results for <strong>{query}</strong> — try a broader term or navigate by section.</span>
          {:else}
            <span>Type to search projects, routes, graph units…</span>
          {/if}
        </div>
      {/if}
    </div>

    <div class="palette-footer" aria-hidden="true">
      <span><kbd>↑↓</kbd> navigate</span>
      <span><kbd>↵</kbd> go</span>
      <span><kbd>Esc</kbd> close</span>
    </div>
  </div>
{/if}

<script lang="ts" context="module">
  function kindGlyph(kind: string): string {
    switch (kind) {
      case "project": return "◆";
      case "route": return "→";
      case "policy": return "■";
      case "gateway_key": return "⊕";
      case "model": return "◉";
      case "ingest_run": return "▶";
      case "graph_unit": return "◇";
      default: return "·";
    }
  }
</script>

<style>
  .palette-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(12, 12, 12, 0.55);
    z-index: 9998;
  }

  .palette-dialog {
    position: fixed;
    top: 12%;
    left: 50%;
    transform: translateX(-50%);
    width: min(680px, calc(100vw - 2rem));
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    background: var(--brut-white, #ffffff);
    border: 3px solid var(--brut-ink, #0c0c0c);
    box-shadow: 8px 8px 0 var(--brut-ink, #0c0c0c);
    z-index: 9999;
    overflow: hidden;
  }

  .palette-header {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
    border-bottom: 2px solid var(--brut-ink, #0c0c0c);
    flex-shrink: 0;
  }

  .palette-search-label {
    display: flex;
    align-items: center;
    color: var(--brut-ink, #0c0c0c);
  }

  .palette-search-icon {
    font-size: 1.2rem;
    font-weight: 900;
    line-height: 1;
  }

  .palette-input {
    flex: 1;
    border: none;
    background: transparent;
    font-family: var(--font-mono, monospace);
    font-size: var(--text-sm, 0.875rem);
    font-weight: 600;
    color: var(--brut-ink, #0c0c0c);
    outline: none;
    min-width: 0;
  }

  .palette-input::placeholder {
    color: var(--rm-muted, #666);
    font-weight: 400;
  }

  .palette-spinner {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs, 0.75rem);
    color: var(--rm-muted, #666);
    letter-spacing: 0.1em;
  }

  .palette-esc-hint {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs, 0.75rem);
    font-weight: 700;
    color: var(--rm-muted, #666);
    border: 1.5px solid currentColor;
    padding: 0.1rem 0.35rem;
    border-radius: 0;
  }

  .palette-body {
    overflow-y: auto;
    flex: 1;
    overscroll-behavior: contain;
  }

  .palette-section {
    border-bottom: 1px solid var(--brut-ink, #0c0c0c);
  }

  .palette-section:last-child {
    border-bottom: none;
  }

  .palette-section-label {
    padding: 0.35rem var(--space-4, 1rem) 0.2rem;
    font-family: var(--font-mono, monospace);
    font-size: 0.65rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    color: var(--rm-muted, #666);
    border-bottom: 1px solid rgba(12, 12, 12, 0.12);
    background: rgba(243, 234, 208, 0.4);
  }

  .palette-item {
    display: flex;
    align-items: center;
    gap: var(--space-3, 0.75rem);
    padding: 0.6rem var(--space-4, 1rem);
    cursor: pointer;
    min-height: 44px;
    transition: background 80ms;
  }

  .palette-item:hover,
  .palette-item-selected {
    background: var(--color-yellow, #f5e642);
  }

  .palette-item:focus-visible {
    outline: 2px solid var(--brut-ink, #0c0c0c);
    outline-offset: -2px;
  }

  .palette-item-kind {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs, 0.75rem);
    font-weight: 900;
    color: var(--rm-muted, #666);
    flex-shrink: 0;
    min-width: 1rem;
    text-align: center;
  }

  .palette-item-title {
    flex: 1;
    font-size: var(--text-sm, 0.875rem);
    font-weight: 600;
    color: var(--brut-ink, #0c0c0c);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .palette-item-sub {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs, 0.75rem);
    color: var(--rm-muted, #666);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 16rem;
    flex-shrink: 0;
  }

  .palette-item-kbd {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs, 0.75rem);
    color: var(--rm-muted, #666);
    border: 1.5px solid currentColor;
    padding: 0.1rem 0.3rem;
    border-radius: 0;
    flex-shrink: 0;
  }

  .palette-error {
    padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
    font-size: var(--text-xs, 0.75rem);
    font-family: var(--font-mono, monospace);
    color: var(--brut-coral, #e45c3a);
    border-bottom: 1px solid var(--brut-ink, #0c0c0c);
  }

  .palette-empty {
    padding: var(--space-4, 1rem) var(--space-4, 1rem);
    font-size: var(--text-sm, 0.875rem);
    color: var(--rm-muted, #666);
    text-align: center;
  }

  .palette-footer {
    display: flex;
    gap: var(--space-4, 1rem);
    align-items: center;
    padding: 0.4rem var(--space-4, 1rem);
    border-top: 1.5px solid var(--brut-ink, #0c0c0c);
    background: rgba(243, 234, 208, 0.35);
    flex-shrink: 0;
  }

  .palette-footer span {
    font-family: var(--font-mono, monospace);
    font-size: 0.65rem;
    color: var(--rm-muted, #666);
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .palette-footer kbd {
    font-family: var(--font-mono, monospace);
    font-size: 0.65rem;
    font-weight: 700;
    color: var(--brut-ink, #0c0c0c);
    border: 1px solid var(--rm-muted, #666);
    padding: 0.05rem 0.25rem;
    border-radius: 0;
  }
</style>
