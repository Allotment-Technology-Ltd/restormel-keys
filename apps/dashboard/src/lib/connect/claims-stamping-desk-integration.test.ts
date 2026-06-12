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
    expect(explorerSrc).toMatch(/function deskStamp[\s\S]*?performReview\(unit, status/);
    // The desk component itself must NOT fetch — it delegates via callbacks.
    expect(deskSrc).not.toMatch(/fetch\(/);
    expect(deskSrc).not.toMatch(/method:\s*["'](POST|PATCH|PUT|DELETE)["']/);
  });

  it("undo re-stamps via performReview (honest re-stamp, no server unstamp)", () => {
    expect(explorerSrc).toMatch(/function deskUndo[\s\S]*?performReview\(unit, toStatus/);
  });

  it("BOTH read-only modes gate the desk (as-of reactively + mobile read-only at call time)", () => {
    // as-of is reactive (correct — it changes after first render). The mobile tier
    // is re-checked at CALL time via deskMutationBlocked() (MAJOR-1: the layout's
    // mount-time flag lands after the explorer's first reactive pass).
    expect(explorerSrc).toMatch(/\$:\s*deskReadonly\s*=\s*asOfActive\s*;/);
    expect(explorerSrc).toMatch(
      /function deskMutationBlocked\(\)[\s\S]*?return asOfActive \|\| isMobileReadonlyActive\(\);/,
    );
  });

  it("the entry button is hidden when as-of read-only, with honest copy why", () => {
    // The {#if deskReadonly} branch in the entry row shows the disabled note.
    expect(explorerSrc).toMatch(/\{#if deskReadonly\}[\s\S]*?desk-enter-disabled/);
    expect(explorerSrc).toContain("editing past state is not possible.");
    expect(explorerSrc).toContain("read-only on small screens.");
    // The enabled branch is the actual enter button, which re-checks the mobile
    // tier at click time before opening.
    expect(explorerSrc).toMatch(/on:click=\{enterDesk\}/);
    expect(explorerSrc).toMatch(/function enterDesk[\s\S]*?if \(!reviewEnabled \|\| deskMutationBlocked\(\)\) return;/);
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

  it("MAJOR-2 — performReview reports a truthful dispatch result, not a silent swallow", () => {
    // The function now returns dispatched | swallowed | disabled instead of void.
    expect(explorerSrc).toMatch(/type ReviewDispatch = "dispatched" \| "swallowed" \| "disabled";/);
    // The 250ms in-flight guard returns "swallowed" (was a silent early-return).
    expect(explorerSrc).toMatch(/if \(exitingUnitId\) return "swallowed";/);
    expect(explorerSrc).toMatch(/return "dispatched";/);
  });

  it("MAJOR-2 — deskStamp tallies/announces ONLY on a confirmed dispatch, holds on swallow", () => {
    const deskStampBody = explorerSrc.match(/function deskStamp[\s\S]*?\n  }\n/)?.[0] ?? "";
    // Swallowed/disabled inputs do NOT advance the tally — they announce and bail
    // BEFORE the tallyStamp call.
    const holdIdx = deskStampBody.indexOf('if (dispatch !== "dispatched")');
    const tallyIdx = deskStampBody.indexOf("deskTally = tallyStamp(deskTally, status)");
    expect(holdIdx, "deskStamp must branch on the dispatch result").toBeGreaterThan(-1);
    expect(tallyIdx, "deskStamp must tally the stamp").toBeGreaterThan(-1);
    expect(tallyIdx, "the tally must come AFTER the swallow/hold branch").toBeGreaterThan(holdIdx);
    // Honest feedback while a previous stamp is still saving.
    expect(deskStampBody).toContain("Hold on — saving the previous stamp");
    // Server-failure rollback: the onResolved continuation undoes the tally.
    expect(deskStampBody).toMatch(/\(ok\) =>/);
    expect(deskStampBody).toContain("tallyUndo(deskTally, status)");
    expect(deskStampBody).toContain("didn't save");
  });

  it("MAJOR-2 — S→Z within the 250ms window does not announce 'Undone' (deskUndo holds on swallow)", () => {
    const deskUndoBody = explorerSrc.match(/function deskUndo[\s\S]*?\n  }\n/)?.[0] ?? "";
    const holdIdx = deskUndoBody.indexOf('if (dispatch !== "dispatched")');
    const undoneIdx = deskUndoBody.indexOf("Undone. Restored to");
    expect(holdIdx, "deskUndo must branch on the dispatch result").toBeGreaterThan(-1);
    expect(undoneIdx, "deskUndo announces 'Undone' only on dispatch").toBeGreaterThan(-1);
    // The "Undone" announcement must come AFTER the swallow/hold bail-out.
    expect(undoneIdx).toBeGreaterThan(holdIdx);
    // Swallowed undo holds with honest copy rather than lying.
    expect(deskUndoBody).toContain("Hold on — saving the previous stamp");
  });

  it("MAJOR-3 — the desk keymap early-returns on Cmd/Ctrl/Alt chords (no stamp + no Save hijack)", () => {
    expect(deskSrc).toMatch(/if \(event\.metaKey \|\| event\.ctrlKey \|\| event\.altKey\) return;/);
  });

  it("two-step Escape — Escape in the note field blurs the field, not the desk", () => {
    // The desk handles a dedicated "blur" command before "exit".
    expect(deskSrc).toMatch(/case "blur":[\s\S]*?noteEl\?\.blur\(\)/);
  });
});
