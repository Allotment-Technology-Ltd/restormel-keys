/**
 * Account data export / GDPR Art 20 right-to-data-portability — scoped, AUDITED,
 * read-only export of the REQUESTING account's data as a portable JSON archive.
 *
 * Pairs with `account-reset.ts` (Art 17 erasure): the same workspace-scoped
 * ownership map, but read instead of delete. The recommended GDPR flow is
 * EXPORT-then-ERASE — take your data out before the day-0 wipe.
 *
 * WHY: a data subject has the right to receive the personal data they provided,
 * in a structured, commonly-used, machine-readable format (GDPR Art 20). This
 * module assembles that archive for ONE account (the signed-in user's workspace)
 * and NEVER another account's data.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * SECURITY / SCOPING CONTRACT (the whole point of this module):
 *   - The unit of ownership is the WORKSPACE, resolved from the session user's
 *     id via `workspaces.owner_user_id` (one workspace per user). Every SELECT
 *     is parameterised by that resolved `workspaceId` (or, for the handful of
 *     user-scoped reads, the user's `userId`). There is NO unparameterised /
 *     cross-account SELECT anywhere in this module — see `account-export.test.ts`,
 *     which asserts every graph-spine statement carries an account-scoped WHERE.
 *   - Projects/keys/policies/provider-integration metadata are read through the
 *     EXISTING public reader functions in neon.ts (`listProjectsByWorkspace`,
 *     `listApiKeysByWorkspace`, `listManagementKeys`, `listPolicies`,
 *     `listProviderIntegrations`, …). Those readers are already the audited
 *     "safe to show the user" projections — they NEVER select `key_hash`,
 *     `credential_ciphertext`, `credential_iv`, `credential_auth_tag`, or any
 *     other secret column. We reuse them rather than re-deriving SELECTs so the
 *     redaction is enforced in one place.
 *
 * ⚠️ NO SECRETS, EVER (the non-negotiable rule of this feature):
 *   The export carries API-key / provider-binding / external-graph-store
 *   METADATA ONLY — provider, label, key PREFIX, last-4 suffix, scopes,
 *   created/last-used timestamps. It NEVER decrypts or emits:
 *     - BYOK provider credential ciphertext or plaintext,
 *     - Gateway/Management key hashes or raw keys,
 *     - external graph-store (Neo4j / Weaviate / SurrealDB) passwords / API keys,
 *     - knowledge-unit embedding vectors (derived, large, non-portable).
 *   The user already holds their own provider keys; a downloadable
 *   plaintext-secrets file would be an unacceptable exfiltration surface. A final
 *   `assertNoSecretLeakage()` pass scans the assembled archive for secret-shaped
 *   keys and throws if any slipped in (defence in depth against future drift).
 *
 * NOT IN SCOPE (deliberately excluded):
 *   - Shared/global catalog (`models`, `provider_model_variants`, `catalog_*`),
 *     founders allowlists, service-admin emails — not the subject's personal data.
 *   - The CONTENTS of an EXTERNAL graph store (when the workspace points at
 *     SurrealDB / Neo4j / Weaviate): that data lives in the USER's own infra,
 *     outside Restormel. We export the connection CONFIG (host/db/collection,
 *     secret_set boolean) so they can locate it, never its rows or secret. See
 *     `EXTERNAL_STORE_EXPORT_NOTE`.
 */

import {
  listProjectsByWorkspace,
  listEnvironments,
  listApiKeysByWorkspace,
  listManagementKeys,
  listProviderIntegrations,
  listPolicies,
  listPolicyBindingsForWorkspace,
  listRoutes,
  listProjectModelBindings,
  listProviderBindingsByProject,
  listConnectGraphSourcesForWorkspace,
  listConnectSourceDocumentsForWorkspace,
  getWorkspace,
  type Workspace,
} from "$lib/server/neon";
import { getWorkspaceGraphStoreConfigForUi } from "$lib/server/connect/graph-store-config";
import { getPreferencesForUser } from "$lib/server/email-preferences";
import type { DbClient, TxnQuery } from "$lib/server/db-adapter";

/** Schema version of the export envelope — bump when the shape changes. */
export const ACCOUNT_EXPORT_SCHEMA_VERSION = "1.0";

