<!--
  Legacy passthrough layout (intentional).

  This directory has a `+layout.server.ts` (workspace cache warm) but, without a
  `+layout.svelte`, SvelteKit injects its AUTO-GENERATED fallback layout. That
  fallback is authored in Svelte 5 runes (`let { children } = $props()` +
  `{@render children()}`). This app sets `compilerOptions.runes: false`
  (svelte.config.js), and the generated runes fallback compiles to broken client
  code that references a free `props` → "ReferenceError: props is not defined" on
  hydration, which crashed the whole /sources route (graph-library management).

  A plain `<slot />` legacy layout — matching every other layout in this app —
  compiles correctly under runes:false and overrides the fallback. Layout data
  from +layout.server.ts still flows to child pages unchanged.
-->
<slot />
