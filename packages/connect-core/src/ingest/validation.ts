/**
 * Validation stage: assess each extracted unit against its source text for
 * faithfulness. Pack-driven (uses the pack's prompt override if present). DI generate.
 * Status: ok | weak | unsupported.
 */
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import type { ExtractionGenerate } from "./extract.js";
import type { ConnectQualityPreset } from "./quality-preset.js";
import { composeStageSystemPrompt, type GraphIngestContext } from "./prompt-compose.js";
import {
  askBatchWithCoverageRetry,
  type CoverageShortfallHandler,
  type ParsedBatchResponse,
} from "./batch-coverage.js";

export type UnitValidationStatus = "ok" | "weak" | "unsupported";

export interface ValidationInput {
  ref: string;
  text: string;
}

export interface UnitValidation {
  ref: string;
  status: UnitValidationStatus;
  note?: string;
}

/** Short refs per batch so the model echoes ids reliably (not Surreal record ids). */
export const VALIDATION_BATCH_SIZE = 25;

function readValidationBatchSize(): number {
  const raw = Number(process.env.CONNECT_VALIDATION_BATCH_SIZE ?? VALIDATION_BATCH_SIZE);
  if (!Number.isFinite(raw)) return VALIDATION_BATCH_SIZE;
  return Math.min(Math.max(Math.floor(raw), 5), 50);
}

/** Cap on whole-source context passed to the judge (chars); a hard truncation ceiling. */
export const SOURCE_CONTEXT_CHARS = 12000;

function readSourceContextChars(): number {
  const raw = Number(process.env.CONNECT_SOURCE_CONTEXT_CHARS ?? SOURCE_CONTEXT_CHARS);
  if (!Number.isFinite(raw)) return SOURCE_CONTEXT_CHARS;
  return Math.max(Math.floor(raw), 1000);
}

export function buildValidationSystemPrompt(
  pack: ConnectDomainPack,
  opts?: { qualityPreset?: ConnectQualityPreset; graphContext?: GraphIngestContext },
): string {
  return composeStageSystemPrompt({
    pack,
    stage: "validation",
    qualityPreset: opts?.qualityPreset ?? pack.quality_preset ?? "production",
    graphContext: opts?.graphContext,
  });
}

export function buildValidationUserPrompt(
  units: ValidationInput[],
  sourceText: string,
  opts?: { sourceTextByRef?: Map<string, string> },
): string {
  const list = units.map((u) => `- ${u.ref}: ${u.text}`).join("\n");
  if (opts?.sourceTextByRef?.size) {
    const chunks = units
      .map((u) => {
        const chunk = opts.sourceTextByRef!.get(u.ref);
        return chunk ? `[${u.ref} passage]\n${chunk.slice(0, 8000)}` : null;
      })
      .filter(Boolean)
      .join("\n\n");
    return `SOURCE PASSAGES (per unit):\n${chunks}\n\nUNITS TO ASSESS:\n${list}`;
  }
  return `SOURCE TEXT:\n${sourceText.slice(0, readSourceContextChars())}\n\nUNITS TO ASSESS:\n${list}`;
}

export function buildValidationBatchInputs(
  units: ValidationInput[],
): { batchUnits: ValidationInput[]; refToUnitId: Map<string, string> }[] {
  const batchSize = readValidationBatchSize();
  const batches: { batchUnits: ValidationInput[]; refToUnitId: Map<string, string> }[] = [];
  for (let offset = 0; offset < units.length; offset += batchSize) {
    const slice = units.slice(offset, offset + batchSize);
    const refToUnitId = new Map<string, string>();
    const batchUnits = slice.map((unit, index) => {
      const shortRef = `v${index + 1}`;
      refToUnitId.set(shortRef, unit.ref);
      return { ref: shortRef, text: unit.text };
    });
    batches.push({ batchUnits, refToUnitId });
  }
  return batches;
}

export function remapValidationBatchResults(
  results: UnitValidation[],
  refToUnitId: Map<string, string>,
): UnitValidation[] {
  const out: UnitValidation[] = [];
  for (const result of results) {
    const unitId = refToUnitId.get(result.ref) ?? result.ref;
    if (!unitId) continue;
    out.push({ ...result, ref: unitId });
  }
  return out;
}

export function finalizeValidationCoverage(
  units: ValidationInput[],
  results: UnitValidation[],
): UnitValidation[] {
  const byRef = new Map<string, UnitValidation>();
  for (const result of results) {
    if (!byRef.has(result.ref)) byRef.set(result.ref, result);
  }
  for (const unit of units) {
    if (byRef.has(unit.ref)) continue;
    // Fail-safe: a unit the validator never judged must not pass the quality gate —
    // "weak" routes it to remediation instead of into the graph as supported.
    byRef.set(unit.ref, {
      ref: unit.ref,
      status: "weak",
      note: "coverage_gap: validator omitted this unit",
    });
  }
  return units.map((unit) => byRef.get(unit.ref)!);
}

