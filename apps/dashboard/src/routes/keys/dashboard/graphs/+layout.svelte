<!--
  Legacy passthrough layout (intentional) — mirrors sources/+layout.svelte.

  This directory has a `+layout.server.ts` (workspace cache warm). Without a
  `+layout.svelte`, SvelteKit injects its auto-generated fallback layout authored
  in Svelte 5 runes; this app sets `compilerOptions.runes: false`, so that
  fallback compiles to broken client code ("ReferenceError: props is not
  defined"). A plain `<slot />` legacy layout compiles correctly under
  runes:false; layout data from +layout.server.ts still flows to the page.
-->
<slot />
