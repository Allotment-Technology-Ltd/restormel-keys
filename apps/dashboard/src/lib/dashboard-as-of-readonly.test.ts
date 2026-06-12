import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * W2.5 contract test — as-of time travel is VIEW ONLY.
 *
 * While `?as_of` (or `?audit=1`) is active the explorer is read-only on DESKTOP too,
 * via a state class on the explorer ROOT (`.as-of-readonly`) — not the mobile body
 * attribute. This test pins:
 *   1. the root carries the `as-of-readonly` state class bound to `asOfActive`;
 *   2. the as-of read-only CSS hides every mutation region the mobile tier hides
 *      (the same set, asserted independently of the mobile rule);
 *   3. the verdict keyboard shortcuts (which CSS can't hide) early-return on
 *      `asOfActive` — once per mutating shortcut (a/w/u);
 *   4. as-of is a READ feature: it adds ZERO mutation fetches. The explorer mutation
 *      count stays pinned at 16 (the mobile-readonly contract owns the hard assertion;
 *      this is a guard that as-of's fetch is a GET passing `as_of`, not a new mutation).
 */

function read(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
}

const explorerSrc = read("./components/connect/ConnectGraphExplorer.svelte");

/** The explorer's own mutation regions that must be hidden in the as-of read-only view. */
const AS_OF_HIDDEN_REGIONS = [
  ".review-actions",
  ".dossier-actions",
  ".dossier-recheck",
  ".remove-section",
  ".cohort-complete-actions",
  ".revalidate-actions",
  // child-component regions hidden via :global
  ":global(.wizard-actions)",
  ":global(.lib-new)",
  ":global(.lib-run-archive)",
];

describe("W2.5 as-of read-only contract", () => {
  it("the explorer root carries the as-of-readonly state class bound to asOfActive", () => {
    expect(explorerSrc).toMatch(/class:as-of-readonly=\{asOfActive\}/);
    // asOfActive derives from the as-of/audit state (drives banner + read-only).
    expect(explorerSrc).toMatch(/\$:\s*asOfActive\s*=\s*asOf\s*!=\s*null\s*\|\|\s*includeSuperseded/);
  });

  it("the as-of read-only CSS hides every mutation region (desktop, via the root class)", () => {
    // Isolate the `.as-of-readonly … display: none` block.
    const match = explorerSrc.match(
      /((?:\s*\.as-of-readonly[^{}]*,)*\s*\.as-of-readonly[^{}]*\{\s*display:\s*none\s*!important;)/,
    );
    expect(match, "could not find a .as-of-readonly display:none block").toBeTruthy();
    const block = match![0];
    for (const region of AS_OF_HIDDEN_REGIONS) {
      expect(
        block.includes(`.as-of-readonly ${region}`),
        `.as-of-readonly must hide ${region}`,
      ).toBe(true);
    }
  });

  it("the verdict keyboard shortcuts early-return on asOfActive (CSS can't hide them)", () => {
    const guards = (explorerSrc.match(/if \(asOfActive\) return;/g) ?? []).length;
    expect(
      guards,
      "expected the a/w/u verdict shortcuts to each early-return when asOfActive",
    ).toBeGreaterThanOrEqual(3);
    // The mobile-readonly guard must still be intact (the mobile contract pins it too).
    expect((explorerSrc.match(/if \(mobileReadonly\) return;/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("as-of is a READ: the units fetch passes as_of/audit on a GET, adding no mutation", () => {
    // The unit fetch sets the as_of/audit query params (a read).
    expect(explorerSrc).toMatch(/params\.set\("as_of", asOf\)/);
    expect(explorerSrc).toMatch(/params\.set\("audit", "1"\)/);
    // The mutation-fetch count must remain pinned at 16 — as-of adds none.
    const mutationRe = /method:\s*["'](?:POST|PATCH|PUT|DELETE)["']/g;
    expect(
      (explorerSrc.match(mutationRe) ?? []).length,
      "as-of must add ZERO mutation fetches (pin stays at 16)",
    ).toBe(16);
  });

  it("a historical-view banner with a one-click return-to-now is rendered while active", () => {
    expect(explorerSrc).toMatch(/class="as-of-banner"/);
    expect(explorerSrc).toMatch(/returnToNow/);
    // Honest degraded state copy is present (history not available).
    expect(explorerSrc).toMatch(/History not available for this graph/);
  });
});
