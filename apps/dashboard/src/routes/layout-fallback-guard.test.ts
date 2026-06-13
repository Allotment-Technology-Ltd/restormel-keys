import { describe, it, expect } from "vitest";
import { readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Regression guard for the "props is not defined" hydration crash.
 *
 * This app sets `compilerOptions.runes: false` (svelte.config.js). When a route
 * directory has a `+layout.server.ts`/`+layout.ts` but NO `+layout.svelte`,
 * SvelteKit injects its auto-generated fallback layout — which is authored in
 * Svelte 5 runes (`let { children } = $props()` + `{@render children()}`). Under
 * runes:false that fallback compiles to broken client code referencing a free
 * `props`, throwing "ReferenceError: props is not defined" on hydration and
 * taking down the whole route (this crashed /keys/dashboard/sources — the graph
 * library management page — and /connect).
 *
 * Invariant: any directory with a server/universal layout load MUST also ship a
 * `+layout.svelte` (a plain legacy `<slot />` passthrough is enough), so the
 * broken runes fallback is never used.
 */
const ROUTES_DIR = join(dirname(fileURLToPath(import.meta.url)));

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      yield join(dir, entry.name);
      yield* walk(join(dir, entry.name));
    }
  }
}

describe("route layout hygiene (runes:false fallback guard)", () => {
  it("every directory with a server/universal +layout load also has a +layout.svelte", () => {
    const offenders: string[] = [];
    for (const dir of [ROUTES_DIR, ...walk(ROUTES_DIR)]) {
      const hasServerLayout =
        existsSync(join(dir, "+layout.server.ts")) || existsSync(join(dir, "+layout.ts"));
      const hasLayoutComponent = existsSync(join(dir, "+layout.svelte"));
      if (hasServerLayout && !hasLayoutComponent) {
        offenders.push(dir.slice(ROUTES_DIR.length) || "/");
      }
    }
    expect(
      offenders,
      `These routes have a server/universal layout but no +layout.svelte, so SvelteKit ` +
        `injects its runes fallback layout which crashes under runes:false ` +
        `("props is not defined"). Add a legacy "<slot />" +layout.svelte to each:\n` +
        offenders.map((o) => `  - ${o}`).join("\n"),
    ).toEqual([]);
  });
});
