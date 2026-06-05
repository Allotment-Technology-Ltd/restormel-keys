/**
 * Graph Designer: draft a Domain Pack from the operator's intent + a sample of
 * their own documents (GraphRAG-style). Uses Keys ingestion routes when configured
 * (same chat path as extraction preview), with legacy OPENAI_API_KEY fallback.
 * The draft is returned for review/edit — never auto-saved.
 */
import type { ConnectDomainPackUpsert } from "@restormel/contracts/connect";
import {
  getConnectSourceDocumentsByIds,
  listConnectSourceDocumentsForWorkspace,
} from "$lib/server/neon";
import { buildDomainPackDraft } from "$lib/server/connect/designer-map";
import {
  generateKnowledgeJsonChat,
  isConnectIngestLlmReady,
} from "$lib/server/connect/stage-route-generate";
import { resolveKnowledgeRouteExecutionContext } from "$lib/server/connect/stage-routing";
import { generateChat, isLlmConfigured } from "$lib/server/connect/llm-generate";

const MAX_DOCS = 4;
const PER_DOC_CHARS = 3000;

export async function isDesignerConfigured(args: {
  workspaceId: string;
  userId: string;
}): Promise<boolean> {
  const routeCtx = await resolveKnowledgeRouteExecutionContext({
    workspaceId: args.workspaceId,
    userId: args.userId,
  });
  return isConnectIngestLlmReady({ workspaceId: args.workspaceId, routeCtx });
}

const SYSTEM_PROMPT = `You are a knowledge-graph ontology designer. Given a user's intent and a sample of their documents, propose a DOMAIN PACK that tells an extraction pipeline what to pull out and how ideas connect.

Return STRICT JSON only (no prose) with this shape:
{
  "title": string,
  "slug": string (kebab-case),
  "description": string,
  "unit_noun": string,            // the atomic extracted unit, e.g. "claim", "finding", "requirement"
  "group_noun": string,           // a named group of units, e.g. "argument", "case", "topic"
  "domains": string[],            // taxonomy/categories for classifying units (may be empty)
  "unit_types": string[],         // kinds of unit, e.g. ["assertion","definition","example"]
  "relation_types": [{"name": string, "description": string}], // how units connect
  "group_roles": string[],        // roles a unit plays in a group, e.g. ["conclusion","premise"]
  "relationship_patterns": [{"from_unit_type": string, "relation": string, "to_unit_type": string}],
  "schema_mode": "strict" | "guided" | "open",
  "archetype": "argumentative" | "factual" | "procedural" | "product_docs" | "generic",
  "marker_lexicon": string[],     // discourse markers for passage_profile (optional)
  "prompts": {
    "extraction": string,         // may use {unit_noun}, {pack_title}, etc.
    "validation": string,
    "remediation": string,
    "grouping": string
  },
  "rationale": string             // one short paragraph explaining the design
}

Principles: capture RELATIONSHIPS between ideas, not just isolated text. Keep complete units (a whole idea/argument), not fragments. Prefer 4-8 relation types and a focused set of unit types. Use schema_mode "guided" unless the corpus is highly varied (then "open") or tightly controlled (then "strict").`;

function buildSample(docs: { name: string; text: string | null }[]): string {
  return docs
    .slice(0, MAX_DOCS)
    .map((d, i) => `--- Document ${i + 1}: ${d.name} ---\n${(d.text ?? "").slice(0, PER_DOC_CHARS)}`)
    .join("\n\n");
}

export type DesignerOutcome =
  | { ok: true; draft: ConnectDomainPackUpsert; rationale?: string; sampled: string[] }
  | { ok: false; status: number; error: string; message: string };

async function generateDesignerJson(args: {
  workspaceId: string;
  userId: string;
  system: string;
  user: string;
}): Promise<string> {
  const routeCtx = await resolveKnowledgeRouteExecutionContext({
    workspaceId: args.workspaceId,
    userId: args.userId,
  });
  if (routeCtx) {
    return generateKnowledgeJsonChat({ ctx: routeCtx, system: args.system, user: args.user });
  }
  if (!isLlmConfigured()) {
    throw new Error("designer_unconfigured");
  }
  return generateChat({ system: args.system, user: args.user, jsonMode: true, temperature: 0.2 });
}

export async function draftDomainPackFromIntent(args: {
  workspaceId: string;
  userId: string;
  intent: string;
  domainName?: string;
  documentIds?: string[];
}): Promise<DesignerOutcome> {
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
      error: "designer_unavailable",
      message:
        "Graph Designer needs Keys ingestion routes configured on Models & keys (publish an extraction route with provider credentials), or OPENAI_API_KEY on the dashboard runtime.",
    };
  }

  let docIds = args.documentIds ?? [];
  if (docIds.length === 0) {
    const recent = await listConnectSourceDocumentsForWorkspace(args.workspaceId);
    docIds = recent.filter((d) => d.status === "parsed").slice(0, MAX_DOCS).map((d) => d.id);
  }
  const docs = docIds.length ? await getConnectSourceDocumentsByIds({ ids: docIds, workspaceId: args.workspaceId }) : [];
  const usable = docs.filter((d) => d.status === "parsed" && d.text && d.text.trim());
  const sample = buildSample(usable.map((d) => ({ name: d.name, text: d.text })));

  const userContent = [
    `INTENT: ${args.intent.trim()}`,
    args.domainName?.trim() ? `DOMAIN: ${args.domainName.trim()}` : "",
    sample ? `SAMPLE DOCUMENTS:\n${sample}` : "SAMPLE DOCUMENTS: (none provided — design from the intent alone)",
  ]
    .filter(Boolean)
    .join("\n\n");

  let parsed: unknown;
  try {
    const content = await generateDesignerJson({
      workspaceId: args.workspaceId,
      userId: args.userId,
      system: SYSTEM_PROMPT,
      user: userContent,
    });
    parsed = JSON.parse(content);
  } catch (e) {
    if (e instanceof Error && e.message === "designer_unconfigured") {
      return {
        ok: false,
        status: 503,
        error: "designer_unavailable",
        message:
          "Graph Designer needs Keys ingestion routes configured on Models & keys (publish an extraction route with provider credentials), or OPENAI_API_KEY on the dashboard runtime.",
      };
    }
    const msg = e instanceof Error ? e.message : "request failed";
    return { ok: false, status: 502, error: "llm_error", message: `Could not generate a draft: ${msg.slice(0, 200)}` };
  }

  try {
    const { draft, rationale } = buildDomainPackDraft(parsed, {
      fallbackTitle: args.domainName?.trim() || "Custom domain",
    });
    return { ok: true, draft, rationale, sampled: usable.map((d) => d.name) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "invalid draft";
    return { ok: false, status: 502, error: "invalid_draft", message: `The model returned an unusable design: ${msg.slice(0, 160)}` };
  }
}
