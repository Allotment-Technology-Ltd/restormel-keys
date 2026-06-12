import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Contract test for the R6 mobile read-only tier (fix-forward, 3rd iteration).
 *
 * The three mobile-allowed surfaces are read-only:
 *   /claims          → ConnectGraphExplorer (mounts ConnectGraphReadinessWizard +
 *                      ConnectReadinessLibrary)
 *   /claims/memory   → memory inbox (revoke observation, POST /revoke)
 *   /home            → ConnectGraphSwitcher (active-graph activate)
 *   /runs/[id]       → ConnectIngestRunConsole (restart / cancel)
 *
 * Those components expose affordances that POST/PATCH/DELETE to the pipeline.
 * The ux-contracts §3 R6 row claims these surfaces render read-only with the
 * mutating actions hidden. This test pins that claim:
 *   1. the layout's `.shell-mobile-readonly` rule MUST hide every audited
 *      mutation region;
 *   2. each region MUST still exist as a real action container in its component
 *      (renaming a region without updating the hide rule fails the build);
 *   3. the verdict keyboard shortcuts (which CSS can't hide) MUST be guarded on
 *      the read-only flag;
 *   4. a mutation-trigger inventory: every `method: POST|PATCH|PUT|DELETE` fetch
 *      reachable on a read-only surface MUST map to a hidden region or a
 *      documented read-only/guarded exception — a NEW mutation region therefore
 *      fails this test rather than silently leaking.
 */

function read(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
}

const layoutSrc = read("../routes/keys/dashboard/+layout.svelte");
const explorerSrc = read("./components/connect/ConnectGraphExplorer.svelte");
const wizardSrc = read("./components/connect/ConnectGraphReadinessWizard.svelte");
const librarySrc = read("./components/connect/ConnectReadinessLibrary.svelte");
const runConsoleSrc = read("./components/connect/pipeline/ConnectIngestRunConsole.svelte");
const graphSwitcherSrc = read("./components/connect/ConnectGraphSwitcher.svelte");
const memoryPageSrc = read("../routes/keys/dashboard/claims/memory/+page.svelte");

/**
 * Every mutation action-region audited across the read-only surfaces, with the
 * component its `class="…"` lives in.
 */
const MUTATION_REGIONS: { selector: string; src: string; note: string }[] = [
  { selector: "review-actions", src: explorerSrc, note: "verdict approve/reject/supported (performReview)" },
  { selector: "dossier-actions", src: explorerSrc, note: "Accept supported / Exclude" },
  { selector: "dossier-recheck", src: explorerSrc, note: "Re-check now" },
  { selector: "remove-section", src: explorerSrc, note: "Remove from graph (DELETE)" },
  { selector: "cohort-complete-actions", src: explorerSrc, note: "Start next run (createReadinessRun)" },
  { selector: "revalidate-actions", src: explorerSrc, note: "Auto-remediate" },
  { selector: "wizard-actions", src: wizardSrc, note: "scan/save/sync/import/link/embed/validate" },
  { selector: "lib-new", src: librarySrc, note: "readiness library New run create (POST)" },
  { selector: "lib-run-archive", src: librarySrc, note: "readiness library archive (PATCH)" },
  { selector: "run-actions", src: runConsoleSrc, note: "header restart (POST /restart)" },
  { selector: "run-cancel-wrap", src: runConsoleSrc, note: "cancel running job (POST /cancel)" },
  { selector: "run-error-banner-actions", src: runConsoleSrc, note: "failed-run banner restart (POST /restart)" },
  { selector: "switcher-control", src: graphSwitcherSrc, note: "active-graph select on:change (POST /activate)" },
  // /claims/memory — iteration 3: revoke (POST /revoke) is live on a mobile-allowed sub-route.
  { selector: "item-actions", src: memoryPageSrc, note: "memory page per-observation Revoke button (POST /revoke)" },
  { selector: "memory-revoke-error", src: memoryPageSrc, note: "memory page revoke-error banner + Try again (re-fires POST /revoke)" },
];

/** Isolate the `.shell-mobile-readonly … display: none` block from the layout. */
function mobileReadonlyHideBlock(): string {
  const match = layoutSrc.match(
    /((?:\s*\.shell-mobile-readonly[^{}]*,)*\s*\.shell-mobile-readonly[^{}]*\{\s*display:\s*none\s*!important;)/,
  );
  expect(match, "could not find a .shell-mobile-readonly display:none block").toBeTruthy();
  return match![0];
}

describe("R6 mobile read-only contract (claims / home / runs)", () => {
  const hideBlock = mobileReadonlyHideBlock();

  it("layout's mobile-readonly rule hides every audited mutation region", () => {
    for (const { selector } of MUTATION_REGIONS) {
      expect(
        hideBlock.includes(`:global(.${selector})`),
        `.shell-mobile-readonly must hide :global(.${selector})`,
      ).toBe(true);
    }
  });

  it("every hidden mutation region still exists as an action container in its component", () => {
    for (const { selector, src, note } of MUTATION_REGIONS) {
      expect(
        new RegExp(`class="[^"]*\\b${selector}\\b`).test(src),
        `expected class="…${selector}…" (${note}) to exist in its component`,
      ).toBe(true);
    }
  });

  it("the live verdict buttons (.review-actions) are covered — the core Major", () => {
    expect(hideBlock).toContain(":global(.review-actions)");
    expect(explorerSrc).toMatch(/class="review-actions"/);
    expect(explorerSrc).toMatch(/performReview\(selectedUnit/);
  });

  it("MAJOR 1 — the readiness library create + archive are covered", () => {
    expect(hideBlock).toContain(":global(.lib-new)");
    expect(hideBlock).toContain(":global(.lib-run-archive)");
    // Both regions dispatch the events the explorer turns into POST/PATCH calls.
    expect(librarySrc).toMatch(/dispatch\("create"/);
    expect(librarySrc).toMatch(/dispatch\("archive"/);
    expect(explorerSrc).toMatch(/on:create=\{.*createReadinessRun/);
    expect(explorerSrc).toMatch(/on:archive=\{.*archiveReadinessRun/);
  });

  it("MAJOR 2 — the failed-run error-banner restart is covered", () => {
    expect(hideBlock).toContain(":global(.run-error-banner-actions)");
    // The banner's restart button fires restartJob → POST /restart.
    expect(runConsoleSrc).toMatch(/class="run-error-banner-actions"/);
    expect(runConsoleSrc).toMatch(/jobsApiBase\}\/restart`/);
  });

  it("MAJOR 3 — /claims/memory revoke and revoke-error retry are covered", () => {
    // .item-actions holds the Revoke button (POST /revoke).
    expect(hideBlock).toContain(":global(.item-actions)");
    expect(memoryPageSrc).toMatch(/class="item-actions"/);
    // .memory-revoke-error wraps the per-observation error banner whose "Try again"
    // re-fires revokeObservation (POST /revoke). The outer page-load error banner's
    // "Try again" calls invalidateAll (a read) and is intentionally NOT hidden.
    expect(hideBlock).toContain(":global(.memory-revoke-error)");
    expect(memoryPageSrc).toMatch(/class="memory-revoke-error"/);
    // Confirm revokeObservation actually POSTs so the selector is load-bearing.
    expect(memoryPageSrc).toMatch(/method:\s*["']POST["']/);
    expect(memoryPageSrc).toMatch(/\/revoke/);
  });

  it("the /home active-graph switcher (POST /activate) is covered", () => {
    expect(hideBlock).toContain(":global(.switcher-control)");
    expect(graphSwitcherSrc).toMatch(/class="switcher-control"/);
    expect(graphSwitcherSrc).toMatch(/activate`,\s*\{\s*method:\s*"POST"/);
  });

  it("the verdict keyboard shortcuts are guarded on the read-only flag (CSS can't hide them)", () => {
    // The window keydown handler must consult the data-mobile-readonly flag and
    // early-return on the mutating shortcuts.
    expect(explorerSrc).toMatch(/<svelte:window on:keydown=\{handleReviewKeydown\}/);
    expect(explorerSrc).toMatch(/\[data-mobile-readonly="true"\]/);
    // Each mutating shortcut branch (a/w/u) must short-circuit when read-only.
    const guardCount = (explorerSrc.match(/if \(mobileReadonly\) return;/g) ?? []).length;
    expect(
      guardCount,
      "expected the a/w/u verdict shortcuts to each early-return when mobileReadonly",
    ).toBeGreaterThanOrEqual(3);
  });

  it("read-only viewing chrome is NOT hidden", () => {
    expect(hideBlock).not.toContain(":global(.connect-graph-explorer)");
    expect(hideBlock).not.toContain(":global(.recheck-result)");
    expect(hideBlock).not.toContain(":global(.provenance-block)");
    // The library run-select (read-only: switches scope, no mutation) stays live.
    expect(hideBlock).not.toContain(":global(.lib-run-select)");
  });

  it("inventory — every reachable POST/PATCH/PUT/DELETE maps to a hidden region or a documented exception", () => {
    // Read-only POST-for-query / guidance endpoints and read-only refreshers that
    // are intentionally NOT hidden. Keep this list explicit so a new mutation
    // endpoint that is NOT on it forces a conscious audit decision.
    const READONLY_EXCEPTIONS: { src: string; marker: string; why: string }[] = [
      { src: explorerSrc, marker: "graph/relations/preview", why: "POST-for-query: cluster relations preview (read)" },
      { src: explorerSrc, marker: "review-coaching", why: "POST-for-read: verdict guidance generation (no state change)" },
    ];

    // The genuine state-mutation endpoints we expect to find on read-only
    // surfaces, each owned by a hidden region (asserted above) or the keyboard
    // guard. This is the canonical list — if a component grows a NEW mutating
    // endpoint, the count assertion below trips.
    const expectedMutationEndpoints: Record<string, string[]> = {
      explorer: [
        "readiness/runs", // createReadinessRun / archiveReadinessRun (lib + cohort regions)
        "validation", // submitReview (.review-actions + keyboard guard) & removeFromGraph (.remove-section, DELETE)
        "evidence", // performEvidenceAccept/Exclude/Recheck (.dossier-actions / .dossier-recheck)
        "link-sources", // startSourceLinking (.wizard-actions)
        "domain-packs", // savePackMappingAndRescan (.wizard-actions)
        "graph/sources", // discoverSources / syncPack / importSources (.wizard-actions)
        "embed", // startEmbedBackfill (.wizard-actions)
        "revalidate", // startBatchValidation / startAutoRemediation (.wizard-actions / .revalidate-actions)
      ],
      runConsole: ["restart", "cancel"],
      switcher: ["activate"],
      // /claims/memory: 1 mutation endpoint, hidden via .item-actions + .memory-revoke-error.
      memory: ["revoke"],
    };

    // Sanity: each named mutation endpoint actually appears in its component, so
    // the canonical list can't silently drift away from the code.
    for (const ep of expectedMutationEndpoints.explorer) {
      expect(explorerSrc, `explorer should reference mutation endpoint "${ep}"`).toContain(ep);
    }
    for (const ep of expectedMutationEndpoints.runConsole) {
      expect(runConsoleSrc, `run console should reference mutation endpoint "${ep}"`).toContain(ep);
    }
    for (const ep of expectedMutationEndpoints.switcher) {
      expect(graphSwitcherSrc, `switcher should reference mutation endpoint "${ep}"`).toContain(ep);
    }
    for (const ep of expectedMutationEndpoints.memory) {
      expect(memoryPageSrc, `memory page should reference mutation endpoint "${ep}"`).toContain(ep);
    }

    // Count the raw mutation fetches per component. If a new POST/PATCH/PUT/DELETE
    // appears, these counts change and this test fails — forcing the author to
    // audit it (hide its region, or add it to READONLY_EXCEPTIONS with a reason).
    const mutationRe = /method:\s*["'](?:POST|PATCH|PUT|DELETE)["']/g;
    const counts = {
      explorer: (explorerSrc.match(mutationRe) ?? []).length,
      runConsole: (runConsoleSrc.match(mutationRe) ?? []).length,
      switcher: (graphSwitcherSrc.match(mutationRe) ?? []).length,
      // memory page: 1 mutation fetch (POST /revoke), hidden via .item-actions + .memory-revoke-error.
      memory: (memoryPageSrc.match(mutationRe) ?? []).length,
    };
    // explorer: 16 fetches — 14 mutations + 2 read-only exceptions (preview, coaching).
    expect(
      counts.explorer,
      `ConnectGraphExplorer mutation-fetch count changed (${counts.explorer}); ` +
        `audit the new region: hide it or add it to READONLY_EXCEPTIONS. ` +
        `Exceptions tracked: ${READONLY_EXCEPTIONS.length}`,
    ).toBe(16);
    expect(counts.runConsole, "ConnectIngestRunConsole mutation-fetch count changed").toBe(2);
    expect(counts.switcher, "ConnectGraphSwitcher mutation-fetch count changed").toBe(1);
    expect(counts.memory, "claims/memory page mutation-fetch count changed").toBe(1);
  });
});
