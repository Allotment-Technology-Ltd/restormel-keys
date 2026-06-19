/**
 * Connect pipeline SPINE — the five-stage "where am I / what's next" ledger
 * (review §4 / Phase 2 keystone).
 *
 * ONE persistent model shown on every Connect surface so the journey is
 * continuous. It does NOT introduce a new backend: every stage's state is
 * DERIVED from signals the surfaces already load —
 *   ① Connect    ← verified-readiness ledger (connect-hub-load setupHealth)
 *   ② Ingest     ← latest job + run count + store/docs
 *   ③ Make ready ← graph stats: embedded/units + unchecked (unvalidated)
 *   ④ Review     ← graph stats: flagged-awaiting-triage count
 *   ⑤ Go live    ← stage routes published (readiness.models) + graph has units
 *
 * Principles (review §4): exactly ONE primary CTA per stage; state is ALWAYS
 * visible (never hidden); every CTA is honest — disabled WITH a reason whenever
 * it cannot act, never clickable-but-inert.
 *
 * Client-safe: pure types + builder only, no server imports. The server side
 * assembles `ConnectSpineSignals` from the readiness compute + graph stats.
 */

import {
  CLAIMS_HREF,
  INGEST_FLOW_HREF,
  INGEST_ROUTES_HREF,
  RUNS_HREF,
} from "$lib/nav-config";

export type ConnectSpineStageId = "connect" | "ingest" | "make_ready" | "review" | "go_live";

/**
 * A stage's lifecycle state.
 *  - `done`     — nothing left to do here; the stage is satisfied.
 *  - `current`  — this is the one stage the user should act on now.
 *  - `todo`     — work remains but an earlier stage gates it (shown, not actionable yet).
 *  - `blocked`  — a hard precondition is missing (with a visible reason).
 *  - `unknown`  — the deriving signal was unavailable on this surface (honest, never faked).
 */
export type ConnectSpineStageState = "done" | "current" | "todo" | "blocked" | "unknown";

export type ConnectSpineCta = {
  label: string;
  href: string;
  /** Disabled-with-reason: render the CTA inert AND show `disabledReason`. Never clickable-inert. */
  disabled: boolean;
  /** Why the CTA is disabled — surfaced as visible text + `title`. Null when enabled. */
  disabledReason: string | null;
};

export type ConnectSpineStage = {
  id: ConnectSpineStageId;
  /** 1-based position for the ① ② ③ ④ ⑤ numeral. */
  index: number;
  /** Mono uppercase label, e.g. "MAKE READY". */
  label: string;
  /** One-line "what this stage is". */
  blurb: string;
  state: ConnectSpineStageState;
  /** Short status receipt, e.g. "842 unchecked" / "done" / "12 to review". */
  summary: string;
  /** Exactly ONE primary action per stage (honest disable). */
  cta: ConnectSpineCta;
  /** True when this is the highlighted current stage. */
  isCurrent: boolean;
};

export type ConnectSpine = {
  stages: ConnectSpineStage[];
  /** The stage the user should act on now (first non-done), or null when all done. */
  currentStageId: ConnectSpineStageId | null;
  /** Done count for the spine chip, e.g. "3/5". */
  done: number;
  total: number;
  checkedAt: string;
};

/**
 * Everything the pure builder needs. Every field is optional/nullable so a
 * surface that does not load a particular signal yields an HONEST `unknown`
 * state for that stage rather than a fabricated one.
 */
export type ConnectSpineSignals = {
  /** ① Connect — the verified-readiness ledger summary (see verified-readiness.ts). */
  readiness:
    | {
        status: "ok" | "warn" | "fail";
        ready: number;
        total: number;
        /** First non-ok row's repair link + label, for the Connect CTA. */
        firstGap: { label: string; fixHref: string | null; fixLabel: string | null } | null;
        /** Stage-route sub-signals — published chat + embedding routes. */
        models: { modelsReady: boolean; hasChatRoute: boolean; hasEmbeddingRoute: boolean };
      }
    | null;

  /** ② Ingest — run history + latest job + store/docs prerequisites. */
  ingest:
    | {
        jobCount: number;
        latestJob: { id: string; status: string } | null;
        /** Prerequisites to ingest at all: graph store connected + ≥1 parsed document. */
        storeReady: boolean;
        documentsReady: boolean;
      }
    | null;

  /**
   * ③ ④ — graph stats (units / embedded / validation). The same shape on both
   * the hub (ConnectGraphStatsView) and claims (graph.stats). `awaitingTriage`
   * and `unsupportedUntriaged` are hub-only extras; when absent we fall back to
   * `weak + unsupported` for the Review count.
   */
  graph:
    | {
        units: number;
        embedded: number;
        validation: {
          ok: number;
          weak: number;
          unsupported: number;
          unvalidated: number;
          awaiting_triage?: number;
        };
      }
    | null;
};

const STAGE_META: Record<
  ConnectSpineStageId,
  { index: number; label: string; blurb: string }
