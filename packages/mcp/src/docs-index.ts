/**
 * Static doc index for docs.search — no network I/O, fast cold path.
 * URLs are dashboard docs paths (served under /keys/docs/…).
 */

export type DocIndexEntry = {
  title: string;
  url: string;
  /** Lowercased keywords for matching */
  keywords: string[];
  section: string;
};

export const DOC_INDEX: DocIndexEntry[] = [
  {
    title: "Integrations overview",
    url: "/keys/docs/integrations",
    keywords: ["integrations", "overview", "cli", "mcp", "aaif", "developer"],
    section: "integrations",
  },
  {
    title: "MCP (Model Context Protocol)",
    url: "/keys/docs/integrations/mcp",
    keywords: [
      "mcp",
      "model context protocol",
      "tools",
      "agent",
      "ide",
      "cursor",
      "claude",
      "restormel_evaluate_url",
      "restormel_control_plane_url",
      "gateway key",
      "policy evaluate",
      "server-side",
    ],
    section: "mcp",
  },
  {
    title: "MCP implementation workflow (runbook)",
    url: "https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/docs/runbooks/mcp-implementation-workflow.md",
    keywords: ["mcp", "runbook", "restormel_evaluate_url", "control plane", "entitlements", "stdio", "environment"],
    section: "mcp",
  },
  {
    title: "CLI quickstart",
    url: "/keys/docs/integrations/cli",
    keywords: ["cli", "keys", "terminal", "init", "add", "estimate", "routing"],
    section: "cli",
  },
  {
    title: "AAIF overview",
    url: "/keys/docs/integrations/aaif",
    keywords: ["aaif", "contract", "structured", "ai interaction", "routingContext", "resolve"],
    section: "aaif",
  },
  {
    title: "Routing contract (Keys + SOPHIA)",
    url: "/keys/docs/guides/routing-contract",
    keywords: [
      "routing",
      "resolve",
      "stepChain",
      "simulate",
      "export",
      "import",
      "explain_chain",
      "gitops",
      "ingestion",
      "workload",
      "stage",
      "sophia",
      "fallback",
      "mcp",
      "routing.capabilities",
      "routing.export",
      "routing.import",
      "routing.explain_chain",
    ],
    section: "guides",
  },
  {
    title: "Integrations walkthrough — index",
    url: "/keys/docs/integrations-walkthrough",
    keywords: ["walkthrough", "onboarding", "phases", "prompts"],
    section: "walkthrough",
  },
  {
    title: "Integrations walkthrough — Phase 3 MCP",
    url: "/keys/docs/integrations-walkthrough/05-phase-3-mcp",
    keywords: ["mcp", "phase 3", "install", "schemas", "server"],
    section: "walkthrough",
  },
  {
    title: "Security baseline",
    url: "/keys/docs/security-baseline",
    keywords: ["security", "keys", "logging", "secrets", "redaction"],
    section: "security",
  },
  {
    title: "npm packages reference",
    url: "/keys/docs/reference/npm-packages",
    keywords: ["npm", "install", "packages", "keys", "doctor", "cli"],
    section: "reference",
  },
  {
    title: "Framework compatibility",
    url: "/keys/docs/compatibility",
    keywords: ["framework", "next", "svelte", "react", "astro"],
    section: "compatibility",
  },
];

function normalize(q: string): string {
  return q.trim().toLowerCase();
}

/**
 * Ranked search over the static index. Returns top `limit` results.
 */
export function searchDocs(query: string, section?: string, limit = 8): DocIndexEntry[] {
  const q = normalize(query);
  if (!q) return [];

  const tokens = q.split(/\s+/).filter(Boolean);
  const sec = section?.trim().toLowerCase();

  const scored = DOC_INDEX.filter((e) => !sec || e.section === sec || e.keywords.some((k) => k.includes(sec))).map(
    (e) => {
      let score = 0;
      const hay = `${e.title} ${e.keywords.join(" ")}`.toLowerCase();
      if (hay.includes(q)) score += 10;
      for (const t of tokens) {
        if (e.title.toLowerCase().includes(t)) score += 4;
        if (e.keywords.some((k) => k.includes(t))) score += 2;
        if (hay.includes(t)) score += 1;
      }
      return { e, score };
    },
  );

  return scored
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ e }) => e);
}