/** Human-readable note embedded in the archive about external graph stores. */
export const EXTERNAL_STORE_EXPORT_NOTE =
  "If this workspace is connected to an external graph store (SurrealDB / Neo4j / " +
  "Weaviate), that data lives in YOUR own infrastructure, outside Restormel. This " +
  "export includes only the connection configuration (host / database / collection, " +
  "and whether a secret is set) so you can locate it — never the store's contents or " +
  "its password / API key. Export or erase the external store directly with your provider.";

/** Note embedded in the archive about excluded secret material. */
export const SECRET_EXCLUSION_NOTE =
  "For your security, this export contains API-key and provider-credential METADATA " +
  "only (provider, label, key prefix, last-4 suffix, scopes, timestamps). It does NOT " +
  "contain any secret values: no decrypted BYOK provider keys, no Gateway/Management " +
  "key material, and no external-store passwords. You already hold your own provider " +
  "keys with your providers.";

// ---------------------------------------------------------------------------
// Graph-spine SELECTs (pure, directly assertable for scoping)
// ---------------------------------------------------------------------------

/**
 * The knowledge_graph_* spine has no existing "list-all-for-workspace, secret-safe"
 * reader, so we build the SELECTs here. CRITICAL EXCLUSIONS, enforced as data so
 * the unit test can assert them:
 *   - `knowledge_graph_units.embedding` is NOT selected (derived float vector;
 *     large, non-portable, and not data the subject "provided").
 * Every statement is `WHERE workspace_id = $1` and nothing else.
 */
export const GRAPH_SPINE_EXPORT_SELECTS: { key: string; text: string }[] = [
  {
    key: "knowledgeGraphSources",
    text:
      `SELECT id, domain_pack_id, job_id, title, url, text_preview, source_kind, payload, created_at ` +
      `FROM knowledge_graph_sources WHERE workspace_id = $1 ORDER BY created_at ASC`,
  },
  {
    key: "knowledgeGraphUnits",
    // NOTE: `embedding` is deliberately NOT selected.
    text:
      `SELECT id, domain_pack_id, source_id, unit_type, domain, text, payload, ` +
      `validation_status, validation_note, source_chunk_index, created_at ` +
      `FROM knowledge_graph_units WHERE workspace_id = $1 ORDER BY created_at ASC`,
  },
  {
    key: "knowledgeGraphRelations",
    text:
      `SELECT id, domain_pack_id, from_unit_id, to_unit_id, relation_type, payload, created_at ` +
      `FROM knowledge_graph_relations WHERE workspace_id = $1 ORDER BY created_at ASC`,
  },
  {
    key: "knowledgeGraphGroups",
    text:
      `SELECT id, domain_pack_id, name, summary, payload, created_at ` +
      `FROM knowledge_graph_groups WHERE workspace_id = $1 ORDER BY created_at ASC`,
  },
  {
    key: "knowledgeGraphGroupMembers",
    text:
      `SELECT id, group_id, unit_id, role, created_at ` +
      `FROM knowledge_graph_group_members WHERE workspace_id = $1 ORDER BY created_at ASC`,
  },
];

/** Build the parameterised graph-spine SELECTs for a workspace (pure; no DB access). */
export function buildGraphSpineSelects(workspaceId: string): (TxnQuery & { key: string })[] {
  if (!workspaceId) throw new Error("workspaceId required");
  return GRAPH_SPINE_EXPORT_SELECTS.map((s) => ({
    key: s.key,
    text: s.text,
    params: [workspaceId],
  }));
}

// ---------------------------------------------------------------------------
// Secret-leakage guard (defence in depth)
// ---------------------------------------------------------------------------

/**
 * Property names that must NEVER appear anywhere in the assembled export. If a
 * future neon.ts mapper or a graph payload starts surfacing one of these, the
 * export build fails loudly rather than shipping a secret to the user's download.
 */
export const FORBIDDEN_EXPORT_KEYS = [
  "keyHash",
  "key_hash",
  "credentialCiphertext",
  "credential_ciphertext",
  "credentialIv",
  "credential_iv",
  "credentialAuthTag",
  "credential_auth_tag",
  "secret_enc",
  "secretEnc",
  "rawKey",
  "apiKey",
  "password",
  "embedding",
] as const;

/**
 * Recursively scan a value for any forbidden (secret-shaped) property key. Returns
 * the dotted path of the first offender, or null if clean. Bounded by depth to
 * avoid pathological recursion on cyclic/huge structures.
 */
