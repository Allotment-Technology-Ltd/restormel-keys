/**
 * Shared validate → remediate → re-validate → re-embed pass for ingest and graph jobs.
 */
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import {
  askBatchWithCoverageRetry,
  judgeEntailment,
  remediateUnits,
  resolveQualityPreset,
  validateUnits,
  type ClaimVerificationState,
  type CoverageShortfallHandler,
  type EvidenceBinding,
  type ExtractionGenerate,
  type EmbeddingPort,
  type UnitValidation,
} from "@restormel/connect-core";
import { buildLayer2StateRows } from "$lib/server/connect/evidence-persist";
import {
  buildRemediationBatchInputs,
  remediateUnitsBatchDetailed,
  remapRemediationBatchResults,
  finalizeRemediationCoverage,
  type RemediationInput,
  type RemediationResult,
} from "@restormel/connect-core/ingest/remediation";
import type { GraphWriter } from "$lib/server/connect/graph-writer";
import type { ConnectIngestProgressReporter } from "$lib/server/connect-ingest-progress";
export type ValidationResultRef = { ref: string; status: string; note?: string | null };

const REMEDIATE_HEARTBEAT_MS = 20_000;

/** Re-persist progress every ~20s so a slow remediation batch keeps the UI alive. */
function startRemediateHeartbeat(
  reporter: ConnectIngestProgressReporter,
  getMessage: () => string,
): () => void {
  const id = setInterval(() => {
    void reporter.heartbeat(getMessage());
  }, REMEDIATE_HEARTBEAT_MS);
  return () => clearInterval(id);
}

const ROUTE_EXHAUSTED_HINT =
  "Check remediation route has a fallback step, or inspect the upstream model error above.";

function remediationErrorHint(message: string): string {
  if (/no further steps|route fallback exhausted/i.test(message)) {
    return `${message} — ${ROUTE_EXHAUSTED_HINT}`;
  }
  return message;
}

/** H1: log a verdict-batch coverage shortfall (the batch is re-asked once by the callee). */
function shortfallLogger(
  reporter: ConnectIngestProgressReporter | undefined,
  tag: "VALIDATE" | "REMEDIATE",
  what: string,
): CoverageShortfallHandler {
  return async ({ omittedRefs, parseFailed }) => {
    await reporter?.log(
      tag,
      `Coverage shortfall — ${what} omitted ${omittedRefs.length} verdict(s)` +
        (parseFailed ? " (response unparseable)" : "") +
        " — re-asking once",
    );
  };
}

const DEFAULT_REMEDIATION_THRESHOLD = {
  conservative: 0.8,
  balanced: 0.6,
  strict: 0.4,
} as const;

type RemediationEffect = "repair" | "exclude" | "keep";

/**
 * Resolve what to actually do with a flagged idea, given the model's suggested fix,
 * the idea's current verdict, and the operator's strictness level + confidence threshold.
 */
function resolveRemediationEffect(
  fix: { action: "repair" | "drop" | "keep"; text?: string; confidence?: number },
  status: string | null | undefined,
  level: "conservative" | "balanced" | "strict",
  threshold: number,
): RemediationEffect {
  const confident = (fix.confidence ?? 1) >= threshold;
  if (fix.action === "repair" && fix.text && confident) return "repair";
  // Strict sweeps every still-unsupported idea that couldn't be repaired.
  if (level === "strict" && (status ?? "").toLowerCase() === "unsupported") return "exclude";
  if (fix.action === "drop" && confident && level !== "conservative") return "exclude";
  return "keep";
}

