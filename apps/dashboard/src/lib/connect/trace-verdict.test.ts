import { describe, it, expect } from "vitest";
import { deriveTraceVerdict, citedSourceTitles, type TraceClaimLike } from "./trace-verdict";
import { deriveAnswerVerdict, type ProvenanceClaim } from "./graph-comparison-types";

/** A persisted ClaimTrace-like row with the fields the verdict derivation reads. */
function claim(
  partial: Partial<TraceClaimLike> & { included: boolean },
): TraceClaimLike & { source_ref: string | null } {
  return {
    verification_state: partial.verification_state ?? null,
    verification_category: partial.verification_category ?? null,
    included: partial.included,
    source_ref: (partial as { source_ref?: string | null }).source_ref ?? null,
  };
}

describe("deriveTraceVerdict", () => {
  it("abstains when no claim was included (the honest decline)", () => {
    const v = deriveTraceVerdict([
      claim({ verification_category: "supported", included: false }),
    ]);
    expect(v.verdict).toBe("abstained");
    expect(v.abstained).toBe(true);
    expect(v.totalIncluded).toBe(0);
  });

  it("abstains on an empty claim set", () => {
    expect(deriveTraceVerdict([]).verdict).toBe("abstained");
  });

  it("is grounded when every included claim is supported (by category)", () => {
    const v = deriveTraceVerdict([
      claim({ verification_category: "supported", included: true }),
      claim({ verification_category: "supported", included: true }),
    ]);
    expect(v.verdict).toBe("grounded");
    expect(v.supportedCount).toBe(2);
    expect(v.weakCount).toBe(0);
  });

  it("is uncertain when an included claim is weaker than supported", () => {
    const v = deriveTraceVerdict([
      claim({ verification_category: "supported", included: true }),
      claim({ verification_category: "weak", included: true }),
    ]);
    expect(v.verdict).toBe("uncertain");
    expect(v.supportedCount).toBe(1);
    expect(v.weakCount).toBe(1);
  });

  it("falls back to the raw state for legacy traces with no category", () => {
    const v = deriveTraceVerdict([
      claim({ verification_state: "validated", verification_category: null, included: true }),
    ]);
    expect(v.verdict).toBe("grounded");
  });

  // ── Cohesion: the Traces verdict must match the Answer Console's verdict ──
  // The console derives from ProvenanceClaim (verification: "supported" | "weak"); Traces
  // derives from the persisted ClaimTrace. Same inputs ⇒ identical verdict vocabulary.
  it("matches the console's deriveAnswerVerdict across every shape", () => {
    const cases: { category: "supported" | "weak"; verification: "supported" | "weak" }[][] = [
      [], // abstention
      [{ category: "supported", verification: "supported" }],
      [
        { category: "supported", verification: "supported" },
        { category: "weak", verification: "weak" },
      ],
      [
        { category: "weak", verification: "weak" },
        { category: "weak", verification: "weak" },
      ],
    ];

    for (const c of cases) {
      const traceVerdict = deriveTraceVerdict(
        c.map((x) => claim({ verification_category: x.category, included: true })),
      );
      const consoleClaims: ProvenanceClaim[] = c.map((x, i) => ({
        id: `c${i}`,
        text: "t",
        sourceTitle: "s",
        verification: x.verification,
        trustScore: null,
      }));
      const consoleVerdict = deriveAnswerVerdict({ claims: consoleClaims });
      expect(traceVerdict.verdict).toBe(consoleVerdict.verdict);
    }
  });
});

describe("citedSourceTitles", () => {
  it("returns distinct, trimmed source titles of included claims only", () => {
    const sources = citedSourceTitles([
      { source_ref: "Nicomachean Ethics", included: true },
      { source_ref: "Nicomachean Ethics", included: true }, // dup
      { source_ref: "  Republic  ", included: true },
      { source_ref: "Filtered Out", included: false }, // excluded
      { source_ref: null, included: true },
    ]);
    expect(sources).toEqual(["Nicomachean Ethics", "Republic"]);
  });
});
