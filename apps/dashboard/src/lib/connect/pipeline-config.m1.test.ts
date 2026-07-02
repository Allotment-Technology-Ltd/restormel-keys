/**
 * RES-113 · PR-5 — M1 "Build" journey model (supersedes the PR-C rung reskin).
 *
 * These cover the flag-gated presentation helpers only. They assert the ONE
 * state-derived Build panel is a pure function of the real signals
 * `PipelineWizardProgress` carries (plan §3.2 — no two asks can co-exist), the
 * conditional plain-language eyebrow (copy pack Appendix A-1), and the honest
 * rate-limit signal helpers (REC-ADR-016).
 */
import { describe, it, expect } from "vitest";
import {
  M1_BUILD_PANEL_COPY,
  M1_BUILD_TOTAL_STEPS,
  M1_RATE_LIMIT_BANNER,
  m1BuildEyebrow,
  m1LaunchMetaLine,
  resolveM1BuildPanel,
  isM1RateLimitedStatus,
  isM1StageBackingOff,
  isM1StageRateLimited,
} from "./pipeline-config";

describe("resolveM1BuildPanel — one state-derived panel (plan §3.2)", () => {
  it("asks for the provider key first when none exists", () => {
    expect(resolveM1BuildPanel({ hasProviderKey: false, selectedDocumentCount: 0 })).toBe("provider");
    // Provider outranks everything — even with documents already present.
    expect(resolveM1BuildPanel({ hasProviderKey: false, selectedDocumentCount: 5 })).toBe("provider");
  });

  it("asks for documents once keyed but nothing is selected", () => {
    expect(resolveM1BuildPanel({ hasProviderKey: true, selectedDocumentCount: 0 })).toBe("sources");
  });

  it("shows the launch panel once keyed with at least one document", () => {
    expect(resolveM1BuildPanel({ hasProviderKey: true, selectedDocumentCount: 1 })).toBe("launch");
    expect(resolveM1BuildPanel({ hasProviderKey: true, selectedDocumentCount: 412 })).toBe("launch");
  });

  it("structural guarantee: exactly one panel for every signal combination", () => {
    for (const hasProviderKey of [true, false]) {
      for (const selectedDocumentCount of [0, 1, 7]) {
        const panel = resolveM1BuildPanel({ hasProviderKey, selectedDocumentCount });
        expect(["provider", "sources", "launch"]).toContain(panel);
      }
    }
  });
});

describe("m1BuildEyebrow — conditional orientation (copy pack Appendix A-1)", () => {
  it("renders plain STEP N OF 4 on the two ask panels only", () => {
    expect(m1BuildEyebrow("provider")).toBe("STEP 1 OF 4");
    expect(m1BuildEyebrow("sources")).toBe("STEP 2 OF 4");
  });

  it("is suppressed on the launch panel — the CTA owns the frame", () => {
    expect(m1BuildEyebrow("launch")).toBeNull();
  });

  it("stays honest about the four real steps (build and ask never render an eyebrow)", () => {
    expect(M1_BUILD_TOTAL_STEPS).toBe(4);
  });
});

describe("M1 copy-pack strings (verbatim — a string change starts in the copy pack)", () => {
  it("provider ask (copy pack §2.1)", () => {
    expect(M1_BUILD_PANEL_COPY.provider.headline).toBe("Add an AI provider key");
    expect(M1_BUILD_PANEL_COPY.provider.modelsLine).toBe(
      "Recommended models are pre-chosen. Change them under Advanced.",
    );
    expect(M1_BUILD_PANEL_COPY.provider.advancedLabel).toBe("Advanced — choose a model per stage");
  });

  it("sources ask (copy pack §2.2)", () => {
    expect(M1_BUILD_PANEL_COPY.sources.headline).toBe("Add your documents");
  });

  it("launch panel (copy pack §2.3) — CTA keeps the canonical Ingest noun with the arrow", () => {
    expect(M1_BUILD_PANEL_COPY.launch.headlineFirstRun).toBe("Ready to build");
    expect(M1_BUILD_PANEL_COPY.launch.headlineReRun).toBe("Rebuild your graph");
    expect(M1_BUILD_PANEL_COPY.launch.outcome).toBe("Turn your documents into cited answers.");
    expect(M1_BUILD_PANEL_COPY.launch.cta).toBe("Run ingest →");
  });

  it("launch meta line ships singular and plural variants (§0 i18n rule)", () => {
    expect(m1LaunchMetaLine(1)).toBe("1 document ready.");
    expect(m1LaunchMetaLine(3)).toBe("3 documents ready.");
  });
});

describe("M1 rate-limit state (presentational, honest)", () => {
  it("recognises transient backoff statuses an engine may emit", () => {
    expect(isM1RateLimitedStatus("rate_limited")).toBe(true);
    expect(isM1RateLimitedStatus("rate-limited")).toBe(true);
    expect(isM1RateLimitedStatus("throttled")).toBe(true);
    expect(isM1RateLimitedStatus("backoff")).toBe(true);
  });

  it("does NOT fire for normal running / done statuses (no fabricated state)", () => {
    expect(isM1RateLimitedStatus("running")).toBe(false);
    expect(isM1RateLimitedStatus("completed")).toBe(false);
    expect(isM1RateLimitedStatus(null)).toBe(false);
    expect(isM1RateLimitedStatus(undefined)).toBe(false);
  });

  it("carries the copy-pack §2.4 no-action-needed banner copy", () => {
    expect(M1_RATE_LIMIT_BANNER.body).toBe(
      "The AI provider asked us to slow down. We're pausing and retrying automatically — nothing for you to do.",
    );
  });
});

describe("M1 rate-limit from the REAL structured backoff signal (PR-I)", () => {
  it("lights from a rate-limit-class structured backoff field", () => {
    expect(isM1StageBackingOff({ status: "running", backoff: { reason_code: "rate_limit" } })).toBe(
      true,
    );
    expect(isM1StageBackingOff({ status: "running", backoff: { reason_code: "overloaded" } })).toBe(
      true,
    );
  });

  it("does NOT light for transient-but-not-throttle reasons (honest labelling)", () => {
    expect(isM1StageBackingOff({ status: "running", backoff: { reason_code: "server_error" } })).toBe(
      false,
    );
    expect(isM1StageBackingOff({ status: "running", backoff: { reason_code: "timeout" } })).toBe(
      false,
    );
    expect(isM1StageBackingOff({ status: "running" })).toBe(false);
    expect(isM1StageBackingOff(null)).toBe(false);
  });

  it("combined helper accepts EITHER the structured field or the legacy status string", () => {
    expect(isM1StageRateLimited({ backoff: { reason_code: "rate_limit" } })).toBe(true);
    expect(isM1StageRateLimited({ status: "rate_limited" })).toBe(true);
    expect(isM1StageRateLimited({ status: "running" })).toBe(false);
    expect(isM1StageRateLimited({ status: "running", backoff: { reason_code: "timeout" } })).toBe(
      false,
    );
  });
});