export async function runGraphRemediationPass(args: {
  validationResults: ValidationResultRef[];
  textById: Map<string, string>;
  sourceText: string;
  pack: ConnectDomainPack;
  writer: GraphWriter;
  validationGenerate: ExtractionGenerate;
  remediationGenerate: ExtractionGenerate;
  embed?: EmbeddingPort;
  reporter?: ConnectIngestProgressReporter;
  sourceLabel?: string;
  /**
   * Action policy. Conservative: repair only, never remove. Balanced: repair +
   * soft-exclude ideas the model drops. Strict: repair + soft-exclude every idea
   * still unsupported. `threshold` is the min model confidence (0-1) to act;
   * defaults per level when omitted.
   */
  strictness?: { level: "conservative" | "balanced" | "strict"; threshold?: number };
  /**
   * EBV Layer 2 (Stage 1.0d): when set, repaired text is re-judged span-scoped against
   * its bound evidence before it can return to supported — repair re-binds, it never
   * re-enters the graph on the repair model's say-so alone.
   */
  ebv?: {
    bindingByUnitId: Map<string, EvidenceBinding>;
    kSamples: number;
    modelId: string | null;
  };
}): Promise<{
  repaired: number;
  dropped: number;
  embedded: number;
  repairedUnitIds: string[];
  /** Units soft-excluded by this pass (reversible; hidden from retrieval). */
  droppedUnitIds: string[];
  /** Final EBV states of repaired units after the span-scoped re-judge (ebv mode only). */
  rejudgedStates: { unitId: string; state: ClaimVerificationState }[];
  remediationFailed: boolean;
}> {
  const { validationResults, textById, sourceText, pack, writer, reporter } = args;
  const preset = resolveQualityPreset(pack).preset;

  const level = args.strictness?.level ?? "balanced";
  const threshold = args.strictness?.threshold ?? DEFAULT_REMEDIATION_THRESHOLD[level];
  const statusByRef = new Map(validationResults.map((r) => [r.ref, r.status]));

  const weak = validationResults
    .filter((r) => r.status === "weak" || r.status === "unsupported")
    .map((r) => ({ ref: r.ref, text: textById.get(r.ref) ?? "", note: r.note ?? undefined }))
    .filter((u) => u.text);

  if (weak.length === 0) {
    return {
      repaired: 0,
      dropped: 0,
      embedded: 0,
      repairedUnitIds: [],
      droppedUnitIds: [],
      rejudgedStates: [],
      remediationFailed: false,
    };
  }

  // Register this source's weak units as remediation work so the headline progress
  // bar accounts for the remediation pass (not just validation) and keeps moving.
  const grAtStart = reporter?.getGraphRepair();
  await reporter?.setGraphRepair({
    phase: "remediating",
    remediation_units_total: (grAtStart?.remediation_units_total ?? 0) + weak.length,
  });
  await reporter?.beginStage("remediating", "Remediating weak units", Math.max(1, weak.length));

  let repaired = 0;
  let dropped = 0;
  let embedded = 0;
  const repairedUnitIds: string[] = [];
  const droppedUnitIds: string[] = [];
  const rejudgedStates: { unitId: string; state: ClaimVerificationState }[] = [];

  try {
    const batches = buildRemediationBatchInputs(weak);
    const useBatchLoop = Boolean(reporter) && batches.length > 0;
    let fixes: RemediationResult[];

    if (useBatchLoop) {
      const sourceHint = args.sourceLabel ? ` (${args.sourceLabel})` : "";
      await reporter!.setGraphRepair({ batches_total: batches.length, batches_done: 0 });
      await reporter!.log(
        "REMEDIATE",
        `Calling remediation model — ${weak.length} weak idea(s) in ${batches.length} batch(es)${sourceHint} (may take several minutes)`,
      );
      const remDoneBase = reporter!.getGraphRepair()?.remediation_units_done ?? 0;
      const merged: RemediationResult[] = [];
      let doneInSource = 0;
      const stopHeartbeat = startRemediateHeartbeat(
        reporter!,
        () => `Still remediating${sourceHint} — ${doneInSource}/${weak.length} idea(s) processed`,
      );
      try {
        for (let bi = 0; bi < batches.length; bi++) {
          const { batchUnits, refToUnitId } = batches[bi]!;
          // H1: a lost batch (unparseable/truncated response or omitted refs) is
          // logged as a coverage shortfall and re-asked exactly once; refs still
          // missing then fall through to the fail-safe "drop" coverage finalize.
          const asked = await askBatchWithCoverageRetry<RemediationInput, RemediationResult>({
            inputs: batchUnits,
            ask: (units) =>
              remediateUnitsBatchDetailed({
                units,
                sourceText,
                pack,
                generate: args.remediationGenerate,
                qualityPreset: preset,
              }),
            onShortfall: async ({ omittedRefs, parseFailed }) => {
              await reporter?.log(
                "REMEDIATE",
                `Coverage shortfall in batch ${bi + 1}/${batches.length} — ` +
                  `${omittedRefs.length}/${batchUnits.length} verdict(s) missing` +
                  (parseFailed ? " (response unparseable)" : "") +
                  " — re-asking once",
              );
            },
          });
          merged.push(...remapRemediationBatchResults(asked.results, refToUnitId));
          doneInSource += batchUnits.length;
          // Tick AFTER the slow LLM call, paced by real units — so the stage
          // progress + ETA track the model passes, not the instant apply loop.
          await reporter!.tick(
            "remediating",
            `Remediated batch ${bi + 1}/${batches.length} · ${doneInSource}/${weak.length} idea(s)${sourceHint}`,
            batchUnits.length,
            {
              batches_done: bi + 1,
              remediation_units_done: remDoneBase + doneInSource,
            },
          );
        }
      } finally {
        stopHeartbeat();
      }
      fixes = finalizeRemediationCoverage(weak, merged);
    } else {
      fixes = await remediateUnits({
        units: weak,
        sourceText,
        pack,
        generate: args.remediationGenerate,
        qualityPreset: preset,
        onCoverageShortfall: shortfallLogger(reporter, "REMEDIATE", "remediation model"),
      });
    }

    // Apply the model's decisions. This loop is fast (writes only) — it must NOT
    // tick the stage, or the bar would race to 100% in milliseconds and collapse
    // the ETA the moment the slow model passes finished.
    const repairedIds: { id: string; text: string }[] = [];
    for (const fix of fixes) {
      const effect = resolveRemediationEffect(fix, statusByRef.get(fix.ref), level, threshold);
      if (effect === "repair" && fix.text) {
        await writer.updateUnitText(fix.ref, fix.text);
        textById.set(fix.ref, fix.text);
        repairedIds.push({ id: fix.ref, text: fix.text });
        repairedUnitIds.push(fix.ref);
        repaired += 1;
      } else if (effect === "exclude") {
        // Soft-exclude: mark removed, keep the record (reversible) — never hard-delete.
        await writer.excludeUnit(
          fix.ref,
          `Remediation (${level}): no basis in source — soft-excluded from retrieval.`,
        );
        textById.delete(fix.ref);
        droppedUnitIds.push(fix.ref);
        dropped += 1;
      }
    }
    if (reporter && (repaired > 0 || dropped > 0)) {
      const gr = reporter.getGraphRepair();
      await reporter.setGraphRepair({
        phase: "remediating",
        repaired: (gr?.repaired ?? 0) + repaired,
        dropped: (gr?.dropped ?? 0) + dropped,
      });
    }

    if (repairedIds.length > 0) {
      const revalidated: UnitValidation[] = await validateUnits({
        units: repairedIds.map((u) => ({ ref: u.id, text: u.text })),
        sourceText,
        pack,
        generate: args.validationGenerate,
        qualityPreset: preset,
        onCoverageShortfall: shortfallLogger(reporter, "REMEDIATE", "re-validation"),
      });
      await writer.setValidation(
        revalidated.map((r) => ({ unitId: r.ref, status: r.status, note: r.note ?? null })),
      );

      if (args.ebv) {
        // EBV re-bind: the repaired claim must be entailed by its ORIGINAL bound span
        // before its verification state can say supported again. A repair the evidence
        // no longer covers lands in review (unverified), not back in the graph as ok.
        const { results, meta } = await judgeEntailment({
          inputs: repairedIds.map((u) => {
            const b = args.ebv!.bindingByUnitId.get(u.id);
            return {
              ref: u.id,
              claim: u.text,
              spans: b?.status === "bound" ? [b.span.quote] : [],
            };
          }),
          generate: args.validationGenerate,
          kSamples: args.ebv.kSamples,
          modelId: args.ebv.modelId,
          onCoverageShortfall: shortfallLogger(reporter, "REMEDIATE", "re-judge"),
        });
        const l2 = buildLayer2StateRows({
          results,
          bindingByUnitId: args.ebv.bindingByUnitId,
          meta,
        });
        await writer.setVerificationStates(l2.states);
        await writer.recordJudgments(l2.judgments);
        rejudgedStates.push(...l2.states.map((s) => ({ unitId: s.unitId, state: s.state })));
        await reporter?.log(
          "REMEDIATE",
          `Re-judged ${results.length} repaired claim(s) against bound evidence: ` +
            `${l2.counts.supported} supported, ${l2.counts.inferred} inferred, ${l2.counts.unverified} unverified`,
        );
      }

      if (args.embed) {
        const vectors = await args.embed(repairedIds.map((u) => u.text));
        const pairs = repairedIds
          .map((u, i) => ({ unitId: u.id, vector: vectors[i] }))
          .filter((p) => Array.isArray(p.vector) && p.vector.length > 0);
        if (pairs.length > 0) {
          embedded = await writer.setEmbeddings(pairs);
        }
      }
    }

    await reporter?.setGraphRepair({ phase: "remediating" });
    await reporter?.completeStage("remediating", `${repaired} repaired, ${dropped} excluded`);
    return {
      repaired,
      dropped,
      embedded,
      repairedUnitIds,
      droppedUnitIds,
      rejudgedStates,
      remediationFailed: false,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Remediation failed";
    const fullDetail = remediationErrorHint(detail);
    await reporter?.log("REMEDIATE", `Remediation failed — ${fullDetail}`);
    await reporter?.setGraphRepair({ last_error: fullDetail });
    await reporter?.skipStage("remediating", `${detail.slice(0, 140)} — continuing`);
    return {
      repaired,
      dropped,
      embedded,
      repairedUnitIds,
      droppedUnitIds,
      rejudgedStates,
      remediationFailed: true,
    };
  }
}
