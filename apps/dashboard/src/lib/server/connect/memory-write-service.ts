/**
 * Stage 3.4 — agent memory write path (POST /connect/v1/memory).
 *
 * Agent observations enter the SAME quality gate as ingested documents — no parallel
 * pipeline. Per submission (≤ CONNECT_MEMORY_MAX_OBSERVATIONS, one entailment batch):
 *
 *   1. The submitted evidence corpus is stored verbatim as a source version with
 *      provenance kind "agent_observation" + the submitting key's identity. "Evidence"
 *      for an observation = the agent's exact quote (optionally inside a `context`
 *      passage, with a `source_ref` for audit). The corpus is what spans bind against,
 *      so every accepted observation stays deterministically re-checkable — but it is
 *      AGENT-ATTESTED evidence, which the provenance kind makes explicit.
 *   2. EBV Layer 1: the quote is bound against the corpus (exact → normalized → bounded
 *      fuzzy). A quote that does not appear in its own submitted context does not bind.
 *   3. Stage 3.2 claim identity/versions via the same writer machinery
 *      (insertConnectClaimVersionsPostgres et al.) — claims, never a side store. The
 *      source key is unique per submission (`agent:<request-id>`): memory writes never
 *      supersede earlier memory (temporal supersession is Stage 3.3's contract).
 *   4. EBV Layer 2: span-scoped entailment with abstention (judge family = the
 *      workspace's validation route, exactly as ingest). supported requires
 *      bound ∧ entailed; no evidence → local abstain → unverified (review) — an
 *      observation with no verifiable evidence span can NEVER land supported.
 *   5. Remediation for weak/not-entailed observations (same core, same strictness
 *      policy as ingest); abstentions go to review, never remediation. Repairs are
 *      re-judged span-scoped before they can return to supported.
 *   6. Fail-closed but transparent: every observation comes back with its final
 *      verification state, binding status, and reasons. Soft-excluded ("rejected")
 *      rows are reversible and never reach retrieval; unverified rows sit in the
 *      review queue and never reach STRICT verified retrieval.
 *
 * Nothing in this module logs or stores raw key material; the submitting identity is
 * the key id (audit identifier), recorded on the source row title.
 */
import type {
  ConnectDomainPack,
  ConnectMemoryObservation,
  ConnectMemoryObservationResult,
  ConnectMemoryWriteResponse,
} from "@restormel/contracts/connect";
import { CONNECT_API_CONTRACT_VERSION } from "@restormel/contracts/connect";
import {
  contentHash,
  entailmentToLegacyStatus,
  judgeEntailment,
  readEntailmentKForPreset,
  resolveQualityPreset,
  type ClaimVerificationState,
  type EmbeddingPort,
  type EntailmentInput,
  type ExtractionGenerate,
  type ReingestPlan,
} from "@restormel/connect-core";
import { buildEvidenceRows, buildLayer2StateRows } from "$lib/server/connect/evidence-persist";
import {
  buildClaimVersionBindings,
  computeNextClaims,
} from "$lib/server/connect/incremental-reingest";
import { buildGraphWriter, type GraphWriter } from "$lib/server/connect/graph-writer";
import { runGraphRemediationPass } from "$lib/server/connect/graph-remediation-pass";
import { resolveWorkspaceDomainPack } from "$lib/server/connect/domain-pack-service";
import {
  buildKnowledgeStageGenerates,
  isConnectIngestLlmReady,
} from "$lib/server/connect/stage-route-generate";
import { resolveKnowledgeRouteExecutionContext } from "$lib/server/connect/stage-routing";
import { isModuleEnabled, resolveModuleFlagsSync } from "$lib/server/module-flags";
import {
  getConnectGraphTargetForWorkspace,
  invalidateConnectGraphStatsCache,
} from "$lib/server/neon";

export type MemoryWriteAuth = {
  userId: string;
  projectId: string;
  workspaceId: string;
  authType: string;
};

export type MemoryWriteDeps = {
  writer: GraphWriter;
  pack: ConnectDomainPack;
  validationGenerate: ExtractionGenerate;
  remediationGenerate: ExtractionGenerate;
  embed?: EmbeddingPort;
};

export type MemoryWriteFailure = { ok: false; status: number; body: Record<string, unknown> };

export type MemoryWriteOutcome =
  | { ok: true; status: 200; body: ConnectMemoryWriteResponse }
  | MemoryWriteFailure;

/** Stable per-observation local id (writer maps it to the stored unit id). */
export function observationLocalId(index: number): string {
  return `obs${index + 1}`;
}

