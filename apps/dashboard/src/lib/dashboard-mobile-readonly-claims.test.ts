import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Contract test for the R6 mobile read-only tier on /claims (fix-forward).
 *
 * /claims mounts ConnectGraphExplorer (which embeds ConnectGraphReadinessWizard).
 * Those components expose affordances that POST/PATCH/DELETE to the Connect
 * pipeline. The ux-contracts §3 R6 row claims these surfaces are read-only with
 * "mutating actions hidden". This test pins that claim: the dashboard layout's
 * `.shell-mobile-readonly` rule MUST hide every audited mutation region, and each
 * of those regions MUST still exist as a real action container in the explorer or
 * wizard (so renaming a region without updating the hide rule fails the build).
 */

const layoutSrc = readFileSync(
  fileURLToPath(new URL("../routes/keys/dashboard/+layout.svelte", import.meta.url)),
  "utf8",
);
const explorerSrc = readFileSync(
  fileURLToPath(new URL("./components/connect/ConnectGraphExplorer.svelte", import.meta.url)),
  "utf8",
);
const wizardSrc = readFileSync(
  fileURLToPath(
    new URL("./components/connect/ConnectGraphReadinessWizard.svelte", import.meta.url),
  ),
  "utf8",
);

/**
 * Every mutation action-region we audited in ConnectGraphExplorer +
 * ConnectGraphReadinessWizard, with the component its `class="…"` lives in.
 */
const MUTATION_REGIONS: { selector: string; source: string }[] = [
  { selector: "review-actions", source: "explorer" }, // verdict approve/reject/supported
  { selector: "dossier-actions", source: "explorer" }, // Accept supported / Exclude
  { selector: "dossier-recheck", source: "explorer" }, // Re-check now
  { selector: "remove-section", source: "explorer" }, // Remove from graph (DELETE)
  { selector: "cohort-complete-actions", source: "explorer" }, // Start next run
  { selector: "revalidate-actions", source: "explorer" }, // Auto-remediate
  { selector: "wizard-actions", source: "wizard" }, // scan/save/sync/import/link/embed/validate
];

/** Isolate the `.shell-mobile-readonly … display: none` block from the layout. */
function mobileReadonlyHideBlock(): string {
  // The block is the selector list that ends in `display: none !important;`.
  const match = layoutSrc.match(
    /((?:\s*\.shell-mobile-readonly[^{}]*,)*\s*\.shell-mobile-readonly[^{}]*\{\s*display:\s*none\s*!important;)/,
  );
  expect(match, "could not find a .shell-mobile-readonly display:none block").toBeTruthy();
  return match![0];
}

describe("R6 /claims mobile read-only contract", () => {
  const hideBlock = mobileReadonlyHideBlock();

  it("layout's mobile-readonly rule hides every audited mutation region", () => {
    for (const { selector } of MUTATION_REGIONS) {
      expect(
        hideBlock.includes(`:global(.${selector})`),
        `.shell-mobile-readonly must hide :global(.${selector})`,
      ).toBe(true);
    }
  });

  it("every hidden mutation region still exists as an action container in the explorer/wizard", () => {
    for (const { selector, source } of MUTATION_REGIONS) {
      const src = source === "wizard" ? wizardSrc : explorerSrc;
      expect(
        new RegExp(`class="[^"]*\\b${selector}\\b`).test(src),
        `expected class="…${selector}…" to exist in the ${source} component`,
      ).toBe(true);
    }
  });

  it("the live verdict buttons (.review-actions) are covered — the core Major", () => {
    expect(hideBlock).toContain(":global(.review-actions)");
    // The verdict buttons live inside .review-actions and fire performReview.
    expect(explorerSrc).toMatch(/class="review-actions"/);
    expect(explorerSrc).toMatch(/performReview\(selectedUnit/);
  });

  it("read-only viewing chrome is NOT hidden", () => {
    // Sanity: we must not have hidden the explorer container or read-only output.
    expect(hideBlock).not.toContain(":global(.connect-graph-explorer)");
    expect(hideBlock).not.toContain(":global(.recheck-result)");
    expect(hideBlock).not.toContain(":global(.provenance-block)");
  });
});
