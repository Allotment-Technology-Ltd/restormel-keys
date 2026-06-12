/**
 * Stage K5 — Run attribution: which route/step/model served each ingest stage.
 *
 * Captures the resolved route/provider/model at RUN TIME (not reconstructed after
 * the fact) so a completed run can answer "which route/model served this?" — the
 * provenance the product sells for claims, applied to its own infrastructure.
 *
 * The attribution entry MIRRORS the fields actually in hand inside
 * `stage-route-generate.ts`'s `callResolvedChat` / `embedViaRoute` after a
 * successful `resolveRouteForExecution`. Source of the resolved shape:
 *   apps/dashboard/src/lib/server/route-resolver.ts → `ResolvedRouteResult`
 *     (workspaceId, projectId, route: RouteRecord{id,name}, providerType, modelId,
 *      selectedStepId, selectedOrderIndex). Provider/model are nullable there;
 *      we only record an entry once a chat/embed actually SUCCEEDED, so they are
 *      non-null at capture.
 *
 * NOTE: attribution carries NO key material — it is provider/model/route ids only.
 */
import { CONNECT_MODEL_STAGES, type ConnectModelStage } from "@restormel/contracts/connect";

export type { ConnectModelStage };

/**
 * One stage's attribution, as persisted into `progress.attribution[stage]`.
 * `attempts` = total resolve attempts the stage made before the recorded success
 * (≥1; >1 means a fallback fired). The recorded provider/model/route/step is the
 * LAST SUCCESSFUL attempt — the one that actually served the stage's last call.
 */
export type ConnectStageAttribution = {
  /** Keys route id that served this stage's last successful call. */
  routeId: string | null;
  /** Human route name (for the run-console link to the builder); null if unknown. */
  routeName: string | null;
  /** Project the route lives in (powers the builder href). */
  projectId: string | null;
  /** Resolved route step id on the served route (machine-readable). */
  stepId: string | null;
  /** 0-based order index of the served step within the route (display: step N = +1). */
  stepOrderIndex: number | null;
  /** Canonical provider type that served the call (e.g. "openai", "anthropic"). */
  provider: string | null;
  /** Resolved model id that served the call. */
  modelId: string | null;
  /** Total resolve attempts before the recorded success (1 = first try; >1 = fallback). */
  attempts: number;
  /** ISO timestamp of the last successful call this stage recorded. */
  recordedAt: string;
};

/** The persisted per-stage attribution map. Bounded by CONNECT_MODEL_STAGES (5 keys). */
export type ConnectRunAttribution = Partial<Record<ConnectModelStage, ConnectStageAttribution>>;

/** Inputs available at the moment a stage call succeeds (mirror of ResolvedRouteResult). */
export type StageResolvedSnapshot = {
  routeId?: string | null;
  routeName?: string | null;
  projectId?: string | null;
  stepId?: string | null;
  stepOrderIndex?: number | null;
  provider?: string | null;
  modelId?: string | null;
  /** 0-based attempt number from the resolve loop; recorded as attempts = +1. */
  attemptNumber?: number | null;
};

function cleanStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function cleanInt(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
}

/** Build a single stage attribution entry from a successful resolve snapshot. */
export function buildStageAttributionEntry(
  snap: StageResolvedSnapshot,
  nowIso: string = new Date().toISOString(),
): ConnectStageAttribution {
  const attempt = cleanInt(snap.attemptNumber);
  return {
    routeId: cleanStr(snap.routeId),
    routeName: cleanStr(snap.routeName),
    projectId: cleanStr(snap.projectId),
    stepId: cleanStr(snap.stepId),
    stepOrderIndex: cleanInt(snap.stepOrderIndex),
    provider: cleanStr(snap.provider),
    modelId: cleanStr(snap.modelId),
    // attemptNumber is 0-based in the resolve loop → attempts is the human 1-based count.
    attempts: Math.max(1, (attempt ?? 0) + 1),
    recordedAt: nowIso,
  };
}

/**
 * Merge a freshly resolved stage entry into a prior attribution map.
 *
 * Restart-safe / checkpoint-safe: a reclaimed run carrying prior `progress.attribution`
 * keeps stages it is no longer re-running (the resume checkpoint skips them), while a
 * stage that runs again OVERWRITES its own entry with the last successful attempt. The
 * map is bounded to the five known stages, so it can never grow without limit.
 */
