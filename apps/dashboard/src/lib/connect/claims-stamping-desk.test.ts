import { describe, expect, it } from "vitest";
import {
  dispatchDeskKey,
  emptyDeskTally,
  tallyStamp,
  tallyUndo,
  formatTallyLine,
  announceStamp,
  deskStampOptions,
  canStampSupported,
  describeUndo,
  type DeskStampRecord,
} from "./claims-stamping-desk";
import type { UnitEvidenceSummary } from "./evidence-dossier";

// ── Keymap dispatch ───────────────────────────────────────────────────────────

describe("dispatchDeskKey — navigation", () => {
  const live = { fromTextEntry: false, readonly: false };

  it("J / ArrowDown / ArrowRight advance the queue", () => {
    for (const key of ["j", "J", "ArrowDown", "ArrowRight"]) {
      expect(dispatchDeskKey(key, live)).toEqual({ kind: "advance" });
    }
  });

  it("K / ArrowUp / ArrowLeft retreat the queue", () => {
    for (const key of ["k", "K", "ArrowUp", "ArrowLeft"]) {
      expect(dispatchDeskKey(key, live)).toEqual({ kind: "retreat" });
    }
  });

  it("does not bind n/p to navigation (N is the note key)", () => {
    expect(dispatchDeskKey("p", live)).toBeNull();
    expect(dispatchDeskKey("P", live)).toBeNull();
    expect(dispatchDeskKey("n", live)).toEqual({ kind: "note" });
  });
});

describe("dispatchDeskKey — stamps", () => {
  const live = { fromTextEntry: false, readonly: false };

  it("S → ok (Supported), X → unsupported (Unsupported), W → weak", () => {
    expect(dispatchDeskKey("s", live)).toEqual({ kind: "stamp", status: "ok" });
    expect(dispatchDeskKey("S", live)).toEqual({ kind: "stamp", status: "ok" });
    expect(dispatchDeskKey("x", live)).toEqual({ kind: "stamp", status: "unsupported" });
    expect(dispatchDeskKey("X", live)).toEqual({ kind: "stamp", status: "unsupported" });
    expect(dispatchDeskKey("w", live)).toEqual({ kind: "stamp", status: "weak" });
  });

  it("E opens evidence, N opens the note field, Z undoes", () => {
    expect(dispatchDeskKey("e", live)).toEqual({ kind: "evidence" });
    expect(dispatchDeskKey("N", live)).toEqual({ kind: "note" });
    expect(dispatchDeskKey("z", live)).toEqual({ kind: "undo" });
  });

  it("? toggles the legend; Escape exits", () => {
    expect(dispatchDeskKey("?", live)).toEqual({ kind: "legend" });
    expect(dispatchDeskKey("Escape", live)).toEqual({ kind: "exit" });
    expect(dispatchDeskKey("Esc", live)).toEqual({ kind: "exit" });
  });

  it("ignores unknown keys", () => {
    expect(dispatchDeskKey("q", live)).toBeNull();
    expect(dispatchDeskKey("Enter", live)).toBeNull();
  });
});

describe("dispatchDeskKey — shortcut suppression in text entry (X10)", () => {
  const typing = { fromTextEntry: true, readonly: false };

  it("never hijacks typing — every shortcut letter is dropped while in a field", () => {
    for (const key of ["s", "S", "x", "w", "e", "n", "N", "z", "j", "k", "?"]) {
      expect(dispatchDeskKey(key, typing), `key ${key} must not fire from a text field`).toBeNull();
    }
  });

  it("two-step Escape — Escape in the note field BLURS the field, it does not exit the desk", () => {
    // Pressing Escape while typing must leave the field only (focus back to the
    // claim card), not tear down the whole desk and lose the operator's place.
    expect(dispatchDeskKey("Escape", typing)).toEqual({ kind: "blur" });
    expect(dispatchDeskKey("Esc", typing)).toEqual({ kind: "blur" });
  });
});

describe("dispatchDeskKey — two-step escape (outside vs inside the note field)", () => {
  it("Escape OUTSIDE a text field exits the desk", () => {
    const outside = { fromTextEntry: false, readonly: false };
    expect(dispatchDeskKey("Escape", outside)).toEqual({ kind: "exit" });
    expect(dispatchDeskKey("Esc", outside)).toEqual({ kind: "exit" });
  });

  it("Escape INSIDE a text field blurs (step 1); a second Escape — now outside — exits (step 2)", () => {
    expect(dispatchDeskKey("Escape", { fromTextEntry: true, readonly: false })).toEqual({
      kind: "blur",
    });
    // After blur, focus is no longer in the field, so the next Escape exits.
    expect(dispatchDeskKey("Escape", { fromTextEntry: false, readonly: false })).toEqual({
      kind: "exit",
    });
  });

  it("blur is honoured even read-only (it is a focus move, not a mutation)", () => {
    expect(dispatchDeskKey("Escape", { fromTextEntry: true, readonly: true })).toEqual({
      kind: "blur",
    });
  });
});

describe("dispatchDeskKey — read-only modes (mobile read-only + as-of)", () => {
  const ro = { fromTextEntry: false, readonly: true };

  it("drops every mutating command (stamp / note / undo)", () => {
    for (const key of ["s", "S", "x", "X", "w", "W", "n", "N", "z", "Z"]) {
      expect(dispatchDeskKey(key, ro), `mutating key ${key} must be dropped read-only`).toBeNull();
    }
  });

  it("keeps read-only navigation, evidence, legend and exit", () => {
    expect(dispatchDeskKey("j", ro)).toEqual({ kind: "advance" });
    expect(dispatchDeskKey("k", ro)).toEqual({ kind: "retreat" });
    expect(dispatchDeskKey("e", ro)).toEqual({ kind: "evidence" });
    expect(dispatchDeskKey("?", ro)).toEqual({ kind: "legend" });
    expect(dispatchDeskKey("Escape", ro)).toEqual({ kind: "exit" });
  });
});

