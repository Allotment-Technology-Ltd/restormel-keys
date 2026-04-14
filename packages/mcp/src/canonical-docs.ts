/** Topic ids for {@link resolveCanonicalDoc}. */
export type CanonicalDocTopic =
  | "keys_routing_contract"
  | "horizon_programme"
  | "theme_l_ia_matrix"
  | "restormel_state"
  | "context_packs"
  | "phase1_platform_spec"
  | "environment_vocabulary"
  | "testing_oss_consumption"
  | "npm_packages_reference"
  | "graph_integration_sveltekit"
  | "mcp_runbook"
  | "zuplo_setup"
  | "testing_schema_policy"
  | "dogfood_runbook";

export type CanonicalDocEntry = {
  topic: CanonicalDocTopic;
  title: string;
  /** Repo-relative path from monorepo root. */
  repoPath: string;
  /** Primary human-facing URL on restormel.dev when applicable. */
  publicUrl?: string;
};

const ENTRIES: Record<CanonicalDocTopic, Omit<CanonicalDocEntry, "topic">> = {
  keys_routing_contract: {
    title: "Keys routing contract (SOPHIA-class workloads)",
    repoPath: "docs/keys-routing-contract.md",
    publicUrl: "https://restormel.dev/keys/docs/guides/routing-contract",
  },
  horizon_programme: {
    title: "Horizon platform programme",
    repoPath: "docs/restormel/HORIZON-PLATFORM-PROGRAMME.md",
  },
  theme_l_ia_matrix: {
    title: "Theme L IA matrix",
    repoPath: "docs/restormel/THEME-L-IA-MATRIX.md",
  },
  restormel_state: {
    title: "Restormel State",
    repoPath: "docs/restormel/RESTORMEL-STATE.md",
    publicUrl: "https://restormel.dev/graph/docs/extensions/state",
  },
  context_packs: {
    title: "Context packs extraction status",
    repoPath: "docs/restormel/PHASE2-EXTRACTION-STATUS.md",
  },
  phase1_platform_spec: {
    title: "Phase 1 platform engineering spec",
    repoPath: "docs/restormel/phase1-restormel-engineering-spec.md",
  },
  environment_vocabulary: {
    title: "RESTORMEL_* environment vocabulary",
    repoPath: "docs/guides/restormel-environment-vocabulary.md",
    publicUrl: "https://restormel.dev/keys/docs/guides/environment-vocabulary",
  },
  testing_oss_consumption: {
    title: "Restormel Testing OSS consumption",
    repoPath: "docs/testing/oss-consumption.md",
    publicUrl: "https://restormel.dev/testing/docs",
  },
  npm_packages_reference: {
    title: "npm packages reference",
    repoPath: "docs/reference/npm-packages.md",
  },
  graph_integration_sveltekit: {
    title: "Integrate Restormel Graph in SvelteKit",
    repoPath: "docs/restormel-graph-sophia-consumer.md",
    publicUrl: "https://restormel.dev/graph/docs/integration/sveltekit",
  },
  mcp_runbook: {
    title: "MCP implementation workflow",
    repoPath: "docs/runbooks/mcp-implementation-workflow.md",
  },
  zuplo_setup: {
    title: "Zuplo gateway setup",
    repoPath: "docs/runbooks/zuplo-setup.md",
  },
  testing_schema_policy: {
    title: "Testing schema stability policy",
    repoPath: "docs/testing/schema-stability-policy.md",
  },
  dogfood_runbook: {
    title: "Dogfood issue implementation",
    repoPath: "docs/runbooks/restormel-dogfood-issue-implementation.md",
  },
};

export const CANONICAL_DOC_TOPICS = Object.keys(ENTRIES) as CanonicalDocTopic[];

export function resolveCanonicalDoc(topic: string):
  | { ok: true; entry: CanonicalDocEntry }
  | { ok: false; code: "RST_SUITE_UNKNOWN_TOPIC"; message: string } {
  if (!isCanonicalDocTopic(topic)) {
    return {
      ok: false,
      code: "RST_SUITE_UNKNOWN_TOPIC",
      message: `Unknown topic "${topic}". Valid: ${CANONICAL_DOC_TOPICS.join(", ")}.`,
    };
  }
  const e = ENTRIES[topic];
  return { ok: true, entry: { topic, title: e.title, repoPath: e.repoPath, publicUrl: e.publicUrl } };
}

function isCanonicalDocTopic(s: string): s is CanonicalDocTopic {
  return s in ENTRIES;
}