/**
 * H1: loose-JSON parse with an explicit failure signal. `parseFailed` is true when the
 * response could not be parsed as JSON at all (truncated/garbled) — the whole batch is
 * lost and the orchestrator should warn + re-ask before fail-safe defaults apply.
 */
export function parseValidationResponseDetailed(raw: string): ParsedBatchResponse<UnitValidation> {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    const s = raw.indexOf("{");
    const e = raw.lastIndexOf("}");
    if (s < 0 || e <= s) return { results: [], parseFailed: true };
    try {
      obj = JSON.parse(raw.slice(s, e + 1));
    } catch {
      return { results: [], parseFailed: true };
    }
  }
  const resultsRaw = Array.isArray((obj as Record<string, unknown>)?.results)
    ? ((obj as Record<string, unknown>).results as unknown[])
    : [];
  const out: UnitValidation[] = [];
  for (const r of resultsRaw) {
    if (!r || typeof r !== "object") continue;
    const rec = r as Record<string, unknown>;
    const ref = typeof rec.ref === "string" ? rec.ref.trim() : "";
    if (!ref) continue;
    const statusRaw = typeof rec.status === "string" ? rec.status.trim() : "";
    const status: UnitValidationStatus =
      statusRaw === "ok" || statusRaw === "weak" || statusRaw === "unsupported" ? statusRaw : "weak";
    out.push({
      ref,
      status,
      ...(typeof rec.note === "string" && rec.note.trim() ? { note: rec.note.trim() } : {}),
    });
  }
  return { results: out, parseFailed: false };
}

export function parseValidationResponse(raw: string): UnitValidation[] {
  return parseValidationResponseDetailed(raw).results;
}

/** Validate one batch (short refs). Prefer {@link validateUnits} for full source coverage. */
export async function validateUnitsBatch(args: {
  units: ValidationInput[];
  sourceText: string;
  pack: ConnectDomainPack;
  generate: ExtractionGenerate;
  qualityPreset?: ConnectQualityPreset;
  graphContext?: GraphIngestContext;
  sourceTextByRef?: Map<string, string>;
}): Promise<UnitValidation[]> {
  return (await validateUnitsBatchDetailed(args)).results;
}

/** {@link validateUnitsBatch} with the H1 parse-failure signal for orchestrators. */
export async function validateUnitsBatchDetailed(args: {
  units: ValidationInput[];
  sourceText: string;
  pack: ConnectDomainPack;
  generate: ExtractionGenerate;
  qualityPreset?: ConnectQualityPreset;
  graphContext?: GraphIngestContext;
  sourceTextByRef?: Map<string, string>;
}): Promise<ParsedBatchResponse<UnitValidation>> {
  if (args.units.length === 0) return { results: [], parseFailed: false };
  const system = buildValidationSystemPrompt(args.pack, {
    qualityPreset: args.qualityPreset,
    graphContext: args.graphContext,
  });
  const user = buildValidationUserPrompt(args.units, args.sourceText, {
    sourceTextByRef: args.sourceTextByRef,
  });
  const raw = await args.generate({ system, user });
  return parseValidationResponseDetailed(raw);
}

export async function validateUnits(args: {
  units: ValidationInput[];
  sourceText: string;
  pack: ConnectDomainPack;
  generate: ExtractionGenerate;
  qualityPreset?: ConnectQualityPreset;
  graphContext?: GraphIngestContext;
  sourceTextByRef?: Map<string, string>;
  /** H1: called when a batch loses verdicts (before the single re-ask + fail-safe defaults). */
  onCoverageShortfall?: CoverageShortfallHandler;
}): Promise<UnitValidation[]> {
  if (args.units.length === 0) return [];

  const merged: UnitValidation[] = [];
  for (const { batchUnits, refToUnitId } of buildValidationBatchInputs(args.units)) {
    // H1: a lost batch (truncated/garbled response or omitted refs) is re-asked exactly
    // once; refs still missing after that fall through to the fail-safe "weak" finalize.
    const asked = await askBatchWithCoverageRetry<ValidationInput, UnitValidation>({
      inputs: batchUnits,
      ask: (units) => validateUnitsBatchDetailed({ ...args, units }),
      ...(args.onCoverageShortfall ? { onShortfall: args.onCoverageShortfall } : {}),
    });
    merged.push(...remapValidationBatchResults(asked.results, refToUnitId));
  }
  return finalizeValidationCoverage(args.units, merged);
}
