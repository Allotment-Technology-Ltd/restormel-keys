/**
 * Deprecated `AAIF*` aliases for the renamed Dispatch envelope.
 *
 * The package `@restormel/aaif` was renamed to `@restormel/dispatch` and every
 * `AAIF*` identifier renamed to `Dispatch*` (the in-house, in-process model-execution
 * "Interaction Format" envelope — NOT a wire protocol; "A2A" is reserved for the future
 * spec-conformant Agent2Agent peer). To avoid a silent breaking rename for external npm
 * consumers, every old name is re-exported here as a `@deprecated` alias to its new name.
 *
 * These aliases are scheduled for removal at the package's 1.0 release. Migrate to the
 * `Dispatch*` names. `index.ts` re-exports this module so existing imports keep compiling
 * through the grace period.
 */
import type {
  DispatchTask,
  DispatchLatency,
  DispatchConstraints,
  DispatchUser,
  DispatchRouting,
  DispatchRoutingHints,
  DispatchRoutingContext,
  DispatchRoutingPlan,
  DispatchRoutingPlanStep,
  DispatchRoutingAttempt,
  DispatchRoutingAttemptOutcome,
  DispatchIntegrationStack,
  DispatchIntegrationStackComponent,
  DispatchIntegrationStackSchemaVersion,
  DispatchRequest,
  DispatchResponse,
  DispatchVerifiedClaimState,
  DispatchEvidenceMatch,
  DispatchVerifiedClaimEvidence,
  DispatchVerifiedClaimJudge,
  DispatchVerifiedClaimEnvelope,
  DispatchVerifiedContextInput,
  DispatchVerifiedContextOutput,
} from "./types.js";
import type { DispatchGenerateOutput, ExecuteDispatchOptions } from "./runtime.js";
import {
  isDispatchRequest,
  isDispatchResponse,
  isDispatchVerifiedClaimEnvelope,
  isDispatchVerifiedContextInput,
  isDispatchVerifiedContextOutput,
} from "./validate.js";
import { executeDispatchRequest } from "./runtime.js";

// ---------------------------------------------------------------------------
// Type aliases (23 types) — @deprecated, use the Dispatch* equivalent
// ---------------------------------------------------------------------------

/** @deprecated Renamed to {@link DispatchTask}. Removed at 1.0. */
export type AAIFTask = DispatchTask;
/** @deprecated Renamed to {@link DispatchLatency}. Removed at 1.0. */
export type AAIFLatency = DispatchLatency;
/** @deprecated Renamed to {@link DispatchConstraints}. Removed at 1.0. */
export type AAIFConstraints = DispatchConstraints;
/** @deprecated Renamed to {@link DispatchUser}. Removed at 1.0. */
export type AAIFUser = DispatchUser;
/** @deprecated Renamed to {@link DispatchRouting}. Removed at 1.0. */
export type AAIFRouting = DispatchRouting;
/** @deprecated Renamed to {@link DispatchRoutingHints}. Removed at 1.0. */
export type AAIFRoutingHints = DispatchRoutingHints;
/** @deprecated Renamed to {@link DispatchRoutingContext}. Removed at 1.0. */
export type AAIFRoutingContext = DispatchRoutingContext;
/** @deprecated Renamed to {@link DispatchRoutingPlan}. Removed at 1.0. */
export type AAIFRoutingPlan = DispatchRoutingPlan;
/** @deprecated Renamed to {@link DispatchRoutingPlanStep}. Removed at 1.0. */
export type AAIFRoutingPlanStep = DispatchRoutingPlanStep;
/** @deprecated Renamed to {@link DispatchRoutingAttempt}. Removed at 1.0. */
export type AAIFRoutingAttempt = DispatchRoutingAttempt;
/** @deprecated Renamed to {@link DispatchRoutingAttemptOutcome}. Removed at 1.0. */
export type AAIFRoutingAttemptOutcome = DispatchRoutingAttemptOutcome;
/** @deprecated Renamed to {@link DispatchIntegrationStack}. Removed at 1.0. */
export type AAIFIntegrationStack = DispatchIntegrationStack;
/** @deprecated Renamed to {@link DispatchIntegrationStackComponent}. Removed at 1.0. */
export type AAIFIntegrationStackComponent = DispatchIntegrationStackComponent;
/** @deprecated Renamed to {@link DispatchIntegrationStackSchemaVersion}. Removed at 1.0. */
export type AAIFIntegrationStackSchemaVersion = DispatchIntegrationStackSchemaVersion;
/** @deprecated Renamed to {@link DispatchRequest}. Removed at 1.0. */
export type AAIFRequest = DispatchRequest;
/** @deprecated Renamed to {@link DispatchResponse}. Removed at 1.0. */
export type AAIFResponse = DispatchResponse;
/** @deprecated Renamed to {@link DispatchVerifiedClaimState}. Removed at 1.0. */
export type AAIFVerifiedClaimState = DispatchVerifiedClaimState;
/** @deprecated Renamed to {@link DispatchEvidenceMatch}. Removed at 1.0. */
export type AAIFEvidenceMatch = DispatchEvidenceMatch;
/** @deprecated Renamed to {@link DispatchVerifiedClaimEvidence}. Removed at 1.0. */
export type AAIFVerifiedClaimEvidence = DispatchVerifiedClaimEvidence;
/** @deprecated Renamed to {@link DispatchVerifiedClaimJudge}. Removed at 1.0. */
export type AAIFVerifiedClaimJudge = DispatchVerifiedClaimJudge;
/** @deprecated Renamed to {@link DispatchVerifiedClaimEnvelope}. Removed at 1.0. */
export type AAIFVerifiedClaimEnvelope = DispatchVerifiedClaimEnvelope;
/** @deprecated Renamed to {@link DispatchVerifiedContextInput}. Removed at 1.0. */
export type AAIFVerifiedContextInput = DispatchVerifiedContextInput;
/** @deprecated Renamed to {@link DispatchVerifiedContextOutput}. Removed at 1.0. */
export type AAIFVerifiedContextOutput = DispatchVerifiedContextOutput;

// ---------------------------------------------------------------------------
// Function / interface-shape aliases (8) — @deprecated, use the Dispatch* equivalent
// ---------------------------------------------------------------------------

/** @deprecated Renamed to {@link DispatchGenerateOutput}. Removed at 1.0. */
export type AAIFGenerateOutput = DispatchGenerateOutput;
/** @deprecated Renamed to {@link ExecuteDispatchOptions}. Removed at 1.0. */
export type ExecuteAAIFOptions = ExecuteDispatchOptions;

/** @deprecated Renamed to {@link executeDispatchRequest}. Removed at 1.0. */
export const executeAAIFRequest = executeDispatchRequest;
/** @deprecated Renamed to {@link isDispatchRequest}. Removed at 1.0. */
export const isAAIFRequest = isDispatchRequest;
/** @deprecated Renamed to {@link isDispatchResponse}. Removed at 1.0. */
export const isAAIFResponse = isDispatchResponse;
/** @deprecated Renamed to {@link isDispatchVerifiedClaimEnvelope}. Removed at 1.0. */
export const isAAIFVerifiedClaimEnvelope = isDispatchVerifiedClaimEnvelope;
/** @deprecated Renamed to {@link isDispatchVerifiedContextInput}. Removed at 1.0. */
export const isAAIFVerifiedContextInput = isDispatchVerifiedContextInput;
/** @deprecated Renamed to {@link isDispatchVerifiedContextOutput}. Removed at 1.0. */
export const isAAIFVerifiedContextOutput = isDispatchVerifiedContextOutput;
