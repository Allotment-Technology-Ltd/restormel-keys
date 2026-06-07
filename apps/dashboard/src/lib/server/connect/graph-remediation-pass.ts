/**
 * Shared validate → remediate → re-validate → re-embed pass for ingest and graph jobs.
 */
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import {
  remediateUnits,
  resolveQualityPreset,
  validateUnits,
  type ExtractionGenerate,
  type EmbeddingPort,
  type UnitValidation,
} from "@restormel/connect-core";
import {
  buildRemediationBatchInputs,
  remediateUnitsBatch,
  remapRemediationBatchResults,
  finalizeRemediationCoverage,
  type RemediationResult,
} from "@restormel/connect-core/ingest/remediation";
import type { GraphWriter } from "$lib/server/connect/graph-writer";
import type { ConnectIngestProgressReporter } from "$lib/server/connect-ingest-progress";
export type ValidationResultRef = { ref: string; status: string; note?: string | null };

const ROUTE_EXHAUSTED_HINT =
  "Check remediation route has a fallback step, or inspect the upstream model error above.";

function remediationErrorHint(message: string): string {
  if (/no further steps|route fallback exhausted/i.test(message)) {
    return `${message} — ${ROUTE_EXHAUSTED_HINT}`;
  }
  return message;
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
}): Promise<{
  repaired: number;
  dropped: number;
  embedded: number;
  repairedUnitIds: string[];
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
    return { repaired: 0, dropped: 0, embedded: 0, repairedUnitIds: [], remediationFailed: false };
  }

  await reporter?.setGraphRepair({ phase: "remediating" });
  await reporter?.beginStage("remediating", "Remediating weak units", Math.max(1, weak.length));

  let repaired = 0;
  let dropped = 0;
  let embedded = 0;
  const repairedUnitIds: string[] = [];

  try {
    const batches = buildRemediationBatchInputs(weak);
    const useBatchLoop = Boolean(reporter) && batches.length > 0;
    let fixes: RemediationResult[];

    if (useBatchLoop) {
      await reporter!.setGraphRepair({ batches_total: batches.length, batches_done: 0 });
      const sourceHint = args.sourceLabel ? ` (${args.sourceLabel})` : "";
      await reporter!.log(
        "REMEDIATE",
        `Calling remediation model — ${weak.length} weak idea(s) in ${batches.length} batch(es)${sourceHint} (may take several minutes)`,
      );
      const merged: RemediationResult[] = [];
      for (let bi = 0; bi < batches.length; bi++) {
        const { batchUnits, refToUnitId } = batches[bi]!;
        await reporter!.tick(
          "remediating",
          `Remediating · batch ${bi + 1}/${batches.length} · ${batchUnits.length} idea(s)${sourceHint}`,
        );
        const parsed = await remediateUnitsBatch({
          units: batchUnits,
          sourceText,
          pack,
          generate: args.remediationGenerate,
          qualityPreset: preset,
        });
        merged.push(...remapRemediationBatchResults(parsed, refToUnitId));
        await reporter!.setGraphRepair({ batches_done: bi + 1 });
      }
      fixes = finalizeRemediationCoverage(weak, merged);
    } else {
      fixes = await remediateUnits({
        units: weak,
        sourceText,
        pack,
        generate: args.remediationGenerate,
        qualityPreset: preset,
      });
    }

    const repairedIds: { id: string; text: string }[] = [];
    for (let fi = 0; fi < fixes.length; fi++) {
      const fix = fixes[fi]!;
      await reporter?.tick("remediating", `Remediation ${fi + 1}/${fixes.length}`);
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
        dropped += 1;
      }
      if (reporter && effect !== "keep") {
        const gr = reporter.getGraphRepair();
        await reporter.setGraphRepair({
          phase: "remediating",
          repaired: (gr?.repaired ?? 0) + (effect === "repair" ? 1 : 0),
          dropped: (gr?.dropped ?? 0) + (effect === "exclude" ? 1 : 0),
        });
      }
    }

    if (repairedIds.length > 0) {
      const revalidated: UnitValidation[] = await validateUnits({
        units: repairedIds.map((u) => ({ ref: u.id, text: u.text })),
        sourceText,
        pack,
        generate: args.validationGenerate,
        qualityPreset: preset,
      });
      await writer.setValidation(
        revalidated.map((r) => ({ unitId: r.ref, status: r.status, note: r.note ?? null })),
      );

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
    return { repaired, dropped, embedded, repairedUnitIds, remediationFailed: false };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Remediation failed";
    const fullDetail = remediationErrorHint(detail);
    await reporter?.log("REMEDIATE", `Remediation failed — ${fullDetail}`);
    await reporter?.setGraphRepair({ last_error: fullDetail });
    await reporter?.skipStage("remediating", `${detail.slice(0, 140)} — continuing`);
    return { repaired, dropped, embedded, repairedUnitIds, remediationFailed: true };
  }
}
