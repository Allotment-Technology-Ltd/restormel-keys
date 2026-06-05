/** Copy for progressive-disclosure glossary on Connect graph review (/connect/graph). */

export type GraphGlossaryEntry = {
  term: string;
  description: string;
};

export type GraphGlossarySection = {
  id: string;
  title: string;
  entries: GraphGlossaryEntry[];
};

export function buildGraphReviewGlossarySections(options?: {
  includeRevalidate?: boolean;
}): GraphGlossarySection[] {
  const includeRevalidate = options?.includeRevalidate ?? false;

  const sections: GraphGlossarySection[] = [
    {
      id: "stats",
      title: "Graph overview",
      entries: [
        {
          term: "Ideas",
          description:
            "Atomic claims or facts extracted from your sources — the units agents can retrieve and validate.",
        },
        {
          term: "Connections",
          description:
            "Directed links between ideas (for example supports, contradicts, or part-of) defined by your domain pack.",
        },
        {
          term: "Groups",
          description:
            "Named clusters of related ideas (themes, arguments, or sections) to organize the graph for humans and agents.",
        },
        {
          term: "Embedded",
          description:
            "Ideas that have a vector embedding stored — required for semantic search and MCP connect.search.",
        },
      ],
    },
    {
      id: "validation",
      title: "Validation statuses",
      entries: [
        {
          term: "Supported",
          description:
            "The AI judged this idea faithful to its source (fair paraphrase or grounded inference). Safe default for retrieval.",
        },
        {
          term: "Weak",
          description:
            "Overstated, missing qualification, or only loosely tied to the source — review before trusting in agent answers.",
        },
        {
          term: "Unsupported",
          description:
            "Contradicts the source or adds claims with no basis — high risk of hallucination if retrieved.",
        },
        {
          term: "Unchecked",
          description:
            "Not validated yet (ingest skipped validation or re-validation pending). Treat as unknown quality.",
        },
        {
          term: "Flagged (filter)",
          description:
            "AI weak or unsupported ideas you have not triaged yet — leaves the queue after you save a verdict.",
        },
      ],
    },
    {
      id: "filters",
      title: "Review queue filters",
      entries: [
        {
          term: "Flagged",
          description:
            "Ideas the AI marked weak or unsupported that you have not reviewed yet. Confirming or changing the verdict removes them from this queue.",
        },
        {
          term: "All ideas",
          description: "Every loaded idea regardless of validation status.",
        },
        {
          term: "Supported / Weak / Unsupported / Unchecked",
          description: "Narrows the list to a single validation status.",
        },
      ],
    },
    {
      id: "detail",
      title: "Idea detail & tags",
      entries: [
        {
          term: "AI validation note",
          description: "Short explanation from the validation model for its verdict on this idea.",
        },
        {
          term: "Unit type / domain",
          description: "Optional pack-specific labels (for example claim type or subject area) from extraction.",
        },
        {
          term: "Provenance",
          description:
            "Where the idea came from — author (if linked), source title or URL, and how the document was ingested.",
        },
        {
          term: "Source kind",
          description: "How the document entered Connect: pasted text, uploaded file, or fetched URL.",
        },
      ],
    },
    {
      id: "actions",
      title: "Your review actions",
      entries: [
        {
          term: "Approve · supported",
          description: "Sets status to supported — you agree the idea is good for the graph.",
        },
        {
          term: "Mark weak / Mark unsupported",
          description: "Overrides the AI verdict when you disagree with its assessment.",
        },
        {
          term: "Remove from graph",
          description:
            "Deletes the idea from your store so agents never retrieve it (for example true but off-topic content).",
        },
      ],
    },
  ];

  if (includeRevalidate) {
    sections.push({
      id: "auto-remediate",
      title: "Auto-remediation",
      entries: [
        {
          term: "Quarantine scope",
          description:
            "Re-validates weak and unsupported ideas awaiting human triage, then attempts repair or drop before you review survivors.",
        },
        {
          term: "Validation route",
          description:
            "Which Keys ingestion route checks each idea against its source (workspace default or a dedicated validation route).",
        },
        {
          term: "Remediation route",
          description:
            "Which route repairs or drops ideas still flagged after validation. Prefer routes with fallback steps when models rate-limit or time out.",
        },
        {
          term: "Preview-only source text",
          description:
            "When full documents are missing, remediation uses short previews only — link sources in Pipeline → Sources first for reliable repairs.",
        },
      ],
    });
  }

  return sections;
}
