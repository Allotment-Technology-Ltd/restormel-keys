/**
 * Remediation stage (self-healing): repair units the validation stage flagged as
 * weak/unsupported, or drop those that cannot be supported by the source. Repaired
 * units are re-embedded by the orchestrator. Pack-driven; DI generate.
 */
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import type { ExtractionGenerate } from "./extract.js";

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
}

export function buildRemediationSystemPrompt(pack: ConnectDomainPack): string {
  const o = pack.ontology;
  const parts: string[] = [];
  if (pack.prompts?.remediation?.trim()) {
    parts.push(pack.prompts.remediation.trim());
  } else {
    parts.push(
      `You repair ${o.unit_noun}s that were flagged as weakly or not supported by the SOURCE TEXT for the domain "${pack.title}".`,
    );
  }
  parts.push(
    `For each ${o.unit_noun}, choose an action:\n- "repair": rewrite it so it is precise and faithful to the source; provide the corrected "text"\n- "drop": it cannot be supported by the source and should be removed\n- "keep": it is actually fine as-is`,
  );
  parts.push(
    `Return STRICT JSON only:\n{ "results": [{ "ref": "<unit ref>", "action": "repair|drop|keep", "text": "<corrected text when repairing>" }] }`,
  );
  return parts.join("\n\n");
}

export function buildRemediationUserPrompt(units: RemediationInput[], sourceText: string): string {
  const list = units
    .map((u) => `- ${u.ref}${u.note ? ` (issue: ${u.note})` : ""}: ${u.text}`)
    .join("\n");
  return `SOURCE TEXT:\n${sourceText.slice(0, 12000)}\n\nUNITS TO REMEDIATE:\n${list}`;
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
    out.push({ ref, action, ...(action === "repair" && text ? { text } : {}) });
  }
  return out;
}

export async function remediateUnits(args: {
  units: RemediationInput[];
  sourceText: string;
  pack: ConnectDomainPack;
  generate: ExtractionGenerate;
}): Promise<RemediationResult[]> {
  if (args.units.length === 0) return [];
  const system = buildRemediationSystemPrompt(args.pack);
  const user = buildRemediationUserPrompt(args.units, args.sourceText);
  const raw = await args.generate({ system, user });
  return parseRemediationResponse(raw);
}
