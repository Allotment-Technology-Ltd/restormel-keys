/**
 * First-graph onboarding: load Restormel-authored philosophy demo documents into a workspace.
 *
 * The manifest and the three markdown passages are imported as modules (JSON +
 * Vite `?raw`) so Rollup inlines them into the server bundle. Reading them via
 * `fs` at runtime relative to the compiled chunk does NOT work: the
 * adapter-node / adapter-vercel build bundles the `.ts` module into
 * `build/server/chunks/` but never copies the sibling `starter-corpus/` data
 * directory, so `readFileSync(.../starter-corpus/manifest.json)` throws ENOENT
 * in production. Importing keeps the data with the code regardless of adapter.
 */
import { randomUUID } from "node:crypto";
import { chunkDocument } from "@restormel/connect-core";
import type { ConnectSourceDocument } from "@restormel/contracts/connect";
import {
  insertConnectSourceDocument,
  listConnectSourceDocumentsForWorkspace,
} from "$lib/server/neon";
import { SUGGESTED_GRAPH_DESIGNER_INTENT, STARTER_CORPUS_NAME_PREFIX } from "$lib/connect/first-graph-guide";
import { sourceDocumentRecordToApi } from "$lib/server/connect/source-documents";
import manifest from "./starter-corpus/manifest.json";
// Markdown passages bundled as raw strings (Vite `?raw`). Keyed by manifest `file`.
import trolleyProblemDialogue from "./starter-corpus/01-trolley-problem-dialogue.md?raw";
import knowledgeVsBelief from "./starter-corpus/02-knowledge-vs-belief.md?raw";
import utilitarianObjection from "./starter-corpus/03-utilitarian-objection.md?raw";

type ManifestDoc = { file: string; name: string };
type StarterManifest = {
  id: string;
  title: string;
  license: string;
  description: string;
  documents: ManifestDoc[];
};

const STARTER_MANIFEST = manifest as StarterManifest;

/** Bundled markdown bodies, keyed by the manifest `file` field. */
const CORPUS_FILES: Record<string, string> = {
  "01-trolley-problem-dialogue.md": trolleyProblemDialogue,
  "02-knowledge-vs-belief.md": knowledgeVsBelief,
  "03-utilitarian-objection.md": utilitarianObjection,
};

function loadManifest(): StarterManifest {
  return STARTER_MANIFEST;
}

function loadCorpusFile(file: string): string {
  const markdown = CORPUS_FILES[file];
  if (markdown === undefined) {
    throw new Error(`Starter corpus file not bundled: ${file}`);
  }
  return markdown;
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

    const markdown = loadCorpusFile(entry.file);
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
