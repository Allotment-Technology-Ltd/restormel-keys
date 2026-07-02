import { describe, it, expect } from "vitest";

/**
 * WCAG 2.2 contrast audit for the Neo-Brutalist v3 palette.
 */

const PALETTE = {
  canvas: "#f3ead0",
  ink: "#0c0c0c",
  yellow: "#ffd600",
  blue: "#1a3f8a",
  coral: "#d94e47",
  surface: "#fffef0",
  /** --color-ink-faint / --rm-dim — the dimmed journey-nav item text (RES-113 PR-4). */
  dim: "#7a7060",
  /** --coral-alert (keys-tokens base.css) — the danger accent (RES-113 PR-2 slot-error). */
  coralAlert: "#f25c54",
} as const;

function channelToLinear(value8bit: number): number {
  const c = value8bit / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return (
    0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b)
  );
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

const AA_NORMAL = 4.5;
const AAA_NORMAL = 7;

describe("Neo-Brutalist palette contrast (WCAG)", () => {
  it("ink body text on canvas meets AAA", () => {
    expect(contrastRatio(PALETTE.ink, PALETTE.canvas)).toBeGreaterThanOrEqual(AAA_NORMAL);
  });

  it("ink text on yellow accent meets AAA (badges, kickers, active nav)", () => {
    expect(contrastRatio(PALETTE.ink, PALETTE.yellow)).toBeGreaterThanOrEqual(AAA_NORMAL);
  });

  it("ink text on surface meets AAA", () => {
    expect(contrastRatio(PALETTE.ink, PALETTE.surface)).toBeGreaterThanOrEqual(AAA_NORMAL);
  });

  it("blue text on surface meets AA (module accent labels)", () => {
    expect(contrastRatio(PALETTE.blue, PALETTE.surface)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("ink on coral danger accent meets AA (border + label pairing)", () => {
    expect(contrastRatio(PALETTE.ink, PALETTE.coral)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("surface text on code block ink meets AAA", () => {
    expect(contrastRatio(PALETTE.surface, PALETTE.ink)).toBeGreaterThanOrEqual(AAA_NORMAL);
  });

  it("coral-alert danger accent as a non-text border on surface meets 3:1 (RES-113 PR-2 slot-error)", () => {
    // slot-error carries the danger signal as a LEFT BORDER, not text — a non-text
    // UI boundary only needs WCAG 1.4.11's 3:1, which coral-alert clears (~3.22:1).
    expect(contrastRatio(PALETTE.coralAlert, PALETTE.surface)).toBeGreaterThanOrEqual(3);
  });

  it("coral-alert as body TEXT on surface is BELOW AA — why slot-error uses ink text, not coral text (RES-113 PR-2)", () => {
    // Guards against regressing back to `color: var(--coral-alert)` for the error
    // message: ~3.22:1 fails WCAG 1.4.3's 4.5:1. The message text is ink (AAA).
    expect(contrastRatio(PALETTE.coralAlert, PALETTE.surface)).toBeLessThan(AA_NORMAL);
  });

  it("dimmed journey-nav text (ink-faint) on the white sidebar meets AA (RES-113 PR-4)", () => {
    // The dimmed items are STILL OPERABLE (disclosure buttons), so we do not rely
    // on WCAG 1.4.3's inactive-component exemption — the text must pass on merit.
    expect(contrastRatio(PALETTE.dim, PALETTE.surface)).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});
