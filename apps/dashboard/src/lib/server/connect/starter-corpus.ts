/**
 * First-graph onboarding: load Restormel-authored philosophy demo documents into a workspace.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { chunkDocument } from "@restormel/connect-core";
import type { ConnectSourceDocument } from "@restormel/contracts/connect";
import {
  insertConnectSourceDocument,
  listConnectSourceDocumentsForWorkspace,
} from "$lib/server/neon";
import { SUGGESTED_GRAPH_DESIGNER_INTENT, STARTER_CORPUS_NAME_PREFIX } from "$lib/connect/first-graph-guide";
import { sourceDocumentRecordToApi } from "$lib/server/connect/source-documents";

const CORPUS_DIR = join(dirname(fileURLToPath(import.meta.url)), "starter-corpus");

type ManifestDoc = { file: string; name: string };
type StarterManifest = {
  id: string;
  title: string;
  license: string;
  description: string;
  documents: ManifestDoc[];
};

function loadManifest(): StarterManifest {
  const raw = readFileSync(join(CORPUS_DIR, "manifest.json"), "utf8");
  return JSON.parse(raw) as StarterManifest;
}

export function isStarterCorpusDocumentName(name: string): boolean {
  return name.startsWith(STARTER_CORPUS_NAME_PREFIX);
}

export async function listStarterCorpusDocuments(
  workspaceId: string,
): Promise<ConnectSourceDocument[]> {
  const rows = await listConnectSourceDocumentsForWorkspace(workspaceId);
  return rows
    .filter((r) => isStarterCorpusDocumentName(r.name))
    .map(sourceDocumentRecordToApi);
}

export async function loadStarterCorpus(
  workspaceId: string,
): Promise<{ already_loaded: boolean; documents: ConnectSourceDocument[] }> {
  const existing = await listStarterCorpusDocuments(workspaceId);
  const parsedExisting = existing.filter((d) => d.status === "parsed");
  if (parsedExisting.length >= 3) {
    return { already_loaded: true, documents: parsedExisting };
  }

  const manifest = loadManifest();
  const documents: ConnectSourceDocument[] = [];

  for (const entry of manifest.documents) {
    const already = existing.find((d) => d.name === entry.name && d.status === "parsed");
    if (already) {
      documents.push(already);
      continue;
    }

    const markdown = readFileSync(join(CORPUS_DIR, entry.file), "utf8");
    const chunks = chunkDocument(markdown);
    const id = randomUUID();
    const rec = await insertConnectSourceDocument({
      id,
      workspaceId,
      sourceKind: "upload",
      name: entry.name,
      mime: "text/markdown",
      text: markdown,
      charCount: markdown.length,
      chunkCount: chunks.length,
      status: "parsed",
      parserProvider: "builtin",
    });
    documents.push(sourceDocumentRecordToApi(rec));
  }

  return { already_loaded: false, documents };
}

export function getSuggestedGraphDesignerIntent(): string {
  return SUGGESTED_GRAPH_DESIGNER_INTENT;
}

export const STARTER_CORPUS_MANIFEST_ID = "restormel-philosophy-starter-v1";
