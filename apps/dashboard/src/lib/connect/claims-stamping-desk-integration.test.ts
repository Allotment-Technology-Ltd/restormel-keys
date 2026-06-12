import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Source-contract test for the W4.2 Stamping Desk wiring inside the explorer.
 *
 * The desk's behaviour logic is unit-tested in `claims-stamping-desk.test.ts`
 * (pure module). This file pins the *integration* invariants that can't be seen
 * from the module alone and that the rubric/constraints require:
 *
 *   1. the desk reuses the existing mutation path (performReview) — it does NOT
 *      add a new mutating fetch (the 16-fetch pin in
 *      `dashboard-mobile-readonly-claims.test.ts` is the hard guard; this is the
 *      intent check);
 *   2. BOTH read-only modes gate the desk: as-of (asOfActive) AND the mobile
 *      read-only tier (isMobileReadonlyActive) feed `deskReadonly`, which hides
 *      the entry button and the desk drops mutations;
 *   3. while the desk is open it owns the keyboard — the explorer's own
 *      handleReviewKeydown early-returns on deskActive so a/w/u don't double-fire.
 */

function read(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
}

const explorerSrc = read("../components/connect/ConnectGraphExplorer.svelte");
const deskSrc = read("../components/connect/ClaimsStampingDesk.svelte");

describe("W4.2 Stamping Desk — explorer integration contract", () => {
  it("mounts the desk component and binds its instance", () => {
    expect(explorerSrc).toContain("import ClaimsStampingDesk");
    expect(explorerSrc).toMatch(/<ClaimsStampingDesk\b/);
    expect(explorerSrc).toMatch(/bind:this=\{deskComponent\}/);
  });

  it("routes every stamp through the existing performReview path (no new mutation)", () => {
    // deskStamp must call performReview — the single owner of the validation PATCH.
    expect(explorerSrc).toMatch(/function deskStamp[\s\S]*?performReview\(unit, status\)/);
    // The desk component itself must NOT fetch — it delegates via callbacks.
    expect(deskSrc).not.toMatch(/fetch\(/);
    expect(deskSrc).not.toMatch(/method:\s*["'](POST|PATCH|PUT|DELETE)["']/);
  });

  it("undo re-stamps via performReview (honest re-stamp, no server unstamp)", () => {
    expect(explorerSrc).toMatch(/function deskUndo[\s\S]*?performReview\(unit, toStatus\)/);
  });

  it("BOTH read-only modes feed deskReadonly (as-of + mobile read-only tier)", () => {
    expect(explorerSrc).toMatch(
      /deskReadonly\s*=\s*asOfActive\s*\|\|\s*isMobileReadonlyActive\(\)/,
    );
  });

  it("the entry button is hidden when read-only, with honest copy why", () => {
    // The {#if deskReadonly} branch in the entry row shows the disabled note.
    expect(explorerSrc).toMatch(/\{#if deskReadonly\}[\s\S]*?desk-enter-disabled/);
    expect(explorerSrc).toContain("editing past state is not possible.");
    expect(explorerSrc).toContain("read-only on small screens.");
    // The enabled branch is the actual enter button.
    expect(explorerSrc).toMatch(/on:click=\{enterDesk\}/);
    expect(explorerSrc).toMatch(/function enterDesk[\s\S]*?if \(!reviewEnabled \|\| deskReadonly\) return;/);
  });

  it("the desk owns the keyboard while open — the explorer's handler defers", () => {
    // handleReviewKeydown early-returns on deskActive before any verdict branch.
    expect(explorerSrc).toMatch(/function handleReviewKeydown[\s\S]*?if \(deskActive\) return;/);
    // And the desk passes readonly into its own keymap so stamps drop read-only.
    expect(deskSrc).toMatch(/dispatchDeskKey\(event\.key,\s*\{[\s\S]*?readonly,/);
  });

  it("the desk announces stamp/undo results on a polite live region (X10)", () => {
    expect(deskSrc).toMatch(/aria-live="polite"/);
    expect(explorerSrc).toMatch(/deskComponent\?\.announce\(announceStamp\(/);
  });

  it("focus moves to the claim card on advance (X10)", () => {
    expect(deskSrc).toMatch(/export async function focusClaim/);
    expect(explorerSrc).toMatch(/deskComponent\?\.focusClaim\(\)/);
  });
});
