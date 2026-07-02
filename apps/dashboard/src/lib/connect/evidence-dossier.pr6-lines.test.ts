/**
 * RES-113 verification-UI PR-6 — dossier first-contact line pins
 * (placement spec §3.2 / §5 item 7; copy pack §3.5, decisions D + E).
 *
 * Pins the spec's test requirements:
 *   • predicate: `judge !== null` — a judge-less summary renders NOTHING,
 *   • exactly one of the three variants per dossier, strings byte-for-byte,
 *   • dates render DD Month YYYY (§6.5); a dateless dated-variant is absent,
 *     never fabricated,
 *   • no "CHECKED BY" label, and the word "checker" never appears (decision D),
 *   • no second disclosure, no new dossier fields,
 *   • BLOCKED/AMBIGUOUS component names never render,
 *   • the render is gated by the `m1PlugPoints` flag (flag-OFF byte-identical).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DOSSIER_ABSTENTION_LINE,
  dossierFirstContactLine,
  dossierHumanVerdictLine,
  dossierIndependenceGloss,
  formatDossierFirstContactDate,
  type UnitEvidenceSummary,
} from "./evidence-dossier";

const EXPLORER_SOURCE = readFileSync(
  resolve(__dirname, "../components/connect/ConnectGraphExplorer.svelte"),
  "utf8",
);

function summary(over: Partial<UnitEvidenceSummary> = {}): Pick<
  UnitEvidenceSummary,
  "judge" | "judgedBy" | "judgedAt" | "verificationState"
> {
  return {
    verificationState: "supported",
    judgedBy: "gpt-5#pv2",
    judgedAt: "2026-06-10T09:00:00.000Z",
    judge: {
      model: "gpt-5",
      promptVersion: 2,
      verdict: "entailed",
      confidence: 0.93,
      judgedAt: "2026-06-15T09:00:00.000Z",
    },
    ...over,
  };
}

describe("PR-6 — predicate: judge !== null, else zero pixels", () => {
  it("renders nothing without a judge, whatever else is set", () => {
    expect(dossierFirstContactLine(null)).toBeNull();
    expect(dossierFirstContactLine(undefined)).toBeNull();
    expect(dossierFirstContactLine(summary({ judge: null }))).toBeNull();
    expect(
      dossierFirstContactLine(
        summary({ judge: null, judgedBy: "operator:u1", verificationState: "unverified" }),
      ),
    ).toBeNull();
  });
});

describe("PR-6 — the three §3.5 variants, byte-for-byte", () => {
  it("machine verdict → the independence gloss with the judge date", () => {
    const line = dossierFirstContactLine(summary());
    expect(line).toEqual({
      variant: "machine",
      text: "Checked against its source on 15 June 2026 by a model independent of the one that read your documents.",
    });
  });

  it("recorded Operator verdict → the human-verdict variant with the state-write date", () => {
    const line = dossierFirstContactLine(summary({ judgedBy: "operator:u_42" }));
    expect(line).toEqual({
      variant: "human",
      text: "Reviewed by you on 10 June 2026.",
    });
  });

  it("claim awaiting triage (unverified, ledger row 10) → the abstention line", () => {
    const line = dossierFirstContactLine(
      summary({
        verificationState: "unverified",
        judge: {
          model: "gpt-5",
          promptVersion: 2,
          verdict: "abstain",
          confidence: null,
          judgedAt: "2026-06-15T09:00:00.000Z",
        },
      }),
    );
    expect(line).toEqual({
      variant: "abstention",
      text: "We couldn't fully match this claim to its source — it's waiting for your verdict.",
    });
    expect(DOSSIER_ABSTENTION_LINE).toBe(
      "We couldn't fully match this claim to its source — it's waiting for your verdict.",
    );
  });

  it("exactly one variant per dossier — the derivation returns a single line", () => {
    // Operator attribution wins over everything else; a triaged claim is no
    // longer "waiting for your verdict".
    const line = dossierFirstContactLine(summary({ judgedBy: "operator:u1" }));
    expect(line!.variant).toBe("human");
  });
});

describe("PR-6 — dates: DD Month YYYY, absent when unmeasured", () => {
  it("formats en-GB long month (copy pack §6.5)", () => {
    expect(formatDossierFirstContactDate("2026-07-02T08:00:00.000Z")).toBe("2 July 2026");
    expect(formatDossierFirstContactDate(null)).toBeNull();
    expect(formatDossierFirstContactDate("not-a-date")).toBeNull();
  });

  it("a dated variant with no date renders nothing — never a fabricated date", () => {
    expect(
      dossierFirstContactLine(
        summary({
          judgedAt: null,
          judge: {
            model: "gpt-5",
            promptVersion: 2,
            verdict: "entailed",
            confidence: 0.9,
            judgedAt: null,
          },
        }),
      ),
    ).toBeNull();
    expect(
      dossierFirstContactLine(summary({ judgedBy: "operator:u1", judgedAt: null })),
    ).toBeNull();
  });
});

describe("PR-6 — decision D pins: no 'checker', no 'CHECKED BY'", () => {
  it("the registered strings never say 'checker' or 'CHECKED BY'", () => {
    const all = [
      dossierIndependenceGloss("15 June 2026"),
      dossierHumanVerdictLine("15 June 2026"),
      DOSSIER_ABSTENTION_LINE,
    ].join("\n");
    expect(all).not.toMatch(/checker/i);
    expect(all).not.toMatch(/checked by/i);
  });

  it("the explorer component renders no 'CHECKED BY' label and no 'checker'", () => {
    expect(EXPLORER_SOURCE).not.toMatch(/CHECKED BY/);
    expect(EXPLORER_SOURCE).not.toMatch(/\bchecker\b/i);
  });
});

describe("PR-6 — structure pins: no second disclosure, flag-gated", () => {
  it("the dossier still has exactly its two shipped disclosures (versions + judgments)", () => {
    const disclosures = EXPLORER_SOURCE.match(/<details class="dossier-/g) ?? [];
    expect(disclosures).toHaveLength(2);
  });

  it("the first-contact line is gated by m1PlugPoints — flag-OFF is byte-identical", () => {
    expect(EXPLORER_SOURCE).toContain("{@const firstContact = dossierFirstContactLine(evidence)}");
    const gate = EXPLORER_SOURCE.indexOf(
      "{@const firstContact = dossierFirstContactLine(evidence)}",
    );
    const flagIf = EXPLORER_SOURCE.lastIndexOf("{#if m1PlugPoints}", gate);
    expect(flagIf).toBeGreaterThan(-1);
    expect(gate - flagIf).toBeLessThan(120);
  });

  it("BLOCKED/AMBIGUOUS component names never render (REC-GOV-022)", () => {
    const all = [
      dossierIndependenceGloss("15 June 2026"),
      dossierHumanVerdictLine("15 June 2026"),
      DOSSIER_ABSTENTION_LINE,
    ].join("\n");
    const banned = /nv[-_]?embed|patronus|lynx|bespoke|minicheck|jina|lytang|surya/i;
    expect(all).not.toMatch(banned);
    expect(EXPLORER_SOURCE).not.toMatch(banned);
  });
});