/**
 * Deterministic evidence corpus for one submission. This text is stored verbatim as
 * the observation source version: spans bind against it, its hash pins the version,
 * and an auditor can re-check any accepted span against it later. Quote-only evidence
 * binds against the quote itself — still a real re-checkable span, but the entailment
 * judge (not the binder) is what does the verification work there; the agent-attested
 * trust root is explicit in the provenance kind either way.
 */
export function buildObservationCorpus(observations: ConnectMemoryObservation[]): string {
  return observations
    .map((o, i) => {
      const ref = o.evidence?.source_ref?.trim() || "unreferenced";
      const body = o.evidence ? (o.evidence.context ?? o.evidence.quote) : "(no evidence supplied)";
      return `[observation ${i + 1}] source: ${ref}\n${body}`;
    })
    .join("\n\n");
}

/** Map a final EBV state to the caller-facing outcome bucket. */
export function outcomeForState(
  state: ClaimVerificationState,
): ConnectMemoryObservationResult["outcome"] {
  if (state === "supported" || state === "inferred") return "accepted";
  if (state === "excluded") return "rejected";
  return "review";
}

/**
 * Resolve store + pack + route-bound LLM generates for a workspace memory write.
 * Fail-closed: if the judge cannot run (no LLM route/key) the request is refused —
 * observations are never persisted "to verify later".
 */
export async function resolveMemoryWriteDeps(args: {
  auth: MemoryWriteAuth;
  requestId: string;
}): Promise<{ ok: true; deps: MemoryWriteDeps } | MemoryWriteFailure> {
  const { auth } = args;
  const target = await getConnectGraphTargetForWorkspace(auth.workspaceId);
  if (!target) {
    return {
      ok: false,
      status: 503,
      body: {
        error: "graph_target_not_configured",
        message: "Configure a knowledge graph store before writing agent memory.",
      },
    };
  }
  if (target.provider === "postgres") {
    const flags = resolveModuleFlagsSync();
    // REC-ADR-008: flag renamed to connectHostManagedGraphStore; error code kept (API-compat).
    if (!isModuleEnabled(flags, "connectHostManagedGraphStore")) {
      return {
        ok: false,
        status: 503,
        body: {
          error: "connect_neon_graph_store_disabled",
          message: "The hosted graph store module is disabled for this deployment.",
        },
      };
    }
  }

  const pack = await resolveWorkspaceDomainPack(auth.workspaceId);
  if (!pack) {
    return {
      ok: false,
      status: 503,
      body: {
        error: "domain_pack_not_found",
        message: "No domain pack available for this workspace.",
      },
    };
  }

  const routeCtx = await resolveKnowledgeRouteExecutionContext({
    workspaceId: auth.workspaceId,
    userId: auth.userId,
    projectId: auth.projectId,
  });
  const llmReady = await isConnectIngestLlmReady({ workspaceId: auth.workspaceId, routeCtx });
  if (!llmReady) {
    return {
      ok: false,
      status: 503,
      body: {
        error: "connect_llm_not_configured",
        message:
          "No validation route or provider credentials are configured — observations cannot be verified, so none were persisted.",
      },
    };
  }
  const { generates, embed } = await buildKnowledgeStageGenerates({
    workspaceId: auth.workspaceId,
    routeCtx,
  });

  const writer = await buildGraphWriter(target, pack, {
    workspaceId: auth.workspaceId,
    domainPackId: pack.id ?? null,
    id: `memory-${args.requestId}`,
  });
  if (!writer) {
    return {
      ok: false,
      status: 503,
      body: {
        error: "graph_store_unavailable",
        message: "The configured graph store could not be reached.",
      },
    };
  }

  return {
    ok: true,
    deps: {
      writer,
      pack,
      validationGenerate: generates.validation,
      remediationGenerate: generates.remediation,
      embed,
    },
  };
}

/**
 * Run one observation batch through the gate and persist it. The writer's fail-safe
 * semantics hold throughout: a unit the judge never returned a verdict for abstains
 * (→ review); a unit persisted before a downstream failure carries no "supported"
 * state, so it can never silently reach strict retrieval.
 */