// ── Session tally arithmetic ──────────────────────────────────────────────────

describe("session tally", () => {
  it("starts empty", () => {
    expect(emptyDeskTally()).toEqual({ reviewed: 0, supported: 0, weak: 0, unsupported: 0 });
  });

  it("counts stamps into the right bucket and bumps reviewed", () => {
    let t = emptyDeskTally();
    t = tallyStamp(t, "ok");
    t = tallyStamp(t, "ok");
    t = tallyStamp(t, "unsupported");
    t = tallyStamp(t, "weak");
    expect(t).toEqual({ reviewed: 4, supported: 2, weak: 1, unsupported: 1 });
  });

  it("undo decrements reviewed and the prior bucket, clamped at zero", () => {
    let t = tallyStamp(emptyDeskTally(), "ok");
    t = tallyUndo(t, "ok");
    expect(t).toEqual({ reviewed: 0, supported: 0, weak: 0, unsupported: 0 });
    // Over-undo never goes negative.
    t = tallyUndo(t, "ok");
    expect(t).toEqual({ reviewed: 0, supported: 0, weak: 0, unsupported: 0 });
  });

  it("formats the ledger line in mono-uppercase factual form", () => {
    const t = { reviewed: 14, supported: 11, weak: 0, unsupported: 3 };
    expect(formatTallyLine(t)).toBe("REVIEWED 14 · SUPPORTED 11 · WEAK 0 · UNSUPPORTED 3");
  });

  it("announces a stamp result with the remaining count", () => {
    expect(announceStamp("ok", 11)).toBe("Supported. 11 remaining.");
    expect(announceStamp("unsupported", 1)).toBe("Unsupported. 1 remaining.");
    expect(announceStamp("weak", 0)).toBe("Marked weak. Queue clear.");
  });
});

// ── Accept-guard surfaced state (claims ledger row 2) ─────────────────────────

const boundEvidence = {
  verificationState: "unverified",
  evidenceStatus: "bound",
} as Pick<UnitEvidenceSummary, "verificationState" | "evidenceStatus">;

const unboundEvidence = {
  verificationState: "unverified",
  evidenceStatus: "unbound",
} as Pick<UnitEvidenceSummary, "verificationState" | "evidenceStatus">;

const noEvidence = {
  verificationState: "contradicted",
  evidenceStatus: "no_evidence",
} as Pick<UnitEvidenceSummary, "verificationState" | "evidenceStatus">;

describe("deskStampOptions — accept-guard surfaced, never a silent no-op", () => {
  it("enables Supported only when the span is bound", () => {
    const opts = deskStampOptions(boundEvidence);
    const supported = opts.find((o) => o.status === "ok")!;
    expect(supported.enabled).toBe(true);
    expect(supported.reason).toBeNull();
    expect(canStampSupported(boundEvidence)).toBe(true);
  });

  it("disables Supported with a verbatim reason when unbound", () => {
    const opts = deskStampOptions(unboundEvidence);
    const supported = opts.find((o) => o.status === "ok")!;
    expect(supported.enabled).toBe(false);
    expect(supported.reason).toContain("unbound claim can never be marked supported");
    expect(canStampSupported(unboundEvidence)).toBe(false);
  });

  it("disables Supported when no evidence span exists", () => {
    const supported = deskStampOptions(noEvidence).find((o) => o.status === "ok")!;
    expect(supported.enabled).toBe(false);
    expect(supported.reason).toContain("can never be marked supported");
  });

  it("disables Supported for a pre-binding claim (null evidence)", () => {
    const supported = deskStampOptions(null).find((o) => o.status === "ok")!;
    expect(supported.enabled).toBe(false);
    expect(supported.reason).toContain("predates evidence binding");
  });

  it("always allows Weak and Unsupported — flagging down never needs a bound span", () => {
    for (const ev of [boundEvidence, unboundEvidence, noEvidence, null]) {
      const opts = deskStampOptions(ev);
      expect(opts.find((o) => o.status === "weak")!.enabled).toBe(true);
      expect(opts.find((o) => o.status === "unsupported")!.enabled).toBe(true);
    }
  });

  it("labels and keys match the desk legend", () => {
    const opts = deskStampOptions(boundEvidence);
    expect(opts.map((o) => `${o.key}:${o.label}`)).toEqual([
      "S:Supported",
      "W:Weak",
      "X:Unsupported",
    ]);
  });
});

// ── Undo semantics (honest re-stamp; no fabricated server unstamp) ────────────

describe("describeUndo — single-level, honest", () => {
  it("nothing to undo before any stamp", () => {
    expect(describeUndo(null)).toEqual({
      canUndo: false,
      reason: "Nothing stamped yet this session.",
    });
  });

  it("undo of a FIRST stamp (prior unchecked) is honestly disabled", () => {
    const last: DeskStampRecord = { unitId: "u1", toStatus: "ok", fromStatus: null };
    const u = describeUndo(last);
    expect(u.canUndo).toBe(false);
    if (!u.canUndo) {
      expect(u.reason).toContain("no prior verdict");
      expect(u.reason).toContain("no earlier state to restore");
    }
  });

  it("undo of a verdict CHANGE re-stamps to the prior verdict", () => {
    const last: DeskStampRecord = { unitId: "u2", toStatus: "unsupported", fromStatus: "weak" };
    const u = describeUndo(last);
    expect(u).toEqual({ canUndo: true, toStatus: "weak", unitId: "u2" });
  });
});
