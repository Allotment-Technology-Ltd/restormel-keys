/**
 * Validation stage: assess each extracted unit against its source text for
 * faithfulness. Pack-driven (uses the pack's prompt override if present). DI generate.
 * Status: ok | weak | unsupported.
 */
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import type { ExtractionGenerate } from "./extract.js";

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

export function buildValidationSystemPrompt(pack: ConnectDomainPack): string {
  const o = pack.ontology;
  const parts: string[] = [];
  if (pack.prompts?.validation?.trim()) {
    parts.push(pack.prompts.validation.trim());
  } else {
    parts.push(
      `You validate extracted ${o.unit_noun}s for the domain "${pack.title}". Your job is to catch hallucinations and serious misreadings — not to nitpick faithful paraphrases.`,
    );
  }
  parts.push(
    `For each ${o.unit_noun}, return a status:\n` +
      `- "ok": supported by the source, including fair paraphrase, summarization, or an inference clearly grounded in the text\n` +
      `- "weak": materially overstated, missing an important qualification, or only loosely related to the source\n` +
      `- "unsupported": contradicts the source or adds claims with no basis in the text`,
  );
  parts.push(
    `Calibrate toward "ok" when the idea is reasonably faithful. Reserve "weak" and "unsupported" for cases that would mislead a reader.`,
  );
  parts.push(
    `Return STRICT JSON only:\n{ "results": [{ "ref": "<unit ref>", "status": "ok|weak|unsupported", "note": "<short reason or omit>" }] }\n` +
      `Include one result for every listed ref — do not omit units.`,
  );
  return parts.join("\n\n");
}

export function buildValidationUserPrompt(units: ValidationInput[], sourceText: string): string {
  const list = units.map((u) => `- ${u.ref}: ${u.text}`).join("\n");
  return `SOURCE TEXT:\n${sourceText.slice(0, 12000)}\n\nUNITS TO ASSESS:\n${list}`;
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
    byRef.set(unit.ref, {
      ref: unit.ref,
      status: "ok",
      note: "Assumed supported (validator omitted this unit)",
    });
  }
  return units.map((unit) => byRef.get(unit.ref)!);
}

export function parseValidationResponse(raw: string): UnitValidation[] {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    const s = raw.indexOf("{");
    const e = raw.lastIndexOf("}");
    if (s < 0 || e <= s) return [];
    try {
      obj = JSON.parse(raw.slice(s, e + 1));
    } catch {
      return [];
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
  return out;
}

/** Validate one batch (short refs). Prefer {@link validateUnits} for full source coverage. */
export async function validateUnitsBatch(args: {
  units: ValidationInput[];
  sourceText: string;
  pack: ConnectDomainPack;
  generate: ExtractionGenerate;
}): Promise<UnitValidation[]> {
  if (args.units.length === 0) return [];
  const system = buildValidationSystemPrompt(args.pack);
  const user = buildValidationUserPrompt(args.units, args.sourceText);
  const raw = await args.generate({ system, user });
  return parseValidationResponse(raw);
}

export async function validateUnits(args: {
  units: ValidationInput[];
  sourceText: string;
  pack: ConnectDomainPack;
  generate: ExtractionGenerate;
}): Promise<UnitValidation[]> {
  if (args.units.length === 0) return [];

  const batches = buildValidationBatchInputs(args.units);
  if (batches.length === 1) {
    const { batchUnits, refToUnitId } = batches[0]!;
    const parsed = await validateUnitsBatch({ ...args, units: batchUnits });
    const remapped = remapValidationBatchResults(parsed, refToUnitId);
    return finalizeValidationCoverage(args.units, remapped);
  }

  const merged: UnitValidation[] = [];
  for (const { batchUnits, refToUnitId } of batches) {
    const parsed = await validateUnitsBatch({ ...args, units: batchUnits });
    merged.push(...remapValidationBatchResults(parsed, refToUnitId));
  }
  return finalizeValidationCoverage(args.units, merged);
}