export async function executeConnectMemoryWrite(args: {
  auth: MemoryWriteAuth;
  /** Submitting key id (audit identity — never raw key material). */
  keyId: string | null;
  observations: ConnectMemoryObservation[];
  requestId: string;
  deps: MemoryWriteDeps;
}): Promise<MemoryWriteOutcome> {
  const { deps, observations } = args;
  const warnings: string[] = [];

  try {
    // 1. Register the submission as a source version (agent_observation provenance).
    const sourceText = buildObservationCorpus(observations);
    const sourceHash = await contentHash(sourceText);
    // Unique per submission: memory writes never supersede earlier memory (Stage 3.3
    // temporal validity owns supersession over time).
    const sourceKey = `agent:${args.requestId}`;
    const submitter = args.keyId ? `key ${args.keyId}` : args.auth.authType;
    const sourceId = await deps.writer.writeSource({
      title: `Agent observations — ${new Date().toISOString()} (${submitter})`,
      url: null,
      textPreview: sourceText.slice(0, 500),
      sourceKind: "agent_observation",
      sourceKey,
      contentHash: sourceHash,
    });

    // 2. Persist the observation units (claims-to-be; no relations).
    const stored = await deps.writer.writeUnitsAndRelations({
      sourceId,
      units: observations.map((o, i) => ({
        localId: observationLocalId(i),
        text: o.text,
        unitType: "agent_observation",
        domain: null,
      })),
      relations: [],
    });
    const indexByUnitId = new Map<string, number>();
    stored.units.forEach((u, i) => indexByUnitId.set(u.id, i));
    if (stored.units.length !== observations.length) {
      warnings.push(
        `store_write_partial: ${stored.units.length}/${observations.length} unit(s) persisted`,
      );
    }

    // 3. EBV Layer 1 — bind each quote against the submitted corpus.
    const evidence = buildEvidenceRows({
      extractedUnits: observations.map((o, i) => ({
        id: observationLocalId(i),
        evidence: o.evidence?.quote ?? "",
      })),
      storedUnits: stored.units,
      sourceText,
      sourceHash,
    });

    // 4. Stage 3.2 claim identity + version rows (same machinery as ingest).
    const next = await computeNextClaims({ sourceKey, rows: evidence.rows });
    const plan: ReingestPlan = { carried: [], changed: [], added: next, removed: [] };
    const ev = await deps.writer.setEvidence({
      sourceHash,
      bindings: buildClaimVersionBindings({ rows: evidence.rows, next, plan }),
    });
    if (ev.missed > 0) {
      warnings.push(`evidence_write_partial: ${ev.missed} claim-version write(s) not persisted`);
    }
    const claimKeyByUnitId = new Map(next.map((n) => [n.unitId, n.claimKey]));

    // 5. EBV Layer 2 — span-scoped entailment with abstention. Observations without a
    //    bound span never reach the judge: they abstain locally (no_bound_evidence) and
    //    land unverified → review. supported requires bound ∧ entailed.
    const inputs: EntailmentInput[] = stored.units.map((u) => {
      const b = evidence.bindingByUnitId.get(u.id);
      return { ref: u.id, claim: u.text, spans: b?.status === "bound" ? [b.span.quote] : [] };
    });
    const kSamples = readEntailmentKForPreset(resolveQualityPreset(deps.pack));
    const { results: judged, meta } = await judgeEntailment({
      inputs,
      generate: deps.validationGenerate,
      kSamples,
      modelId: null,
    });

    const l2 = buildLayer2StateRows({
      results: judged,
      bindingByUnitId: evidence.bindingByUnitId,
      meta,
    });
    const st = await deps.writer.setVerificationStates(l2.states);
    if (st.missed > 0) {
      warnings.push(`state_write_partial: ${st.missed} verification-state write(s) not persisted`);
    }
    const audit = await deps.writer.recordJudgments(l2.judgments);
    if (audit.missed > 0) {
      warnings.push(`judgment_write_partial: ${audit.missed} judgment write(s) not persisted`);
    }

    const validationResults = judged.map((r) => ({
      ref: r.ref,
      status: entailmentToLegacyStatus(r),
      note: r.note ?? null,
    }));
    await deps.writer.setValidation(
      validationResults.map((r) => ({ unitId: r.ref, status: r.status, note: r.note ?? null })),
    );

    // 6. Remediation for weak/not-entailed observations (same core + policy as ingest).
    //    Abstentions are review-queue items — never remediation inputs.
    const abstained = new Set(l2.abstained);
    const textById = new Map(stored.units.map((u) => [u.id, u.text]));
    const remediable = validationResults.filter((r) => !abstained.has(r.ref));
    const pass = await runGraphRemediationPass({
      validationResults: remediable,
      textById,
      sourceText,
      pack: deps.pack,
      writer: deps.writer,
      validationGenerate: deps.validationGenerate,
      remediationGenerate: deps.remediationGenerate,
      ebv: { bindingByUnitId: evidence.bindingByUnitId, kSamples, modelId: null },
    });
    if (pass.remediationFailed) {
      warnings.push(
        "remediation_failed: weak observations kept their unverified/review state (fail-closed)",
      );
    }

    // 7. Final per-observation states (remediation outcomes win over the first judge).
    const stateByUnitId = new Map(l2.states.map((s) => [s.unitId, s.state]));
    for (const r of pass.rejudgedStates) stateByUnitId.set(r.unitId, r.state);
    for (const id of pass.droppedUnitIds) stateByUnitId.set(id, "excluded");
    const repairedIds = new Set(pass.repairedUnitIds);
    const droppedIds = new Set(pass.droppedUnitIds);

    // 8. Embed surviving observations so they are vector-retrievable. Embedding is a
    //    retrieval amenity, not a gate — degradation is reported, never hidden.
    let embedded = 0;
    const toEmbed = stored.units
      .filter((u) => stateByUnitId.get(u.id) !== "excluded")
      .map((u) => ({ id: u.id, text: textById.get(u.id) ?? u.text }));
    if (deps.embed && toEmbed.length > 0) {
      try {
        const vectors = await deps.embed(toEmbed.map((t) => t.text));
        const pairs = toEmbed
          .map((t, i) => ({ unitId: t.id, vector: vectors[i] ?? [] }))
          .filter((p) => Array.isArray(p.vector) && p.vector.length > 0);
        if (pairs.length > 0) embedded = await deps.writer.setEmbeddings(pairs);
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        warnings.push(`embedding_degraded: ${detail.slice(0, 160)}`);
      }
    }

    // 9. Transparent per-observation results.
    const noteByUnitId = new Map(judged.map((r) => [r.ref, r.note ?? null]));
    const verdictByUnitId = new Map(judged.map((r) => [r.ref, r.verdict]));
    const results: ConnectMemoryObservationResult[] = stored.units.map((u) => {
      const index = indexByUnitId.get(u.id) ?? 0;
      const binding = evidence.bindingByUnitId.get(u.id);
      const bindingStatus = binding?.status ?? "no_evidence";
      const state = stateByUnitId.get(u.id) ?? "unverified";
      const reasons: string[] = [];
      if (bindingStatus === "no_evidence") {
        reasons.push(
          "no_evidence: no quote supplied — without a verifiable evidence span an observation is at best unverified (review), never supported",
        );
      } else if (bindingStatus === "unbound") {
        reasons.push("evidence_unbound: quote_not_found in the submitted evidence context");
      }
      const verdict = verdictByUnitId.get(u.id);
      const note = noteByUnitId.get(u.id);
      if (verdict) reasons.push(`entailment_${verdict}${note ? `: ${note}` : ""}`);
      if (repairedIds.has(u.id)) {
        reasons.push("remediation_repaired: text revised to match the submitted evidence and re-judged span-scoped");
      }
      if (droppedIds.has(u.id)) {
        reasons.push("remediation_excluded: no basis in the submitted evidence — soft-excluded (reversible), never retrievable");
      }
      return {
        index,
        unit_id: u.id,
        claim_key: claimKeyByUnitId.get(u.id) ?? null,
        text: textById.get(u.id) ?? u.text,
        verification_state: state,
        evidence_binding: bindingStatus,
        outcome: outcomeForState(state),
        repaired: repairedIds.has(u.id),
        reasons,
      };
    });
    results.sort((a, b) => a.index - b.index);

    const summary = { supported: 0, inferred: 0, unverified: 0, excluded: 0, embedded };
    for (const r of results) {
      if (r.verification_state === "supported") summary.supported += 1;
      else if (r.verification_state === "inferred") summary.inferred += 1;
      else if (r.verification_state === "excluded") summary.excluded += 1;
      else summary.unverified += 1;
    }

    await invalidateConnectGraphStatsCache({ workspaceId: args.auth.workspaceId }).catch(() => {});

    const body: ConnectMemoryWriteResponse = {
      contract_version: CONNECT_API_CONTRACT_VERSION,
      request_id: args.requestId,
      source_id: sourceId,
      provenance: {
        kind: "agent_observation",
        key_id: args.keyId,
        auth_type: args.auth.authType,
      },
      results,
      summary,
      ...(warnings.length > 0 ? { warnings } : {}),
    };
    return { ok: true, status: 200, body };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      status: 502,
      body: {
        error: "memory_write_failed",
        message: message.slice(0, 500),
        // Anything persisted before the failure carries no supported state — fail-closed.
        hint: "No observation from this request can reach verified retrieval as supported.",
      },
    };
  }
}
