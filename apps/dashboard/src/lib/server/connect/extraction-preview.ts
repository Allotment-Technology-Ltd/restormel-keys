/**
 * Dry-run extraction preview: run the pack-driven extraction over a small sample
 * and return units, relationships, and quality warnings — WITHOUT writing to any
 * store. Lets operators tune the domain pack before spending tokens on a full run.
 */
import {
  chunkDocument,
  extractGraph,
  evaluateExtractionGate,
  type ExtractionResult,
  type ExtractedUnit,
  type ExtractedRelation,
} from "@restormel/connect-core";
import { loadGraphIngestContext } from "$lib/server/connect/graph-ingest-context";
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import {
  getConnectDomainPackById,
  getConnectSourceDocumentsByIds,
  listConnectSourceDocumentsForWorkspace,
} from "$lib/server/neon";
import { domainPackRecordToApi, listDomainPacksForUi } from "$lib/server/connect/domain-pack-service";
import {
  buildKnowledgeStageGenerates,
  isConnectIngestLlmReady,
} from "$lib/server/connect/stage-route-generate";
import { resolveKnowledgeRouteExecutionContext } from "$lib/server/connect/stage-routing";

const MAX_PREVIEW_CHUNKS = 3;

export type PreviewOutcome =
  | {
      ok: true;
      result: ExtractionResult;
      pack: { slug: string; title: string; schema_mode: string };
      sampled_from: string | null;
      chunks_previewed: number;
    }
  | { ok: false; status: number; error: string; message: string };

async function resolvePack(workspaceId: string, packId?: string): Promise<ConnectDomainPack | null> {
  if (packId) {
    const rec = await getConnectDomainPackById({ id: packId, workspaceId });
    return rec ? domainPackRecordToApi(rec) : null;
  }
  const packs = await listDomainPacksForUi(workspaceId);
  return packs.find((p) => p.slug === "generic") ?? packs[0] ?? null;
}

async function resolveSampleText(
  workspaceId: string,
  documentIds: string[] | undefined,
  inlineText: string | undefined,
): Promise<{ text: string; name: string | null }> {
  if (inlineText && inlineText.trim()) {
    return { text: inlineText.trim(), name: "pasted text" };
  }
  let ids = documentIds ?? [];
  if (ids.length === 0) {
    const recent = await listConnectSourceDocumentsForWorkspace(workspaceId);
    ids = recent.filter((d) => d.status === "parsed").slice(0, 1).map((d) => d.id);
  }
  const docs = ids.length ? await getConnectSourceDocumentsByIds({ ids, workspaceId }) : [];
  const usable = docs.find((d) => d.status === "parsed" && d.text && d.text.trim());
  return usable ? { text: usable.text as string, name: usable.name } : { text: "", name: null };
}

export async function previewExtraction(args: {
  workspaceId: string;
  userId: string;
  packId?: string;
  documentIds?: string[];
  text?: string;
}): Promise<PreviewOutcome> {
  const routeCtx = await resolveKnowledgeRouteExecutionContext({
    workspaceId: args.workspaceId,
    userId: args.userId,
  });
  const llmReady = await isConnectIngestLlmReady({
    workspaceId: args.workspaceId,
    routeCtx,
  });
  if (!llmReady) {
    return {
      ok: false,
      status: 503,
      error: "preview_unavailable",
      message:
        "Extraction preview needs Keys ingestion routes configured (Models & keys) or OPENAI_API_KEY on the dashboard runtime.",
    };
  }

  const pack = await resolvePack(args.workspaceId, args.packId);
  if (!pack) {
    return { ok: false, status: 400, error: "no_domain_pack", message: "No domain pack is available." };
  }

  const sample = await resolveSampleText(args.workspaceId, args.documentIds, args.text);
  if (!sample.text) {
    return {
      ok: false,
      status: 400,
      error: "no_sample",
      message: "Add or select at least one parsed document (or paste text) to preview.",
    };
  }

  const chunks = chunkDocument(sample.text, pack.chunking).slice(0, MAX_PREVIEW_CHUNKS);
  const graphContext = await loadGraphIngestContext(args.workspaceId);
  const preset = pack.quality_preset ?? "production";

  try {
    const { generates } = await buildKnowledgeStageGenerates({
      workspaceId: args.workspaceId,
      routeCtx,
    });
    const mergedUnits: ExtractedUnit[] = [];
    const mergedRelations: ExtractedRelation[] = [];
    const mergedWarnings: ExtractionResult["warnings"] = [];
    const chunkTexts = chunks.length ? chunks : [{ text: sample.text.slice(0, 8000), index: 0 }];
    for (let i = 0; i < chunkTexts.length; i++) {
      const chunk = chunkTexts[i]!;
      const extraction = await extractGraph({
        text: chunk.text,
        pack,
        generate: generates.extraction,
        qualityPreset: preset,
        graphContext,
      });
      // H3: same totals-aware gate as the full runner, so previews reflect real runs.
      const gate = evaluateExtractionGate(
        extraction.warnings,
        preset,
        pack.ontology.schema_mode,
        { totals: { units: extraction.units.length, relations: extraction.relations.length } },
      );
      if (!gate.allowPersist) continue;
      const offset = mergedUnits.length;
      for (const u of extraction.units) {
        mergedUnits.push({ ...u, id: `c${i}_${u.id}` });
      }
      for (const r of extraction.relations) {
        mergedRelations.push({
          from: `c${i}_${r.from}`,
          to: `c${i}_${r.to}`,
          relation: r.relation,
        });
      }
      mergedWarnings.push(...extraction.warnings);
      if (offset === mergedUnits.length) {
        mergedWarnings.push({
          code: "no_units",
          severity: "warning",
          message: `Chunk ${i + 1} produced no units after gate.`,
        });
      }
    }
    const result: ExtractionResult = {
      units: mergedUnits,
      relations: mergedRelations,
      warnings: mergedWarnings,
    };
    return {
      ok: true,
      result,
      pack: { slug: pack.slug, title: pack.title, schema_mode: pack.ontology.schema_mode },
      sampled_from: sample.name,
      chunks_previewed: chunkTexts.length,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "extraction failed";
    return { ok: false, status: 502, error: "extraction_failed", message: msg.slice(0, 200) };
  }
}
