/**
 * Fixture corpora for the cascade-validation harness (restormel-verification-engineering §7).
 *
 * FIXTURE ONLY — these are small, hand-authored, synthetic claim/span pairs for exercising
 * the harness plumbing, NOT the private production eval set (skill §7 "private eval set":
 * production-drawn, >=100 items, refreshed past model cutoffs, never published/tuned-on). The
 * harness reports numbers computed on these as `run_kind: "fixture"`. The real >=90%/<=2% bar
 * is measured on the private set by the host-app CI-gate job.
 *
 * Each corpus deliberately includes:
 *  - clearly SUPPORTED claims (span contains the claim) — should be caught cheaply,
 *  - UNSUPPORTED claims: fabricated (span silent) and contradicted (span refutes) — must NOT
 *    leak to "supported",
 *  - AbstentionBench-style cases (skill §4 "abstention is tested"): a false premise and an
 *    empty/absent-evidence span — must resolve to abstained/unverifiable, never supported.
 * Claims are grouped across a couple of source docs per corpus so the clustered-SE path
 * (skill §7) has >1 cluster to work with.
 *
 * KNOWN FIXTURE-DOUBLE LIMITATION (honest reporting, REC-ADR-016): `legal-3` is a
 * VALUE-SUBSTITUTION contradiction (claim says "France", span says "England and Wales") —
 * same polarity, high lexical overlap, opposite fact. The pure-lexical fixture doubles
 * (hhem/granite/frontier) CANNOT catch this and will leak it to "supported", so the
 * legal-sample corpus REPORTS a bar FAIL under fixtures. This is a limitation of the
 * DOUBLES, not the cascade: a real Granite/frontier checker catches value substitution. It
 * is left in deliberately so the harness output honestly shows where the doubles fall short
 * and what the live tiers must cover; it is NOT patched with a hand-rolled "France≠England"
 * special-case (that would game the fixture). The harness tests assert the never-leak safety property on
 * corpora where the doubles can honestly deliver it (polarity-flip + fabricated + absent),
 * and treat legal-3 as a documented live-tier expectation.
 */
import type { CorpusFixture } from "../harness.js";

// A stable synthetic source-version hash per doc (fixture; not a real contentHash of bytes).
const H = (docId: string) => `fixture-hash-${docId}`;

export const LEGAL_FIXTURE: CorpusFixture = {
  corpus: "legal-sample",
  version: 1,
  description: "FIXTURE — synthetic legal claim/span pairs for harness plumbing.",
  claims: [
    {
      ref: "legal-1",
      claim: "The contract term is three years from the effective date.",
      span: "This Agreement shall have a term of three years commencing on the effective date.",
      sourceVersionHash: H("legal-a"),
      sourceDocId: "legal-a",
      label: "supported",
    },
    {
      ref: "legal-2",
      claim: "Either party may terminate the agreement for convenience with thirty days notice.",
      span: "Either party may terminate this Agreement for convenience upon thirty (30) days written notice.",
      sourceVersionHash: H("legal-a"),
      sourceDocId: "legal-a",
      label: "supported",
    },
    {
      ref: "legal-3",
      claim: "The governing law of the agreement is the law of France.",
      span: "This Agreement shall be governed by and construed in accordance with the laws of England and Wales.",
      sourceVersionHash: H("legal-a"),
      sourceDocId: "legal-a",
      // contradicted by VALUE SUBSTITUTION (France vs England and Wales). Same polarity,
      // opposite fact — the lexical fixture doubles leak this to "supported" (documented
      // above); a live Granite/frontier tier is expected to catch it.
      label: "unsupported",
    },
    {
      ref: "legal-4",
      claim: "The agreement caps aggregate liability at one million pounds.",
      span: "The parties agree to meet quarterly to review performance metrics.",
      sourceVersionHash: H("legal-b"),
      sourceDocId: "legal-b",
      label: "unsupported", // fabricated: span is silent on liability
    },
    {
      ref: "legal-5",
      // AbstentionBench: absent evidence (empty span) -> unverifiable, never supported.
      claim: "The indemnity survives termination of the agreement.",
      span: "",
      sourceVersionHash: H("legal-b"),
      sourceDocId: "legal-b",
      label: "unsupported",
    },
  ],
};

export const PHARMA_FIXTURE: CorpusFixture = {
  corpus: "pharma-sample",
  version: 1,
  description: "FIXTURE — synthetic pharma claim/span pairs for harness plumbing.",
  claims: [
    {
      ref: "pharma-1",
      claim: "The trial enrolled 240 patients across twelve sites.",
      span: "A total of 240 patients were enrolled across twelve clinical sites in the phase II trial.",
      sourceVersionHash: H("pharma-a"),
      sourceDocId: "pharma-a",
      label: "supported",
    },
    {
      ref: "pharma-2",
      claim: "The primary endpoint was met at week twelve.",
      span: "The study met its primary endpoint at week 12 with statistical significance (p<0.01).",
      sourceVersionHash: H("pharma-a"),
      sourceDocId: "pharma-a",
      label: "supported",
    },
    {
      ref: "pharma-3",
      claim: "No serious adverse events were reported during the study.",
      span: "Three serious adverse events were reported and are described in Table 4.",
      sourceVersionHash: H("pharma-a"),
      sourceDocId: "pharma-a",
      label: "unsupported", // contradicted
    },
    {
      ref: "pharma-4",
      // AbstentionBench: false premise (drug never mentioned) with a silent span.
      claim: "The compound reduced tumour volume by forty percent versus placebo.",
      span: "Patients were instructed to fast for eight hours before each visit.",
      sourceVersionHash: H("pharma-b"),
      sourceDocId: "pharma-b",
      label: "unsupported", // fabricated
    },
  ],
};

export const FINANCE_FIXTURE: CorpusFixture = {
  corpus: "finance-sample",
  version: 1,
  description: "FIXTURE — synthetic finance claim/span pairs for harness plumbing.",
  claims: [
    {
      ref: "fin-1",
      claim: "Quarterly revenue grew to 5.2 million pounds.",
      span: "Revenue for the quarter grew to £5.2 million, up 8% year on year.",
      sourceVersionHash: H("fin-a"),
      sourceDocId: "fin-a",
      label: "supported",
    },
    {
      ref: "fin-2",
      claim: "The company declared a dividend for the quarter.",
      span: "The board did not declare a dividend for the quarter, preserving capital for reinvestment.",
      sourceVersionHash: H("fin-a"),
      sourceDocId: "fin-a",
      label: "unsupported", // contradicted
    },
    {
      ref: "fin-3",
      claim: "Operating margin was reported at eighteen percent.",
      span: "Gross margin improved on supply-chain efficiencies during the period.",
      sourceVersionHash: H("fin-b"),
      sourceDocId: "fin-b",
      label: "unsupported", // fabricated: operating margin not stated
    },
    {
      ref: "fin-4",
      claim: "Headcount increased over the period.",
      span: "The company grew its headcount over the period, adding roles across engineering and sales.",
      sourceVersionHash: H("fin-b"),
      sourceDocId: "fin-b",
      label: "supported",
    },
  ],
};

export const ALL_CORPUS_FIXTURES: CorpusFixture[] = [
  LEGAL_FIXTURE,
  PHARMA_FIXTURE,
  FINANCE_FIXTURE,
];
