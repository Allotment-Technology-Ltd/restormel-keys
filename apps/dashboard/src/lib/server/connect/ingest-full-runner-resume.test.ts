/**
 * Stage 1.6 durable runs — checkpointed resume in the full-mode runner.
 *
 * A run reclaimed after a stall is re-queued in place with progress.resume intact.
 * These tests pin the no-double-spend contract: sources counted in the checkpoint
 * are skipped entirely (no source re-registration, NO LLM stage re-runs), the
 * embed tail is skipped once checkpointed past 'storing', and a fresh run records
 * a monotonic checkpoint after every source (resume-stage.ts stage vocabulary).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectIngestJobRecord } from "$lib/server/neon";

vi.mock("$lib/server/neon", () => ({
  getConnectDomainPackById: vi.fn(),
  listConnectDomainPacksForWorkspace: vi.fn(),
  getConnectGraphTargetForWorkspace: vi.fn(),
  insertConnectGraphSourcePostgres: vi.fn(),
}));

vi.mock("$lib/server/connect/domain-pack-service", () => ({
  domainPackRecordToApi: vi.fn(),
}));

vi.mock("$lib/server/connect/graph-ingest-context", () => ({
  loadGraphIngestContext: vi.fn(async () => ({})),
}));

vi.mock("$lib/server/connect/surreal-graph-store", () => ({
  buildWorkspaceGraphStore: vi.fn(),
}));

vi.mock("$lib/server/connect/graph-writer", () => ({
  buildGraphWriter: vi.fn(),
}));

vi.mock("$lib/server/connect/graph-remediation-pass", () => ({
  runGraphRemediationPass: vi.fn(),
}));

const PACK = {
  slug: "generic",
  quality_preset: "starter",
  chunking: { max_chars: 1200, overlap_chars: 0 },
  ontology: { schema_mode: "open" },
  graph_schema: { source_table: "source" },
} as never;

function makeJob(args: {
  sources: unknown[];
  resume?: { sources_done: number; last_stage_completed: string | null };
}): ConnectIngestJobRecord {
  return {
    id: "job-1",
    workspaceId: "ws-1",
    projectId: null,
    status: "running",
    label: "Run",
    currentStage: null,
    currentAction: null,
    progress: args.resume
      ? { percent: 10, processed: 1, total: 7, resume: args.resume }
      : null,
    stages: [],
    sources: args.sources,
    stopAfterStage: null,
    pipelineProfileId: null,
    domainPackId: null,
    graphTargetId: null,
    error: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function makeWriter() {
  return {
    provider: "postgres" as const,
    writeSource: vi.fn(async () => "src-1"),
    writeUnitsAndRelations: vi.fn(async () => ({ units: [], relations: 0 })),
    setEvidence: vi.fn(async () => ({ persisted: 0, missed: 0 })),
    storeGroups: vi.fn(async () => ({ groups: 0 })),
    setVerificationStates: vi.fn(async () => ({ persisted: 0, missed: 0 })),
    recordJudgments: vi.fn(async () => ({ persisted: 0, missed: 0 })),
    setValidation: vi.fn(async () => 0),
    setEmbeddings: vi.fn(async () => 0),
  };
}

function makeReporter() {
  return {
    setAction: vi.fn(async () => {}),
    log: vi.fn(async () => {}),
    beginStage: vi.fn(async () => {}),
    completeStage: vi.fn(async () => {}),
    skipStage: vi.fn(async () => {}),
    tick: vi.fn(async () => {}),
    heartbeat: vi.fn(async () => {}),
    setResumeCheckpoint: vi.fn(
      async (_cp: { sources_done: number; last_stage_completed: string | null }) => {},
    ),
  };
}

function llmMustNotRun(label: string) {
  return vi.fn(async () => {
    throw new Error(`${label}: LLM generate must not be called`);
  });
}

function makeGenerates() {
  return {
    extraction: llmMustNotRun("extraction"),
    grouping: llmMustNotRun("grouping"),
    validation: llmMustNotRun("validation"),
    remediation: llmMustNotRun("remediation"),
  };
}

async function setupPack() {
  const neon = await import("$lib/server/neon");
  const packService = await import("$lib/server/connect/domain-pack-service");
  vi.mocked(neon.listConnectDomainPacksForWorkspace).mockResolvedValue([
    { slug: "generic" } as never,
  ]);
  vi.mocked(packService.domainPackRecordToApi).mockReturnValue(PACK);
}

describe("runFullExtraction checkpointed resume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips checkpointed sources entirely — no re-registration, no LLM re-spend", async () => {
    await setupPack();
    const writer = makeWriter();
    const reporter = makeReporter();
    const generates = makeGenerates();
    const embed = vi.fn(async (texts: string[]) => texts.map(() => [0.1]));
    const { runFullExtraction } = await import("./ingest-full-runner");

    const stats = await runFullExtraction({
      job: makeJob({
        // Source A completed every per-source LLM stage before the stall.
        sources: [{ title: "A", text: "alpha corpus text" }, { title: "B" }],
        resume: { sources_done: 1, last_stage_completed: "remediating" },
      }),
      writer: writer as never,
      generates: generates as never,
      embed: embed as never,
      reporter: reporter as never,
    });

    // Source A (with text!) is never reprocessed; only B is registered.
    expect(writer.writeSource).toHaveBeenCalledTimes(1);
    expect(writer.writeSource).toHaveBeenCalledWith(
      expect.objectContaining({ title: "B" }),
    );
    expect(generates.extraction).not.toHaveBeenCalled();
    expect(generates.validation).not.toHaveBeenCalled();
    expect(stats.resumedSourcesSkipped).toBe(1);
    // The checkpoint advances past the resumed source.
    expect(reporter.setResumeCheckpoint).toHaveBeenCalledWith({
      sources_done: 2,
      last_stage_completed: "remediating",
    });
    // Final tail checkpoint after embed/finalize.
    expect(reporter.setResumeCheckpoint).toHaveBeenLastCalledWith({
      sources_done: 2,
      last_stage_completed: "storing",
    });
  });

  it("skips the embed tail when the checkpoint is already past 'storing'", async () => {
    await setupPack();
    const writer = makeWriter();
    const reporter = makeReporter();
    const embed = vi.fn(async (texts: string[]) => texts.map(() => [0.1]));
    const { runFullExtraction } = await import("./ingest-full-runner");

    const stats = await runFullExtraction({
      job: makeJob({
        sources: [{ title: "A", text: "alpha" }, { title: "B", text: "beta" }],
        resume: { sources_done: 2, last_stage_completed: "storing" },
      }),
      writer: writer as never,
      generates: makeGenerates() as never,
      embed: embed as never,
      reporter: reporter as never,
    });

    expect(writer.writeSource).not.toHaveBeenCalled();
    expect(embed).not.toHaveBeenCalled();
    expect(reporter.skipStage).toHaveBeenCalledWith(
      "embedding",
      expect.stringContaining("Checkpoint"),
    );
    expect(stats.units).toBe(0);
    expect(stats.resumedSourcesSkipped).toBe(2);
  });

  it("a fresh run records a monotonic checkpoint after every source", async () => {
    await setupPack();
    const writer = makeWriter();
    const reporter = makeReporter();
    const { runFullExtraction } = await import("./ingest-full-runner");

    await runFullExtraction({
      job: makeJob({ sources: [{ title: "A" }, { title: "B" }] }),
      writer: writer as never,
      generates: makeGenerates() as never,
      reporter: reporter as never,
    });

    expect(writer.writeSource).toHaveBeenCalledTimes(2);
    const checkpoints = reporter.setResumeCheckpoint.mock.calls.map((c) => c[0]);
    expect(checkpoints).toEqual([
      { sources_done: 1, last_stage_completed: "remediating" },
      { sources_done: 2, last_stage_completed: "remediating" },
      { sources_done: 2, last_stage_completed: "storing" },
    ]);
  });
});