> = {
  connect: { index: 1, label: "Connect", blurb: "Store · provider · routes" },
  ingest: { index: 2, label: "Ingest", blurb: "Run on your documents" },
  make_ready: { index: 3, label: "Make ready", blurb: "Link · embed · validate" },
  review: { index: 4, label: "Review", blurb: "Triage flagged claims" },
  go_live: { index: 5, label: "Go live", blurb: "Publish for your app" },
};

function cta(
  label: string,
  href: string,
  disabledReason: string | null = null,
): ConnectSpineCta {
  return { label, href, disabled: disabledReason !== null, disabledReason };
}

/** ① Connect — from the verified-readiness ledger (the existing setup spine). */
function connectStage(s: ConnectSpineSignals): {
  state: ConnectSpineStageState;
  summary: string;
  cta: ConnectSpineCta;
} {
  const r = s.readiness;
  if (!r) {
    // Honest unknown: surface doesn't have the readiness compute. Send the user
    // to the hub where the ledger lives rather than faking a status.
    return {
      state: "unknown",
      summary: "checked on Home",
      cta: cta("Open setup ledger", INGEST_FLOW_HREF + "?step=store"),
    };
  }
  const summary = `${r.ready}/${r.total} checks`;
  if (r.status === "ok") {
    return { state: "done", summary: "store · provider · routes ready", cta: cta("Review setup", INGEST_FLOW_HREF + "?step=launch") };
  }
  const gap = r.firstGap;
  const href = gap?.fixHref ?? INGEST_FLOW_HREF + "?step=store";
  const label = gap?.fixLabel ?? "Finish setup";
  // fail = hard precondition missing (blocks ingest); warn = actionable now.
  return {
    state: r.status === "fail" ? "blocked" : "current",
    summary: gap ? `${summary} — ${gap.label.toLowerCase()}` : summary,
    cta: cta(label, href),
  };
}

/** ② Ingest — run history; blocked until the store + documents exist. */
function ingestStage(
  s: ConnectSpineSignals,
  connectState: ConnectSpineStageState,
): { state: ConnectSpineStageState; summary: string; cta: ConnectSpineCta } {
  const i = s.ingest;
  if (!i) {
    return {
      state: "unknown",
      summary: "runs on Home",
      cta: cta("View runs", RUNS_HREF),
    };
  }
  const running = i.latestJob && (i.latestJob.status === "pending" || i.latestJob.status === "running");
  if (running) {
    return {
      state: "current",
      summary: `run ${i.latestJob!.status}`,
      cta: cta("Watch live progress", `${RUNS_HREF}/${i.latestJob!.id}?from=hub`),
    };
  }
  // Cannot ingest without a store + at least one parsed document.
  if (!i.storeReady || !i.documentsReady) {
    const reason = !i.storeReady
      ? "Connect a graph store first"
      : "Add documents before running ingest";
    return {
      state: "blocked",
      summary: !i.storeReady ? "no store yet" : "no documents yet",
      cta: cta("Start ingest run", INGEST_FLOW_HREF, reason),
    };
  }
  if (i.jobCount > 0) {
    // A completed run exists. Done from the journey's POV — re-running is optional.
    const href = i.latestJob ? `${RUNS_HREF}/${i.latestJob.id}?from=hub` : RUNS_HREF;
    return {
      state: "done",
      summary: `${i.jobCount} run${i.jobCount === 1 ? "" : "s"}`,
      cta: cta("Open last run", href),
    };
  }
  // Prereqs met, no run yet — this is the action.
  return {
    state: connectState === "blocked" ? "todo" : "current",
    summary: "ready to run",
    cta: cta("Start ingest run", INGEST_FLOW_HREF),
  };
}

/** Review count: hub-only awaiting_triage, else weak + unsupported. */
export function spineReviewCount(
  validation: NonNullable<ConnectSpineSignals["graph"]>["validation"],
): number {
  return validation.awaiting_triage ?? validation.weak + validation.unsupported;
}

/**
 * ③ Make ready — link/embed/validate. Derived from graph stats, NOT the
 * option-gated client blockers (which is exactly what caused the silent-no-op
 * class): work remains when ideas are unembedded OR unchecked.
 */
function makeReadyStage(s: ConnectSpineSignals): {
  state: ConnectSpineStageState;
  summary: string;
  cta: ConnectSpineCta;
} {
  const g = s.graph;
  // The Tools sub-wizard lives on the claims explorer's "Tools & glossary" tab.
  const toolsHref = CLAIMS_HREF + "?workspace=tools";
  if (!g) {
    return {
      state: "unknown",
      summary: "needs a graph",
      cta: cta("Open Make ready", toolsHref, "Run ingest to build a graph first"),
    };
  }
  if (g.units === 0) {
    return {
      state: "blocked",
      summary: "no graph yet",
      cta: cta("Open Make ready", toolsHref, "Run ingest to build a graph first"),
    };
  }
  const unembedded = Math.max(0, g.units - g.embedded);
  const unchecked = g.validation.unvalidated;
  if (unembedded === 0 && unchecked === 0) {
    return {
      state: "done",
      summary: "linked · embedded · validated",
      cta: cta("Review readiness", toolsHref),
    };
  }
  // One primary action: validate has priority over embed (validation is the
  // verified-context payoff; embedding is retrieval plumbing).
  if (unchecked > 0) {
    return {
      state: "current",
      summary: `${unchecked.toLocaleString()} unchecked`,
      cta: cta(`Validate ${unchecked.toLocaleString()}`, toolsHref + "&focus=validate"),
    };
  }
  return {
    state: "current",
    summary: `${unembedded.toLocaleString()} to embed`,
    cta: cta(`Embed ${unembedded.toLocaleString()}`, toolsHref + "&focus=embed"),
  };
}

