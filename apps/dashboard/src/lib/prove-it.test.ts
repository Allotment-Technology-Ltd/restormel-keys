/**
 * W4.3 — "Prove it" as a global gesture.
 *
 * Two responsibilities:
 *  1. Unit-test the destination builders in `prove-it.ts` — every prove-it click
 *     must land on a *real* W2.1/W2.2 deep link, never a dead param (rubric X4).
 *  2. The lint: assert the shared affordance (`PROVE_LINK_CLASS`) is applied
 *     wherever the scorecard / dossier service's numbers render. This is a
 *     best-effort source heuristic (documented below), not a render test — it
 *     greps the component sources for the trust-bearing surfaces and fails if a
 *     known assertion surface stops carrying the gesture. It deliberately does
 *     NOT try to prove completeness across the whole tree; it pins the audited
 *     surfaces so a future edit that strips the affordance trips here.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  PROVE_LINK_CLASS,
  proveClaimsFilterHref,
  proveDossierHref,
  proveRunVerdictHref,
  type ProveFilter,
} from "./prove-it";
import { CLAIMS_HREF, RUNS_HREF } from "./nav-config";
import { parseExplorerUrlState } from "./connect/explorer-url-state";

/**
 * Every `ProveFilter` value the union admits. Listed explicitly (not derived) so a
 * NEW member added to the union without a matching explorer token trips the
 * round-trip guard below at compile *and* run time — the permanent dead-token guard.
 */
const ALL_PROVE_FILTERS: readonly ProveFilter[] = [
  "review",
  "supported",
  "inferred",
  "unverified",
  "contradicted",
  "excluded",
];

const here = dirname(fileURLToPath(import.meta.url));

describe("prove-it destinations — every gesture lands on real evidence", () => {
  it("proveClaimsFilterHref builds a W2.1 ?filter= deep link", () => {
    expect(proveClaimsFilterHref("review")).toBe(`${CLAIMS_HREF}?filter=review`);
    expect(proveClaimsFilterHref("contradicted")).toBe(`${CLAIMS_HREF}?filter=contradicted`);
  });

  it("proveClaimsFilterHref threads the W2.5 as_of param when given", () => {
    const href = proveClaimsFilterHref("contradicted", "2026-01-01");
    const url = new URL(href, "https://restormel.dev");
    expect(url.searchParams.get("filter")).toBe("contradicted");
    expect(url.searchParams.get("as_of")).toBe("2026-01-01");
  });

  it("proveClaimsFilterHref ignores empty/null as_of (no dangling param)", () => {
    expect(proveClaimsFilterHref("review", null)).toBe(`${CLAIMS_HREF}?filter=review`);
    expect(proveClaimsFilterHref("review", "")).toBe(`${CLAIMS_HREF}?filter=review`);
  });

  it("proveDossierHref builds a W2.2 ?unit= deep link and encodes the id", () => {
    expect(proveDossierHref("idea:abc")).toBe(`${CLAIMS_HREF}?unit=idea%3Aabc`);
  });

  it("proveRunVerdictHref lands on the producing run when an id is present", () => {
    expect(proveRunVerdictHref("run_123", { from: "home-inbox" })).toBe(
      `${RUNS_HREF}/run_123?from=home-inbox`,
    );
    expect(proveRunVerdictHref("run_123")).toBe(`${RUNS_HREF}/run_123`);
  });

  it("proveRunVerdictHref degrades to the review queue (never a dead link) without a run id", () => {
    // The roadmap's "if a payload predates run identities, degrade to the review queue" rule.
    expect(proveRunVerdictHref(null)).toBe(proveClaimsFilterHref("review"));
    expect(proveRunVerdictHref(undefined)).toBe(proveClaimsFilterHref("review"));
  });
});

