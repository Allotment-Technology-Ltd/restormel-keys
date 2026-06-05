import { describe, expect, it } from "vitest";
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import {
  effectiveStopAfterStage,
  readMaxChunksForPreset,
  resolveQualityPreset,
} from "./quality-preset.js";

const basePack = {
  id: "p1",
  workspace_id: "w1",
  slug: "generic",
  title: "Generic",
  ontology: { unit_noun: "statement", group_noun: "topic", domains: [] },
  prompts: {},
  graph_schema: {
    source_table: "source",
    passage_table: "passage",
    unit_table: "statement",
    group_table: "topic",
    part_of_edge: "part_of",
    relation_edges: [],
  },
  passage_profile: { marker_lexicon: [], min_passage_chars: 400, max_passage_chars: 6000 },
  embedding: { model: "voyage-3", dimensions: 1024 },
  is_builtin: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
} satisfies ConnectDomainPack;

describe("resolveQualityPreset", () => {
  it("defaults to production when pack omits preset", () => {
    const cfg = resolveQualityPreset(basePack);
    expect(cfg.preset).toBe("production");
    expect(cfg.maxChunks).toBe(32);
    expect(cfg.minStopAfterStage).toBe("remediating");
  });

  it("honours starter opt-down", () => {
    const cfg = resolveQualityPreset({ ...basePack, quality_preset: "starter" });
    expect(cfg.preset).toBe("starter");
    expect(cfg.maxChunks).toBe(8);
    expect(cfg.minStopAfterStage).toBeNull();
  });
});

describe("readMaxChunksForPreset", () => {
  it("caps env override by preset ceiling", () => {
    const prod = resolveQualityPreset(basePack);
    expect(readMaxChunksForPreset(prod, 500)).toBe(100);
    const starter = resolveQualityPreset({ ...basePack, quality_preset: "starter" });
    expect(readMaxChunksForPreset(starter, 500)).toBe(24);
  });
});

describe("effectiveStopAfterStage", () => {
  it("raises early stop to remediate for production", () => {
    const prod = resolveQualityPreset(basePack);
    expect(effectiveStopAfterStage("extracting", prod)).toBe("remediating");
    expect(effectiveStopAfterStage("storing", prod)).toBe("storing");
  });

  it("allows early stop for starter", () => {
    const starter = resolveQualityPreset({ ...basePack, quality_preset: "starter" });
    expect(effectiveStopAfterStage("extracting", starter)).toBe("extracting");
  });
});
