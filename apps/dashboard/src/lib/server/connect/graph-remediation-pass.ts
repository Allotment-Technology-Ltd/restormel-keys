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
}): Promise<{
  repaired: number;
  dropped: number;
  embedded: number;
  repairedUnitIds: string[];
  remediationFailed: boolean;
}> {
  const { validationResults, textById, sourceText, pack, writer, reporter } = args;
  const preset = resolveQualityPreset(pack).preset;

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
      if (fix.action === "repair" && fix.text) {
        await writer.updateUnitText(fix.ref, fix.text);
        textById.set(fix.ref, fix.text);
        repairedIds.push({ id: fix.ref, text: fix.text });
        repairedUnitIds.push(fix.ref);
        repaired += 1;
      } else if (fix.action === "drop") {
        await writer.deleteUnit(fix.ref);
        textById.delete(fix.ref);
        dropped += 1;
      }
      if (reporter && (fix.action === "repair" || fix.action === "drop")) {
        const gr = reporter.getGraphRepair();
        await reporter.setGraphRepair({
          phase: "remediating",
          repaired: (gr?.repaired ?? 0) + (fix.action === "repair" ? 1 : 0),
          dropped: (gr?.dropped ?? 0) + (fix.action === "drop" ? 1 : 0),
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
    await reporter?.completeStage("remediating", `${repaired} repaired, ${dropped} dropped`);
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
