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

/**
 * W2.5 B1/M1 honesty contract — counts, verdicts and provenance are NOT projected onto
 * the as-of instant. Under an APPLIED historical view they are absent-stated, the banner
 * scopes its promise to claim text + which version was live, the "loaded" label does not
 * mix projected/current bases, and substituted prior versions are flagged not-historical.
 */
describe("W2.5 as-of historical-honesty contract (B1/M1)", () => {
  it("derives asOfProjected = active AND the data layer actually applied the projection", () => {
    expect(explorerSrc).toMatch(
      /\$:\s*asOfProjected\s*=\s*asOfActive\s*&&\s*asOfStatus\?\.applied\s*===\s*true/,
    );
  });

  it("absent-states the bento + validation breakdown under an applied historical view (B1)", () => {
    // The bento/validation card is wrapped in an `{#if asOfProjected}` branch that shows
    // an honest absent-state instead of current numbers, and only renders the bento grid
    // in the `{:else}`.
    expect(explorerSrc).toMatch(/\{#if asOfProjected\}/);
    expect(explorerSrc).toMatch(/Counts at this instant aren't available/);
    // The bento grid (current numbers) is no longer rendered unconditionally.
    const bentoIdx = explorerSrc.indexOf("<BrutalBentoGrid");
    const guardIdx = explorerSrc.lastIndexOf("{#if asOfProjected}", bentoIdx);
    expect(guardIdx, "the bento grid must sit inside an asOfProjected else-branch").toBeGreaterThan(-1);
  });

  it("suppresses the evidence facet chip counts (current-only) under an applied historical view (B1)", () => {
    expect(explorerSrc).toMatch(/\{#if evidenceStateCounts && !asOfProjected\}/);
    expect(explorerSrc).toMatch(/counts at this instant aren't available/);
  });

  it("does not mix projected loaded-count over the CURRENT total in the loaded label (B1)", () => {
    // Under asOfProjected the label drops the "of <current total>" and reports only the
    // loaded projection count.
    expect(explorerSrc).toMatch(/unitsLoadedLabel\s*=\s*asOfProjected/);
    expect(explorerSrc).toMatch(/in this projection \(loaded\)/);
  });

  it("the active (non-degraded) banner promise is scoped to claim text + version, NOT counts/verification states", () => {
    // The old over-promise ("Counts, claim text and verification states reflect that instant")
    // must be gone.
    expect(explorerSrc).not.toMatch(/Counts, claim text and verification states reflect that instant/);
    // The new copy promises claim text + which version was live, and says counts/verdicts
    // are NOT historical.
    expect(explorerSrc).toMatch(/claim text that was live at that instant/);
    expect(explorerSrc).toMatch(/are\s*<strong>not<\/strong>\s*reconstructed for the past/);
  });

  it("substituted prior-version rows are labelled 'verdict not historical' rather than showing a verdict (M1)", () => {
    expect(explorerSrc).toMatch(/unit\.asOfHistorical/);
    expect(explorerSrc).toMatch(/verdict not historical/);
    expect(explorerSrc).toMatch(/selectedUnit\.asOfHistorical/);
  });
});

/**
 * W2.5 minor 1 — pagination basis. The server pages CURRENT rows by offset; the client
 * must offset by that raw-row basis (not the projected `units.length`) and defer the
 * has-more decision to the server, so "Load more" terminates honestly under as-of.
 */
describe("W2.5 as-of pagination basis (minor 1)", () => {
  it("load-more offsets by the raw current-row basis, not the projected units.length", () => {
    // The next offset is the tracked raw-row offset (fallback to SSR page extent) — the
    // old `fetchUnitsPage(units.length, …)` must be gone.
    expect(explorerSrc).not.toMatch(/fetchUnitsPage\(units\.length,/);
    expect(explorerSrc).toMatch(/const nextOffset\s*=\s*\n?\s*rawRowsFetched\s*\?\?/);
  });

  it("hasMoreUnits prefers the server's has_more and never trusts projected length under as-of", () => {
    expect(explorerSrc).toMatch(/serverHasMore\s*\?\?/);
    // Under an applied historical view the current-only estimate is NOT used (would never
    // terminate); the code defers to the server (false fallback).
    expect(explorerSrc).toMatch(/asOfProjected \? false : stats != null && units\.length < stats\.units/);
  });
});

/**
 * W2.5 minor 4 — fetch-failure honesty. A thrown as-of fetch must drop the confident
 * banner to a degraded state, not leave "Viewing graph as of …" over an errored list.
 */
describe("W2.5 as-of fetch-failure honesty (minor 4)", () => {
  it("sets a degraded asOfStatus when the as-of fetch throws", () => {
    expect(explorerSrc).toMatch(/reason:\s*"as_of_fetch_failed"/);
    // The degraded banner has explicit copy for the errored list.
    expect(explorerSrc).toMatch(/could not be loaded — the list/);
  });
});
