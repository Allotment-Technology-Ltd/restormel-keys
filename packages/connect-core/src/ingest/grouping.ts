/**
 * Grouping stage: cluster extracted units into named groups (the pack's
 * `group_noun`) with per-member roles (the pack's `group_roles`). Pack-driven and
 * schema_mode-aware, mirroring the extraction enforcement pattern. DI generate.
 */
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import type { ExtractionGenerate } from "./extract.js";
import type { ConnectQualityPreset } from "./quality-preset.js";
import { composeStageSystemPrompt } from "./prompt-compose.js";

export interface GroupingUnitInput {
  ref: string;
  text: string;
  type?: string;
}

export interface GroupedMember {
  ref: string;
  role?: string;
}

export interface ExtractedGroup {
  name: string;
  summary?: string;
  members: GroupedMember[];
}

export function buildGroupingSystemPrompt(
  pack: ConnectDomainPack,
  opts?: { qualityPreset?: ConnectQualityPreset },
): string {
  return composeStageSystemPrompt({
    pack,
    stage: "grouping",
    qualityPreset: opts?.qualityPreset ?? pack.quality_preset ?? "production",
  });
}

export function buildGroupingUserPrompt(units: GroupingUnitInput[]): string {
  const list = units
    .map((u) => `- ${u.ref}${u.type ? ` [${u.type}]` : ""}: ${u.text}`)
    .join("\n");
  return `Units:\n${list}`;
}

export function parseGroupingResponse(raw: string): ExtractedGroup[] {
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
  const groupsRaw = Array.isArray((obj as Record<string, unknown>)?.groups)
    ? ((obj as Record<string, unknown>).groups as unknown[])
    : [];
  const groups: ExtractedGroup[] = [];
  for (const g of groupsRaw) {
    if (!g || typeof g !== "object") continue;
    const rec = g as Record<string, unknown>;
    const name = typeof rec.name === "string" ? rec.name.trim() : "";
    if (!name) continue;
    const membersRaw = Array.isArray(rec.members) ? (rec.members as unknown[]) : [];
    const members: GroupedMember[] = [];
    for (const m of membersRaw) {
      if (!m || typeof m !== "object") continue;
      const mr = m as Record<string, unknown>;
      const ref = typeof mr.ref === "string" ? mr.ref.trim() : "";
      if (!ref) continue;
      members.push({
        ref,
        ...(typeof mr.role === "string" && mr.role.trim() ? { role: mr.role.trim() } : {}),
      });
    }
    if (members.length === 0) continue;
    groups.push({
      name,
      ...(typeof rec.summary === "string" && rec.summary.trim() ? { summary: rec.summary.trim() } : {}),
      members,
    });
  }
  return groups;
}

export async function groupUnits(args: {
  units: GroupingUnitInput[];
  pack: ConnectDomainPack;
  generate: ExtractionGenerate;
  qualityPreset?: ConnectQualityPreset;
}): Promise<ExtractedGroup[]> {
  if (args.units.length === 0) return [];
  const system = buildGroupingSystemPrompt(args.pack, { qualityPreset: args.qualityPreset });
  const user = buildGroupingUserPrompt(args.units);
  const raw = await args.generate({ system, user });
  return parseGroupingResponse(raw);
}
