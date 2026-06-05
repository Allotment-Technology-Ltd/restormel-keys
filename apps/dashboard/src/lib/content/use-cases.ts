export type UseCaseCategory = "professional" | "hobby";

export type UseCaseColor = "amber" | "teal" | "coral" | "blue" | "purple" | "green";

export type UseCase = {
  id: string;
  category: UseCaseCategory;
  title: string;
  tagline: string;
  audience: string;
  corpus: string[];
  starterPrompt: string;
  exampleQueries: string[];
  graphShape: {
    nodeTypes: string[];
    edgeTypes: string[];
  };
  icon: string;
  color: UseCaseColor;
};

export const USE_CASES: UseCase[] = [
  {
    id: "engineering-knowledge",
    category: "professional",
    title: "Engineering knowledge",
    tagline: "Your agent knows why the codebase is the way it is—not just what files exist.",
    audience: "engineering teams and platform leads",
    corpus: [
      "internal ADRs and RFCs",
      "Confluence or Notion architecture pages",
      "onboarding runbooks",
      "service READMEs and dependency diagrams",
      "postmortems and design review notes",
    ],
    starterPrompt:
      "Build a graph for our internal engineering corpus. Capture architectural decisions, the rationale behind them, dependencies between services, and assumptions that would surprise a new hire. Unit types should include decision, constraint, component, and risk. Relations should trace supports, supersedes, depends_on, and contradicts between decisions—not just file mentions.",
    exampleQueries: [
      "Which ADRs still justify our event bus choice after the 2024 scale incident?",
      "What services depend on the auth migration we deferred—and what breaks if we slip the date?",
      "Where do onboarding docs disagree with the current deployment model?",
    ],
    graphShape: {
      nodeTypes: ["decision", "constraint", "component", "risk", "assumption", "runbook"],
      edgeTypes: ["supports", "supersedes", "depends_on", "contradicts", "documents"],
    },
    icon: "Cpu",
    color: "blue",
  },
  {
    id: "competitive-intelligence",
    category: "professional",
    title: "Competitive intelligence",
    tagline: "Track what competitors are doing—and why it matters to your positioning.",
    audience: "product strategy and GTM teams",
    corpus: [
      "SEC filings and earnings transcripts",
      "press releases and product changelogs",
      "job postings by function and seniority",
      "analyst interviews and conference talks",
      "pricing and packaging pages over time",
    ],
    starterPrompt:
      "Model a competitive intelligence graph for our market. Nodes should represent companies, product moves, hiring signals, pricing changes, and strategic themes. Capture when a move supports or undermines a stated positioning claim, and link hiring bursts to likely capability bets. I need traceable sources on every edge for board-ready briefings.",
    exampleQueries: [
      "Which competitors shifted enterprise messaging in the last two quarters while cutting mid-market hiring?",
      "What product launches cite AI agents—and do their job postings match the story?",
      "Where did pricing page changes precede a funding round or acquisition rumor?",
    ],
    graphShape: {
      nodeTypes: ["company", "product_move", "hiring_signal", "pricing_change", "theme", "claim"],
      edgeTypes: ["announced", "signals_capability", "undermines", "supports", "precedes"],
    },
    icon: "TrendingUp",
    color: "teal",
  },
  {
    id: "compliance-corpus",
    category: "professional",
    title: "Compliance corpus",
    tagline: "High-stakes answers with citations attached—verification is the product.",
    audience: "legal, compliance, and risk teams",
    corpus: [
      "regulatory texts and guidance notes",
      "internal policies and control matrices",
      "case law summaries and enforcement actions",
      "audit findings and remediation trackers",
      "vendor due-diligence questionnaires",
    ],
    starterPrompt:
      "Design a compliance knowledge graph where every answer must cite primary sources. Capture obligations, controls, exceptions, jurisdictions, and how internal policy maps to external regulation. Relations should include requires, exempts, cites_regulation, and conflicts_with. Prioritize provenance and validation states suitable for audit replay.",
    exampleQueries: [
      "Which internal controls map to GDPR Article 30—and where is our policy silent?",
      "What enforcement actions in our sector changed interpretation of vendor subprocessors?",
      "Which remediation items from last audit still lack a linked regulatory citation?",
    ],
    graphShape: {
      nodeTypes: ["obligation", "control", "regulation", "exception", "jurisdiction", "finding"],
      edgeTypes: ["requires", "exempts", "cites_regulation", "implements", "conflicts_with"],
    },
    icon: "Scale",
    color: "purple",
  },
  {
    id: "research-literature",
    category: "professional",
    title: "Research literature",
    tagline: "Query a field for evidence and relationships—not isolated paper summaries.",
    audience: "researchers and R&D teams",
    corpus: [
      "peer-reviewed papers (PDF/HTML)",
      "patent filings in a defined IPC class",
      "technical standards and errata",
      "systematic review tables",
      "lab notebooks and protocol registries",
    ],
    starterPrompt:
      "Build a literature graph for our research domain. Represent studies, methods, datasets, findings, and limitations as typed units grouped by topic. Relations must include replicates, contradicts, extends, and uses_method. Surface contradictions between sources explicitly—I need to see methodological disagreements, not a single consensus paragraph.",
    exampleQueries: [
      "Which papers dispute the effect size reported in our 2022 benchmark—and on what methodological grounds?",
      "What standards changed test requirements after the safety recall literature?",
      "Which patents cite the same prior art but claim orthogonal applications?",
    ],
    graphShape: {
      nodeTypes: ["study", "method", "dataset", "finding", "limitation", "standard"],
      edgeTypes: ["replicates", "contradicts", "extends", "uses_method", "cites"],
    },
    icon: "Microscope",
    color: "green",
  },
  {
    id: "product-support-knowledge",
    category: "professional",
    title: "Product support knowledge",
    tagline: "Version-aware support answers grounded in docs, issues, and resolutions.",
    audience: "customer support and developer relations",
    corpus: [
      "product documentation by version",
      "changelog and release notes",
      "known-issue databases",
      "support ticket exports (redacted)",
      "internal troubleshooting playbooks",
    ],
    starterPrompt:
      "Create a support knowledge graph linking features, versions, known issues, workarounds, and resolutions. Capture feature dependencies and breaking changes across releases. Relations should include affects_version, fixed_in, workaround_for, and duplicates. Agents must not answer without tying guidance to a specific version band.",
    exampleQueries: [
      "Is the SSO timeout bug still open in 4.2.x—and what workaround did we publish for enterprise tenants?",
      "Which features depend on the deprecated Events API removed in v5?",
      "What tickets cluster around migration failures after the Postgres driver bump?",
    ],
    graphShape: {
      nodeTypes: ["feature", "version", "known_issue", "workaround", "resolution", "symptom"],
      edgeTypes: ["affects_version", "fixed_in", "workaround_for", "depends_on", "duplicates"],
    },
    icon: "LifeBuoy",
    color: "coral",
  },
  {
    id: "mythology-pantheons",
    category: "hobby",
    title: "Mythology pantheons",
    tagline: "Ask across world mythology what no single epic or textbook reveals alone.",
    audience: "readers who cross-reference Theogony, Eddas, epics, and metamorphosis cycles",
    corpus: [
      "Hesiod's Theogony (translated)",
      "Snorri's Prose Edda",
      "Ovid's Metamorphoses",
      "Mahabharata divine genealogy passages",
      "comparative myth commentaries",
    ],
    starterPrompt:
      "Build a comparative mythology graph across Greek, Norse, and Indic sources. Represent deities, heroes, transformations, genealogies, and cult epithets. Capture parallel roles (sky father, trickster, death-and-rebirth) with relates_to and transforms_into edges—always with source passage provenance, not modern fan synthesis.",
    exampleQueries: [
      "Which figures combine trickster and culture-bringer traits across Norse and Greek sources?",
      "Where do transformation myths share a river-or-death motif between Ovid and Mahabharata episodes?",
      "Which parent-child conflicts repeat with different moral framing in Theogony vs Edda?",
    ],
    graphShape: {
      nodeTypes: ["deity", "hero", "transformation", "genealogy", "epithet", "motif"],
      edgeTypes: ["parent_of", "transforms_into", "parallel_role", "appears_in", "contradicts_source"],
    },
    icon: "Sparkles",
    color: "amber",
  },
  {
    id: "music-genealogy",
    category: "hobby",
    title: "Music genealogy",
    tagline: "Trace influence chains and the hidden wiring of a genre or era.",
    audience: "obsessive record collectors and music journalists",
    corpus: [
      "liner notes and session credits",
      "artist interviews (magazines, podcasts)",
      "genre histories and label discographies",
      "AllMusic-style influence graphs (licensed export)",
      "equipment and studio technique articles",
    ],
    starterPrompt:
      "Model a music influence graph for my chosen genre and era. Nodes: artists, recordings, labels, scenes, techniques, and gear. Edges: influenced_by, samples, mentors, shares_sideman, and popularizes_technique. I want to query hidden bridges—two artists linked through a third session player—not just Wikipedia infoboxes.",
    exampleQueries: [
      "Which dub engineers connect reggae producers to post-punk bands through shared studios?",
      "What two seemingly unrelated artists share a backing vocalist on deep cuts only?",
      "How did a drum machine model jump from electro to industrial via one remix chain?",
    ],
    graphShape: {
      nodeTypes: ["artist", "recording", "label", "scene", "technique", "gear"],
      edgeTypes: ["influenced_by", "samples", "mentors", "shares_sideman", "popularizes"],
    },
    icon: "Music",
    color: "teal",
  },
  {
    id: "evolutionary-biology",
    category: "hobby",
    title: "Evolutionary biology",
    tagline: "David Attenborough as a queryable knowledge graph.",
    audience: "natural history enthusiasts and biology students",
    corpus: [
      "taxonomic databases (CSV export)",
      "field guide descriptions",
      "natural history essays",
      "peer-reviewed ecology papers",
      "paleo-climate summaries for ranges",
    ],
    starterPrompt:
      "Construct an evolutionary biology graph linking species, traits, habitats, selective pressures, and fossil evidence. Use relations: adapts_to, competes_with, shares_trait, and diverged_from. Group by clade and biome so I can ask why a trait appears in unrelated lineages—convergent evolution with cited mechanisms.",
    exampleQueries: [
      "Which desert mammals evolved similar water-retention traits without recent common ancestry?",
      "What selective pressures co-occur with burrowing in unrelated taxa?",
      "Which field-guide descriptions contradict the latest phylogeny for this family?",
    ],
    graphShape: {
      nodeTypes: ["species", "trait", "habitat", "pressure", "fossil", "clade"],
      edgeTypes: ["adapts_to", "competes_with", "shares_trait", "diverged_from", "exhibits"],
    },
    icon: "Leaf",
    color: "green",
  },
  {
    id: "historical-conflict",
    category: "hobby",
    title: "Historical conflict",
    tagline: "Patterns across a century that linear reading hides.",
    audience: "history readers working from primary sources",
    corpus: [
      "diplomatic correspondence collections",
      "economic histories and trade statistics",
      "campaign accounts and memoirs",
      "treaty texts and border commissions",
      "newspaper archives for flashpoints",
    ],
    starterPrompt:
      "Build a historical conflict graph for my period. Represent nations, leaders, treaties, grievances, economic shocks, and military campaigns. Edges: caused_by, ratified, violated, allied_with, and escalated_to. I need causal chains with dated evidence—not a single victor's narrative.",
    exampleQueries: [
      "Which treaty clauses reappear before three separate border wars in this region?",
      "What economic shocks preceded coups that textbooks treat as unrelated?",
      "Where do primary sources disagree on who breached the armistice first?",
    ],
    graphShape: {
      nodeTypes: ["nation", "leader", "treaty", "grievance", "campaign", "shock"],
      edgeTypes: ["caused_by", "ratified", "violated", "allied_with", "escalated_to"],
    },
    icon: "Landmark",
    color: "coral",
  },
  {
    id: "plant-foraging",
    category: "hobby",
    title: "Plant foraging",
    tagline: "A lifetime forager's knowledge—queryable in an afternoon.",
    audience: "foragers and ethnobotany readers",
    corpus: [
      "regional field guides",
      "ethnobotanical records",
      "foraging literature and safety notes",
      "pollinator and habitat surveys",
      "seasonal phenology calendars",
    ],
    starterPrompt:
      "Create a foraging knowledge graph with species, habitats, seasons, edible uses, look-alike risks, and pollinator partners. Relations: grows_in, confused_with, harvest_in_season, and traditional_use. Safety warnings must be first-class nodes linked to species—not footnotes.",
    exampleQueries: [
      "Which spring ephemerals share habitat with a toxic look-alike in my biome?",
      "What pollinators co-occur with plants used for the same traditional preparation?",
      "Where do two field guides disagree on edibility for the same Latin name?",
    ],
    graphShape: {
      nodeTypes: ["species", "habitat", "season", "use", "lookalike", "pollinator"],
      edgeTypes: ["grows_in", "confused_with", "harvest_in_season", "traditional_use", "supports"],
    },
    icon: "Sprout",
    color: "green",
  },
  {
    id: "author-deep-canon",
    category: "hobby",
    title: "Author deep canon",
    tagline: "The graph a devoted reader carries in their head—made explicit.",
    audience: "close readers of a single author’s complete works",
    corpus: [
      "complete novels and story collections",
      "essays and letters",
      "author interviews",
      "critical editions with footnotes",
      "publisher chronologies",
    ],
    starterPrompt:
      "Map one author's full canon—not a fandom wiki. Capture themes, recurring images, character archetypes, structural patterns, and stated influences. Relations: echoes, subverts, renames, and cites_in_interview. Depth over breadth: every node must trace to a specific work and passage.",
    exampleQueries: [
      "Which minor characters reappear under different names but share a moral test pattern?",
      "What imagery first appears in early essays and returns in the late novels transformed?",
      "Where does the author contradict an earlier interview claim inside later fiction?",
    ],
    graphShape: {
      nodeTypes: ["work", "theme", "image", "character", "pattern", "influence"],
      edgeTypes: ["echoes", "subverts", "renames", "cites_in_interview", "appears_in"],
    },
    icon: "BookOpen",
    color: "purple",
  },
  {
    id: "culinary-history",
    category: "hobby",
    title: "Culinary history",
    tagline: "What cuisines share across geography and time—not just recipe lists.",
    audience: "food history and flavor-pairing enthusiasts",
    corpus: [
      "culinary history texts",
      "regional cookbooks",
      "food science papers",
      "flavour-pairing research datasets",
      "trade-route and migration histories",
    ],
    starterPrompt:
      "Build a culinary history graph: ingredients, techniques, dishes, cultures, migrations, and flavor compounds. Relations: migrates_via, technique_shared, pairs_with, and ritual_context. Explain cross-cultural technique transfer with dated sources—not modern fusion blog assumptions.",
    exampleQueries: [
      "Which fermentation techniques traveled along the same trade route as a spice but in different centuries?",
      "What dishes share a technique name but diverge in acid source between regions?",
      "Where does food science contradict a traditional pairing repeated in three cookbooks?",
    ],
    graphShape: {
      nodeTypes: ["ingredient", "technique", "dish", "culture", "migration", "compound"],
      edgeTypes: ["migrates_via", "technique_shared", "pairs_with", "ritual_context", "derives_from"],
    },
    icon: "UtensilsCrossed",
    color: "amber",
  },
  {
    id: "world-building-lore",
    category: "hobby",
    title: "World-building lore",
    tagline: "Canon-checking, lore-querying graph for your fictional world.",
    audience: "writers and GMs curating primary canon only",
    corpus: [
      "manuscripts and bible documents",
      "published appendices",
      "author letters and sanctioned reference texts",
      "maps with dated revisions",
      "fan wikis only when flagged secondary",
    ],
    starterPrompt:
      "Create a canon-only lore graph for my fictional world. Nodes: characters, locations, events, artifacts, languages, and laws. Edges: participates_in, rules, contradicts_primary, and version_of_manuscript. Secondary fan sources must be tagged unreliable unless corroborated by primary text.",
    exampleQueries: [
      "Which timeline entries conflict between the 2nd-edition appendix and the author's letter?",
      "What artifacts appear in two eras without an in-world explanation in primary sources?",
      "Who shares a patron deity across regions but with incompatible taboos?",
    ],
    graphShape: {
      nodeTypes: ["character", "location", "event", "artifact", "language", "law"],
      edgeTypes: ["participates_in", "rules", "contradicts_primary", "version_of", "corroborates"],
    },
    icon: "Castle",
    color: "blue",
  },
];

const USE_CASE_IDS = new Set(USE_CASES.map((u) => u.id));

export function isUseCaseId(id: string): id is UseCase["id"] {
  return USE_CASE_IDS.has(id);
}

export function getUseCaseById(id: string): UseCase | undefined {
  return USE_CASES.find((u) => u.id === id);
}

export const professionalUseCases = USE_CASES.filter((u) => u.category === "professional");

export const hobbyUseCases = USE_CASES.filter((u) => u.category === "hobby");

/** Homepage teaser ids — single source for marketing grid. */
export const HOMEPAGE_USE_CASE_IDS = [
  "engineering-knowledge",
  "compliance-corpus",
  "competitive-intelligence",
  "mythology-pantheons",
  "music-genealogy",
  "author-deep-canon",
] as const satisfies readonly UseCase["id"][];

export function useCasesByIds(ids: readonly string[]): UseCase[] {
  return ids.map((id) => getUseCaseById(id)).filter((u): u is UseCase => u !== undefined);
}

export const PENDING_TEMPLATE_STORAGE_KEY = "pending_template";

export const CONNECT_TEMPLATE_PILLS_DISMISSED_KEY = "connect_template_pills_dismissed";