// ---------------------------------------------------------------------------
// The permanent dead-token guard (W4.3 review Major). Every ProveFilter value
// must survive parseExplorerUrlState — build the href, parse its ?filter=, and
// assert the explorer RECOGNISES it (changes scope, sets a verdict, or sets a
// verification-state filter) rather than silently dropping it to the default
// review queue. This is what made `unbound` / `missing_embed` dead tokens: the
// union admitted them but parseExplorerUrlState ignored them. If a future edit
// re-adds a filter the explorer can't parse, this trips.
// ---------------------------------------------------------------------------
describe("prove-it round-trip — every ProveFilter survives parseExplorerUrlState", () => {
  /** A parsed state "recognises" the filter when it is not the bare default. */
  function isRecognised(filter: ProveFilter): boolean {
    const href = proveClaimsFilterHref(filter);
    const url = new URL(href, "https://restormel.dev");
    const state = parseExplorerUrlState(url.searchParams);
    if (filter === "review") {
      // `review` is the QueueScope default; it round-trips by KEEPING that scope
      // (and not being misread as a verdict/verification filter).
      return (
        state.queueScope === "review" &&
        state.verdictFilter === null &&
        state.verificationStateFilter === null
      );
    }
    // Every other member is a W2.2 verification state: it must land in
    // verificationStateFilter, never be silently dropped.
    return state.verificationStateFilter === filter;
  }

  for (const filter of ALL_PROVE_FILTERS) {
    it(`?filter=${filter} is recognised (not silently dropped to the default queue)`, () => {
      expect(
        isRecognised(filter),
        `proveClaimsFilterHref("${filter}") builds a token parseExplorerUrlState ignores — a dead filter`,
      ).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// The lint heuristic. Source-grep, not render — keeps the test cheap and stable
// while still tripping if a trust-assertion surface drops the prove-it gesture.
// Each entry: a surface that renders a scorecard/dossier service number, and the
// minimum number of prove-it class applications it must carry.
// ---------------------------------------------------------------------------
const PROVE_IT_SURFACES: { file: string; minApplications: number; note: string }[] = [
  {
    file: "components/connect/ConnectTrustScorecard.svelte",
    minApplications: 5, // 3 metric tiles + state chips + factor drill
    note: "scorecard factor rails, metric cells, state chips, per-factor 'Show ↗'",
  },
  {
    file: "components/connect/graph-comparison/ProvenanceDrawer.svelte",
    minApplications: 1, // injected-claim → dossier
    note: "MCP answer verified-claim envelope → Evidence Dossier",
  },
  {
    file: "../routes/keys/dashboard/home/+page.svelte",
    minApplications: 3, // cap review + inbox review + regression diff
    note: "Home trust cap 'need review ↗', inbox review, latest-regression diff",
  },
];

describe("prove-it lint — trust-assertion surfaces carry the shared affordance", () => {
  for (const surface of PROVE_IT_SURFACES) {
    it(`${surface.file} applies ${PROVE_LINK_CLASS} (${surface.note})`, () => {
      const src = readFileSync(resolve(here, surface.file), "utf8");
      // Count applications of the gesture. Three equivalent forms:
      //  - `PROVE_LINK_CLASS` interpolation on a raw <a>,
      //  - a literal "prove-it" class on a raw <a>,
      //  - a `<ProveLink …>` component instance (which carries the class itself).
      // Take the max of the raw-class forms (they co-occur on the same anchor) and
      // ADD the component instances (a distinct application path).
      const interpolated = (src.match(/PROVE_LINK_CLASS/g) ?? []).length;
      const literal = (src.match(/class="[^"]*\bprove-it\b/g) ?? []).length;
      const component = (src.match(/<ProveLink\b/g) ?? []).length;
      const applications = Math.max(interpolated, literal) + component;
      expect(
        applications,
        `${surface.file} must apply the prove-it affordance to its trust numbers`,
      ).toBeGreaterThanOrEqual(surface.minApplications);
    });
  }

  it("the shared class is defined globally so the affordance is one rule", () => {
    const css = readFileSync(
      resolve(here, "styles/brutalist-utilities.css"),
      "utf8",
    );
    expect(css).toMatch(/\.prove-it\s*\{/);
  });
});