export function findForbiddenKey(value: unknown, path = "$", depth = 0): string | null {
  if (depth > 40 || value === null || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const hit = findForbiddenKey(value[i], `${path}[${i}]`, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if ((FORBIDDEN_EXPORT_KEYS as readonly string[]).includes(k)) {
      return `${path}.${k}`;
    }
    const hit = findForbiddenKey(v, `${path}.${k}`, depth + 1);
    if (hit) return hit;
  }
  return null;
}

/** Throw if the assembled archive contains any secret-shaped key (no-op when clean). */
export function assertNoSecretLeakage(archive: unknown): void {
  const offender = findForbiddenKey(archive);
  if (offender) {
    throw new Error(`account-export: forbidden secret-shaped key in archive at ${offender}`);
  }
}

// ---------------------------------------------------------------------------
// Archive shape
// ---------------------------------------------------------------------------

export interface AccountExportArchive {
  schemaVersion: string;
  generatedAt: string;
  gdpr: {
    article: "Art 20 (data portability)";
    pairedErasure: "Art 17 (right to erasure) — see the Reset to day-0 action";
    secretExclusionNote: string;
    externalStoreNote: string;
  };
  account: {
    userId: string;
    email: string | null;
    workspaceId: string;
    workspace: {
      name: string;
      slug: string;
      plan: string;
      createdAt: number;
    } | null;
  };
  settings: {
    emailPreferences: unknown | null;
  };
  // Provider-credential METADATA only (no ciphertext/plaintext).
  providerIntegrations: unknown[];
  // External graph-store CONNECTION config only (no secret; secret_set boolean).
  externalGraphStore: unknown | null;
  // Key METADATA only (prefix, label, last-used; never hash/raw).
  keys: {
    gatewayKeys: unknown[];
    managementKeys: unknown[];
  };
  projects: unknown[];
  routes: unknown[];
  policies: unknown[];
  policyBindings: unknown[];
  sources: {
    graphSources: unknown[];
    sourceDocuments: unknown[];
  };
  knowledgeGraph: {
    sources: unknown[];
    units: unknown[];
    relations: unknown[];
    groups: unknown[];
    groupMembers: unknown[];
  };
  counts: Record<string, number>;
}

export interface AssembleExportInput {
  workspaceId: string;
  userId: string;
  email: string | null;
}

/**
 * Assemble the portable archive for one account. READ-ONLY. The caller MUST have
 * already authenticated the session user, resolved `workspaceId` from that user
 * (owner_user_id), and verified same-origin. `sql` is passed in for the
 * graph-spine SELECTs; the reused neon.ts readers open their own connection
 * (same DATABASE_URL) — all reads are workspace/user scoped.
 *
 * A final `assertNoSecretLeakage()` pass guarantees no secret-shaped key escapes.
 */
export async function assembleAccountExport(
  sql: DbClient,
  input: AssembleExportInput,
): Promise<AccountExportArchive> {
  if (!input.workspaceId) throw new Error("workspaceId required");
  if (!input.userId) throw new Error("userId required");

  const { workspaceId, userId } = input;

  // --- Account-scoped reads via existing secret-safe readers -----------------
  const [
    workspace,
    projects,
    gatewayKeys,
    managementKeys,
    providerIntegrations,
    policies,
    policyBindings,
    graphSources,
    sourceDocuments,
    externalGraphStore,
    emailPreferences,
  ]: [
    Workspace | null,
    Awaited<ReturnType<typeof listProjectsByWorkspace>>,
    Awaited<ReturnType<typeof listApiKeysByWorkspace>>,
    Awaited<ReturnType<typeof listManagementKeys>>,
    Awaited<ReturnType<typeof listProviderIntegrations>>,
    Awaited<ReturnType<typeof listPolicies>>,
    Awaited<ReturnType<typeof listPolicyBindingsForWorkspace>>,
    Awaited<ReturnType<typeof listConnectGraphSourcesForWorkspace>>,
    Awaited<ReturnType<typeof listConnectSourceDocumentsForWorkspace>>,
    Awaited<ReturnType<typeof getWorkspaceGraphStoreConfigForUi>>,
    Awaited<ReturnType<typeof getPreferencesForUser>>,
  ] = await Promise.all([
    getWorkspace(workspaceId),
    listProjectsByWorkspace(workspaceId),
    listApiKeysByWorkspace(workspaceId),
    listManagementKeys(workspaceId),
    listProviderIntegrations(workspaceId),
    listPolicies(workspaceId),
    listPolicyBindingsForWorkspace(workspaceId),
    listConnectGraphSourcesForWorkspace(workspaceId),
    listConnectSourceDocumentsForWorkspace(workspaceId),
    getWorkspaceGraphStoreConfigForUi(workspaceId),
    getPreferencesForUser(userId),
  ]);

  // --- Per-project subtrees (routes, env, model + provider bindings) ---------
  // Each list reader is scoped to a project that we have already confirmed
  // belongs to THIS workspace (listProjectsByWorkspace), so no cross-account leak.
  const projectExports = await Promise.all(
    projects.map(async (p) => {
      const [environments, routes, modelBindings, providerBindings] = await Promise.all([
        listEnvironments(p.id, userId),
        listRoutes(p.id, userId),
        listProjectModelBindings(p.id),
        listProviderBindingsByProject(p.id),
      ]);
      return {
        id: p.id,
        name: p.name,
        workspaceId: p.workspaceId,
        createdAt: p.createdAt,
        isRestormelTesting: p.isRestormelTesting ?? false,
        environments,
        modelBindings,
        // provider bindings carry integration metadata only (mapper drops secrets)
        providerBindings,
        routeCount: routes.length,
      };
    }),
  );

  // Routes flattened across projects for a clean top-level "routes" array too.
  const allRoutes = (
    await Promise.all(projects.map((p) => listRoutes(p.id, userId)))
  ).flat();

  // --- Knowledge-graph spine (parameterised SELECTs; no embeddings) ----------
  const graphSelects = buildGraphSpineSelects(workspaceId);
  const graphResults = await Promise.all(graphSelects.map((s) => sql.query(s.text, s.params)));
  const graphByKey: Record<string, unknown[]> = {};
  graphSelects.forEach((s, i) => {
    graphByKey[s.key] = graphResults[i] ?? [];
  });

  const archive: AccountExportArchive = {
    schemaVersion: ACCOUNT_EXPORT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    gdpr: {
      article: "Art 20 (data portability)",
      pairedErasure: "Art 17 (right to erasure) — see the Reset to day-0 action",
      secretExclusionNote: SECRET_EXCLUSION_NOTE,
      externalStoreNote: EXTERNAL_STORE_EXPORT_NOTE,
    },
    account: {
      userId,
      email: input.email,
      workspaceId,
      workspace: workspace
        ? {
            name: workspace.name,
            slug: workspace.slug,
            plan: workspace.plan,
            createdAt: workspace.createdAt,
          }
        : null,
    },
    settings: {
      emailPreferences: emailPreferences ?? null,
    },
    providerIntegrations,
    externalGraphStore: externalGraphStore ?? null,
    keys: {
      gatewayKeys,
      managementKeys,
    },
    projects: projectExports,
    routes: allRoutes,
    policies,
    policyBindings,
    sources: {
      graphSources,
      sourceDocuments,
    },
    knowledgeGraph: {
      sources: graphByKey.knowledgeGraphSources ?? [],
      units: graphByKey.knowledgeGraphUnits ?? [],
      relations: graphByKey.knowledgeGraphRelations ?? [],
      groups: graphByKey.knowledgeGraphGroups ?? [],
      groupMembers: graphByKey.knowledgeGraphGroupMembers ?? [],
    },
    counts: {
      projects: projects.length,
      gatewayKeys: gatewayKeys.length,
      managementKeys: managementKeys.length,
      providerIntegrations: providerIntegrations.length,
      routes: allRoutes.length,
      policies: policies.length,
      graphSources: graphSources.length,
      sourceDocuments: sourceDocuments.length,
      knowledgeUnits: (graphByKey.knowledgeGraphUnits ?? []).length,
      knowledgeRelations: (graphByKey.knowledgeGraphRelations ?? []).length,
      knowledgeGroups: (graphByKey.knowledgeGraphGroups ?? []).length,
    },
  };

  // Defence in depth: refuse to ship the archive if anything secret-shaped slipped in.
  assertNoSecretLeakage(archive);

  return archive;
}