/** ④ Review — triage flagged claims. Disabled-with-reason when nothing flagged. */
function reviewStage(s: ConnectSpineSignals): {
  state: ConnectSpineStageState;
  summary: string;
  cta: ConnectSpineCta;
} {
  const g = s.graph;
  const reviewHref = CLAIMS_HREF + "?filter=review";
  if (!g) {
    return {
      state: "unknown",
      summary: "needs a graph",
      cta: cta("Open review queue", reviewHref, "Run ingest to build a graph first"),
    };
  }
  if (g.units === 0) {
    return {
      state: "blocked",
      summary: "no graph yet",
      cta: cta("Open review queue", reviewHref, "Run ingest to build a graph first"),
    };
  }
  const flagged = spineReviewCount(g.validation);
  if (flagged === 0) {
    return {
      state: "done",
      summary: "nothing flagged",
      cta: cta("Open review queue", reviewHref, "No flagged claims to review"),
    };
  }
  return {
    state: "current",
    summary: `${flagged.toLocaleString()} to review`,
    cta: cta(`Review ${flagged.toLocaleString()}`, reviewHref),
  };
}

/**
 * ⑤ Go live — publish stage routes so the app can consume the graph. Reuses the
 * readiness `models` sub-signals (published chat + embedding routes); the
 * one-click "apply recommended routes" lives on the ingest-routes surface.
 */
function goLiveStage(s: ConnectSpineSignals): {
  state: ConnectSpineStageState;
  summary: string;
  cta: ConnectSpineCta;
} {
  const r = s.readiness;
  const g = s.graph;
  if (!r) {
    return {
      state: "unknown",
      summary: "checked on Home",
      cta: cta("Open ingest routes", INGEST_ROUTES_HREF),
    };
  }
  const hasGraph = g ? g.units > 0 : null;
  // Routes must be published for the app to consume the graph.
  if (r.models.modelsReady) {
    // Routes live. If a graph exists too, the pipeline is live end-to-end.
    if (hasGraph === false) {
      return {
        state: "todo",
        summary: "routes live — no graph yet",
        cta: cta("Review routes", INGEST_ROUTES_HREF),
      };
    }
    return {
      state: "done",
      summary: "routes published — live",
      cta: cta("Review routes", INGEST_ROUTES_HREF),
    };
  }
  const missing = [
    !r.models.hasChatRoute ? "chat" : null,
    !r.models.hasEmbeddingRoute ? "embedding" : null,
  ]
    .filter((m): m is string => m !== null)
    .join(" + ");
  return {
    state: "current",
    summary: missing ? `publish ${missing} route` : "publish routes",
    cta: cta("Publish routes", INGEST_ROUTES_HREF),
  };
}

/**
 * Build the five-stage spine from the signals a surface already loaded.
 * Pure + deterministic — unit-tested directly.
 *
 * The "current" stage is the FIRST stage whose state is `current` (in spine
 * order); when several stages have outstanding work, only that first one is
 * highlighted so there is exactly one "do this now". `blocked`/`todo`/`unknown`
 * are shown but never highlighted as the current action.
 */
export function buildConnectSpine(signals: ConnectSpineSignals): ConnectSpine {
  const connect = connectStage(signals);
  const ingest = ingestStage(signals, connect.state);
  const makeReady = makeReadyStage(signals);
  const review = reviewStage(signals);
  const goLive = goLiveStage(signals);

  const raw: { id: ConnectSpineStageId; r: { state: ConnectSpineStageState; summary: string; cta: ConnectSpineCta } }[] = [
    { id: "connect", r: connect },
    { id: "ingest", r: ingest },
    { id: "make_ready", r: makeReady },
    { id: "review", r: review },
    { id: "go_live", r: goLive },
  ];

  // Exactly one highlighted current stage: the first `current` in spine order.
  const currentStageId = raw.find((s) => s.r.state === "current")?.id ?? null;

  const stages: ConnectSpineStage[] = raw.map(({ id, r }) => {
    const meta = STAGE_META[id];
    return {
      id,
      index: meta.index,
      label: meta.label,
      blurb: meta.blurb,
      state: r.state,
      summary: r.summary,
      cta: r.cta,
      isCurrent: id === currentStageId,
    };
  });

  const done = stages.filter((st) => st.state === "done").length;

  return {
    stages,
    currentStageId,
    done,
    total: stages.length,
    checkedAt: new Date().toISOString(),
  };
}

/** Circled numeral glyph for a stage index (① … ⑤), falling back to the number. */
export function spineNumeral(index: number): string {
  const circled = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"];
  return circled[index - 1] ?? String(index);
}
