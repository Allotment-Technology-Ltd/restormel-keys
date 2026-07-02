/**
 * RES-113 verification-UI PR-7 — passage-fidelity discriminant pins
 * (placement spec §3.2 / §5 item 8; copy pack §3.5 "Passage fidelity").
 *
 * Pins the spec's test requirements:
 *   • a spatial span renders exactly as today — NO note (`evidenceFidelityNote` null),
 *   • a textual span renders the registered §3.5 line, byte-for-byte,
 *   • tier names (A/B) appear nowhere — not in the strings, not in the rendering
 *     component (grep-pinned against the component source),
 *   • the note render is gated by the `m1PlugPoints` flag (flag-OFF byte-identical).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  EVIDENCE_TEXTUAL_FIDELITY_NOTE,
  evidenceFidelityNote,
  normalizeEvidenceFidelity,
} from "./evidence-dossier";

const EXPLORER_SOURCE = readFileSync(
  resolve(__dirname, "../components/connect/ConnectGraphExplorer.svelte"),
  "utf8",
);

describe("PR-7 — fidelity normalization (derivation seam)", () => {
  it('only an explicit "textual" marker downgrades; everything else is spatial', () => {
    expect(normalizeEvidenceFidelity("textual")).toBe("textual");
    expect(normalizeEvidenceFidelity("  TEXTUAL ")).toBe("textual");
    expect(normalizeEvidenceFidelity("spatial")).toBe("spatial");
    // Absent / unknown markers (every span bound before the discriminant existed)
    // stay spatial, so shipped spans keep rendering byte-identically.
    expect(normalizeEvidenceFidelity(null)).toBe("spatial");
    expect(normalizeEvidenceFidelity(undefined)).toBe("spatial");
    expect(normalizeEvidenceFidelity("")).toBe("spatial");
    expect(normalizeEvidenceFidelity(42)).toBe("spatial");
    expect(normalizeEvidenceFidelity("tier-b")).toBe("spatial");
  });
});

describe("PR-7 — note derivation: state earns pixels", () => {
  it("a spatial span renders exactly as today: no note", () => {
    expect(evidenceFidelityNote({ fidelity: "spatial" })).toBeNull();
    expect(evidenceFidelityNote(null)).toBeNull();
    expect(evidenceFidelityNote(undefined)).toBeNull();
  });

  it("a textual span renders the registered §3.5 line, byte-for-byte", () => {
    expect(evidenceFidelityNote({ fidelity: "textual" })).toBe(
      "Source passage shown as text — this document type doesn't support a visual highlight.",
    );
    expect(EVIDENCE_TEXTUAL_FIDELITY_NOTE).toBe(
      "Source passage shown as text — this document type doesn't support a visual highlight.",
    );
  });
});

describe("PR-7 — grep pins: tier names never render", () => {
  it("the registered string carries no tier name", () => {
    expect(EVIDENCE_TEXTUAL_FIDELITY_NOTE).not.toMatch(/tier/i);
  });

  it("the explorer component names no cascade tier anywhere (Tier A / Tier B)", () => {
    // (The pre-existing "mobile read-only tier" comments are not tier NAMES;
    // the pin is on the copy-pack rule: A/B tier names never appear.)
    expect(EXPLORER_SOURCE).not.toMatch(/\btier\s*[- ]?\s*[AB]\b/i);
    expect(EXPLORER_SOURCE).not.toMatch(/\b(spatial|textual)\s+tier\b/i);
  });

  it("the note render is flag-gated (m1PlugPoints) — flag-OFF is byte-identical", () => {
    expect(EXPLORER_SOURCE).toContain(
      "{#if m1PlugPoints && evidenceFidelityNote(evidence.evidence)}",
    );
  });
});
