/**
 * Featured proof point for Connect / Founders marketing — SOPHIA public product (usesophia.app).
 * Not a Connect pipeline template. Graph stats optional when Surreal audit is refreshed.
 * statsAsOf documents the last operator refresh (ISO date).
 */
export type SophiaShowcaseStats = {
  /** claim + argument + passage + thinker (SOPHIA Surreal tables) */
  nodes: number;
  /** supports, contradicts, depends_on, responds_to, defines, qualifies (+ legacy refines, exemplifies) */
  edges: number;
  /** claim.verification_state = 'validated' */
  verified: number;
};

export type SophiaShowcase = {
  title: string;
  subtitle: string;
  description: string;
  /** What the live app offers (Learn, Stoa, formative writing feedback). */
  pillars: { label: string; detail: string }[];
  stats: SophiaShowcaseStats;
  /** ISO date when stats were last refreshed from production/staging Surreal */
  statsAsOf: string;
  builderNote: string;
  href: string;
};

/** Operator refresh: SOPHIA `pnpm exec tsx` kg audit counts when Surreal env is available. */
export const SOPHIA_SHOWCASE: SophiaShowcase = {
  title: "SOPHIA",
  subtitle: "Daily philosophy practice & honest writing feedback",
  description:
    "SOPHIA is a student-facing philosophy app: bite-sized lessons and drills in Learn, a Stoic-inspired mentor and private journal in Stoa, and formative feedback on essays you wrote yourself — not a chatbot that replaces your work. Optional Inquire runs a deeper three-pass reasoning view for power users.",
  pillars: [
    {
      label: "Learn",
      detail: "Structured lessons on logic, ethics, and argumentation with daily drills — build reasoning skill in short sessions.",
    },
    {
      label: "Stoa",
      detail: "Reflect with a calm text or voice mentor, keep a private journal, and use behavioural-activation prompts — wellbeing support, not homework automation.",
    },
    {
      label: "Your writing",
      detail: "Submit answers or essays you authored; get source-aware formative review (analysis, critique, synthesis) — never a replacement draft.",
    },
  ],
  stats: {
    nodes: 0,
    edges: 0,
    verified: 0,
  },
  statsAsOf: "2026-06-04",
  builderNote:
    "We built SOPHIA as Restormel’s public proof that serious knowledge products can coach thinking instead of outsourcing it. Connect dogfoods the graph stack behind the scenes; the app you see on usesophia.app is Learn, Stoa, and honest essay feedback.",
  href: "https://usesophia.app",
};

/** True when operator has refreshed stats from Surreal (non-zero or explicit override). */
export function sophiaStatsReady(stats: SophiaShowcaseStats): boolean {
  return stats.nodes > 0 || stats.edges > 0 || stats.verified > 0;
}