export function mergeStageAttribution(
  prior: ConnectRunAttribution | null | undefined,
  stage: ConnectModelStage,
  entry: ConnectStageAttribution,
): ConnectRunAttribution {
  const next: ConnectRunAttribution = {};
  // Only carry forward known stages (bounded size; drops any junk keys).
  if (prior) {
    for (const k of CONNECT_MODEL_STAGES) {
      if (prior[k]) next[k] = prior[k];
    }
  }
  next[stage] = entry;
  return next;
}

/**
 * True when two stage entries differ in any displayed field (ignores recordedAt).
 * Used to skip a redundant progress persist when a stage's served route/provider/
 * model/attempts is unchanged across many per-chunk calls.
 */
export function attributionEntryChanged(
  prev: ConnectStageAttribution | undefined,
  next: ConnectStageAttribution,
): boolean {
  if (!prev) return true;
  return (
    prev.routeId !== next.routeId ||
    prev.routeName !== next.routeName ||
    prev.projectId !== next.projectId ||
    prev.stepId !== next.stepId ||
    prev.stepOrderIndex !== next.stepOrderIndex ||
    prev.provider !== next.provider ||
    prev.modelId !== next.modelId ||
    prev.attempts !== next.attempts
  );
}

/** Parse an unknown JSONB blob into a bounded, type-safe attribution map (or undefined). */
export function parseConnectRunAttribution(raw: unknown): ConnectRunAttribution | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const rec = raw as Record<string, unknown>;
  const out: ConnectRunAttribution = {};
  for (const stage of CONNECT_MODEL_STAGES) {
    const v = rec[stage];
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    const e = v as Record<string, unknown>;
    const attempts = cleanInt(e.attempts);
    out[stage] = {
      routeId: cleanStr(e.routeId),
      routeName: cleanStr(e.routeName),
      projectId: cleanStr(e.projectId),
      stepId: cleanStr(e.stepId),
      stepOrderIndex: cleanInt(e.stepOrderIndex),
      provider: cleanStr(e.provider),
      modelId: cleanStr(e.modelId),
      attempts: attempts != null && attempts >= 1 ? attempts : 1,
      recordedAt: cleanStr(e.recordedAt) ?? new Date(0).toISOString(),
    };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Derive the K4/K-P1-7 validating-family attribution (provider strings) from the
 * captured per-stage attribution — feeds `buildRunQualityReport`'s `attribution`
 * arg so the run console's "Validated by … cross-model ✓" line reflects the
 * providers that ACTUALLY served extraction vs validation this run.
 */
export function deriveValidationFamilyAttribution(
  attribution: ConnectRunAttribution | null | undefined,
): { validationProvider: string | null; extractionProvider: string | null } | undefined {
  const validationProvider = attribution?.validation?.provider ?? null;
  const extractionProvider = attribution?.extraction?.provider ?? null;
  if (!validationProvider && !extractionProvider) return undefined;
  return { validationProvider, extractionProvider };
}

/**
 * Collector threaded through the route-execution context: stage-route-generate
 * reports each successful resolve here; the worker drains it into the reporter so
 * attribution is persisted into job progress as the run proceeds.
 */
export class StageAttributionCollector {
  private map: ConnectRunAttribution = {};

  /**
   * Record a stage's last successful resolve. Returns the built entry plus whether
   * it changed any displayed field vs the prior entry for that stage — so the caller
   * can skip a redundant progress persist on identical per-chunk re-resolves.
   */
  record(
    stage: ConnectModelStage,
    snap: StageResolvedSnapshot,
    nowIso?: string,
  ): { entry: ConnectStageAttribution; changed: boolean } {
    const prev = this.map[stage];
    const entry = buildStageAttributionEntry(snap, nowIso);
    const changed = attributionEntryChanged(prev, entry);
    this.map = mergeStageAttribution(this.map, stage, entry);
    return { entry, changed };
  }

  get(stage: ConnectModelStage): ConnectStageAttribution | undefined {
    return this.map[stage];
  }

  snapshot(): ConnectRunAttribution {
    return { ...this.map };
  }
}
