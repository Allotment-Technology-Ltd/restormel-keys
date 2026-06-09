/**
 * Remediation stage (self-healing): repair units the validation stage flagged as
 * weak/unsupported, or drop those that cannot be supported by the source. Repaired
 * units are re-embedded by the orchestrator. Pack-driven; DI generate.
 */
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import type { ExtractionGenerate } from "./extract.js";
import type { ConnectQualityPreset } from "./quality-preset.js";
import { composeStageSystemPrompt } from "./prompt-compose.js";

export interface RemediationInput {
  ref: string;
  text: string;
  note?: string;
}

export type RemediationAction = "repair" | "drop" | "keep";

export interface RemediationResult {
  ref: string;
  action: RemediationAction;
  /** Corrected text when action === "repair". */
  text?: string;
  /** Model's confidence (0-1) in the chosen action; used to gate by a strictness threshold. */
  confidence?: number;
}

/** Short refs per batch so the model echoes ids reliably (not Surreal record ids). */
export const REMEDIATION_BATCH_SIZE = 25;

function readRemediationBatchSize(): number {
  const raw = Number(process.env.CONNECT_REMEDIATION_BATCH_SIZE ?? REMEDIATION_BATCH_SIZE);
  if (!Number.isFinite(raw)) return REMEDIATION_BATCH_SIZE;
  return Math.min(Math.max(Math.floor(raw), 5), 50);
}

export function buildRemediationSystemPrompt(
  pack: ConnectDomainPack,
  opts?: { qualityPreset?: ConnectQualityPreset },
): string {
  return composeStageSystemPrompt({
    pack,
    stage: "remediation",
    qualityPreset: opts?.qualityPreset ?? pack.quality_preset ?? "production",
  });
}

export function buildRemediationUserPrompt(units: RemediationInput[], sourceText: string): string {
  const list = units
    .map((u) => `- ${u.ref}${u.note ? ` (issue: ${u.note})` : ""}: ${u.text}`)
    .join("\n");
  return (
    `SOURCE TEXT:\n${sourceText.slice(0, 12000)}\n\nUNITS TO REMEDIATE:\n${list}\n\n` +
    `For each unit also return "confidence": a number 0-1 for how sure you are of the chosen action.`
  );
}

export function buildRemediationBatchInputs(
  units: RemediationInput[],
): { batchUnits: RemediationInput[]; refToUnitId: Map<string, string> }[] {
  const batchSize = readRemediationBatchSize();
  const batches: { batchUnits: RemediationInput[]; refToUnitId: Map<string, string> }[] = [];
  for (let offset = 0; offset < units.length; offset += batchSize) {
    const slice = units.slice(offset, offset + batchSize);
    const refToUnitId = new Map<string, string>();
    const batchUnits = slice.map((unit, index) => {
      const shortRef = `r${index + 1}`;
      refToUnitId.set(shortRef, unit.ref);
      return {
        ref: shortRef,
        text: unit.text,
        ...(unit.note ? { note: unit.note } : {}),
      };
    });
    batches.push({ batchUnits, refToUnitId });
  }
  return batches;
}

export function remapRemediationBatchResults(
  results: RemediationResult[],
  refToUnitId: Map<string, string>,
): RemediationResult[] {
  const out: RemediationResult[] = [];
  for (const result of results) {
    const unitId = refToUnitId.get(result.ref) ?? result.ref;
    if (!unitId) continue;
    out.push({ ...result, ref: unitId });
  }
  return out;
}

export function finalizeRemediationCoverage(
  units: RemediationInput[],
  results: RemediationResult[],
): RemediationResult[] {
  const byRef = new Map<string, RemediationResult>();
  for (const result of results) {
    if (!byRef.has(result.ref)) byRef.set(result.ref, result);
  }
  for (const unit of units) {
    if (byRef.has(unit.ref)) continue;
    // Fail-safe: these inputs are already validation-flagged; an omitted verdict must
    // not persist them as if remediation chose "keep". "drop" maps to a reversible
    // soft-exclude downstream, still gated by the orchestrator's strictness policy.
    byRef.set(unit.ref, { ref: unit.ref, action: "drop" });
  }
  return units.map((unit) => byRef.get(unit.ref)!);
}

export function parseRemediationResponse(raw: string): RemediationResult[] {
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
  const out: RemediationResult[] = [];
  for (const r of resultsRaw) {
    if (!r || typeof r !== "object") continue;
    const rec = r as Record<string, unknown>;
    const ref = typeof rec.ref === "string" ? rec.ref.trim() : "";
    if (!ref) continue;
    const a = typeof rec.action === "string" ? rec.action.trim() : "";
    const action: RemediationAction = a === "repair" || a === "drop" || a === "keep" ? a : "keep";
    const text = typeof rec.text === "string" ? rec.text.trim() : "";
    const confidence =
      typeof rec.confidence === "number" && Number.isFinite(rec.confidence)
        ? Math.min(1, Math.max(0, rec.confidence))
        : undefined;
    out.push({
      ref,
      action,
      ...(action === "repair" && text ? { text } : {}),
      ...(confidence !== undefined ? { confidence } : {}),
    });
  }
  return out;
}

/** Remediate one batch (short refs). Prefer {@link remediateUnits} for full weak-unit coverage. */
export async function remediateUnitsBatch(args: {
  units: RemediationInput[];
  sourceText: string;
  pack: ConnectDomainPack;
  generate: ExtractionGenerate;
  qualityPreset?: ConnectQualityPreset;
}): Promise<RemediationResult[]> {
  if (args.units.length === 0) return [];
  const system = buildRemediationSystemPrompt(args.pack, { qualityPreset: args.qualityPreset });
  const user = buildRemediationUserPrompt(args.units, args.sourceText);
  const raw = await args.generate({ system, user });
  return parseRemediationResponse(raw);
}

export async function remediateUnits(args: {
  units: RemediationInput[];
  sourceText: string;
  pack: ConnectDomainPack;
  generate: ExtractionGenerate;
  qualityPreset?: ConnectQualityPreset;
}): Promise<RemediationResult[]> {
  if (args.units.length === 0) return [];

  const batches = buildRemediationBatchInputs(args.units);
  if (batches.length === 1) {
    const { batchUnits, refToUnitId } = batches[0]!;
    const parsed = await remediateUnitsBatch({ ...args, units: batchUnits });
    const remapped = remapRemediationBatchResults(parsed, refToUnitId);
    return finalizeRemediationCoverage(args.units, remapped);
  }

  const merged: RemediationResult[] = [];
  for (const { batchUnits, refToUnitId } of batches) {
    const parsed = await remediateUnitsBatch({ ...args, units: batchUnits });
    merged.push(...remapRemediationBatchResults(parsed, refToUnitId));
  }
  return finalizeRemediationCoverage(args.units, merged);
}
