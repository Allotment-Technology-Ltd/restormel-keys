/**
 * Shared stage vocabulary (copy pack §0) — the one stage table used by the
 * Home run line (PR-3) and the Build tracker (PR-5).
 *
 * The honesty contract under test (REC-ADR-016 / copy pack §0): mapped stages
 * render their copy-pack names verbatim; ANY other value — internal stages,
 * unknown strings, null — renders "Getting ready", never the raw key.
 */
import { describe, expect, it } from "vitest";
import { PIPELINE_STAGES } from "$lib/connect/pipeline-config";
import {
  JOURNEY_STAGE_FALLBACK_DESCRIPTION,
  JOURNEY_STAGE_FALLBACK_NAME,
  journeyStageDescription,
  journeyStageName,
} from "$lib/connect/stage-vocabulary";

describe("journeyStageName — copy-pack stage table", () => {
  it("maps the five copy-pack stages verbatim", () => {
    expect(journeyStageName("extracting")).toBe("Reading your documents");
    expect(journeyStageName("relating")).toBe("Connecting the facts");
    expect(journeyStageName("grouping")).toBe("Organising topics");
    expect(journeyStageName("embedding")).toBe("Making it searchable");
    expect(journeyStageName("validating")).toBe("Checking against sources");
  });

  it("falls back to 'Getting ready' for internal stages (remediating / storing)", () => {
    expect(journeyStageName("remediating")).toBe(JOURNEY_STAGE_FALLBACK_NAME);
    expect(journeyStageName("storing")).toBe(JOURNEY_STAGE_FALLBACK_NAME);
  });

  it("falls back for unknown / null / empty stages — engineering names never leak", () => {
    expect(journeyStageName("vector_upsert")).toBe("Getting ready");
    expect(journeyStageName(null)).toBe("Getting ready");
    expect(journeyStageName(undefined)).toBe("Getting ready");
    expect(journeyStageName("")).toBe("Getting ready");
  });

  it("covers every real PIPELINE_STAGES key with either a pack name or the fallback (no raw key ever)", () => {
    for (const stage of PIPELINE_STAGES) {
      const name = journeyStageName(stage);
      expect(name).not.toBe(stage);
      expect(name.length).toBeGreaterThan(0);
    }
  });
});

describe("journeyStageDescription — Build tracker one-liners (PR-5 consumer)", () => {
  it("maps the five copy-pack stages verbatim", () => {
    expect(journeyStageDescription("extracting")).toBe("Pulling the facts out of each page.");
    expect(journeyStageDescription("validating")).toBe(
      "Making sure each fact matches the document it came from.",
    );
  });

  it("falls back to 'Setting things up.' for anything unmapped", () => {
    expect(journeyStageDescription("storing")).toBe(JOURNEY_STAGE_FALLBACK_DESCRIPTION);
    expect(journeyStageDescription(null)).toBe("Setting things up.");
  });
});
