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
} from "./prove-it";
import { CLAIMS_HREF, RUNS_HREF } from "./nav-config";

const here = dirname(fileURLToPath(import.meta.url));

describe("prove-it destinations — every gesture lands on real evidence", () => {
  it("proveClaimsFilterHref builds a W2.1 ?filter= deep link", () => {
    expect(proveClaimsFilterHref("review")).toBe(`${CLAIMS_HREF}?filter=review`);
    expect(proveClaimsFilterHref("unbound")).toBe(`${CLAIMS_HREF}?filter=unbound`);
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
      // Count references to the shared class token (`PROVE_LINK_CLASS` interpolation
      // or a literal "prove-it" class). Either form is an application of the gesture.
      const interpolated = (src.match(/PROVE_LINK_CLASS/g) ?? []).length;
      const literal = (src.match(/class="[^"]*\bprove-it\b/g) ?? []).length;
      const applications = Math.max(interpolated, literal);
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
