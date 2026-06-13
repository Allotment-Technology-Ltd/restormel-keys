<!--
  Legacy passthrough layout (intentional) — same fix as keys/dashboard/sources.

  This directory has a `+layout.server.ts` (module-flag redirect guard) but no
  `+layout.svelte`, so SvelteKit injects its auto-generated runes fallback layout
  (`{@render children()}`). Under this app's `compilerOptions.runes: false`, that
  fallback compiles to broken client code referencing a free `props`
  ("ReferenceError: props is not defined" on hydration). A plain legacy `<slot />`
  layout compiles correctly and overrides the fallback.
-->
<slot />
