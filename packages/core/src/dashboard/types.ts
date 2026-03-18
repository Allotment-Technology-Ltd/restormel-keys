/**
 * Types for the Restormel dashboard resolve and evaluate APIs.
 * Use from server-side only; never send Gateway Key to the browser.
 */

export interface ResolveOptions {
  /** Base URL of the Restormel dashboard (e.g. https://restormel.dev). Default from env RESTORMEL_KEYS_BASE. */
  baseUrl?: string;
  projectId: string;
  environmentId: string;
  routeId?: string;
  /** Auth: Bearer token (Gateway Key or session). Caller must provide; never hardcode. */
  auth: { type: "bearer"; token: string };
  /** Optional fetch init (e.g. custom headers). */
  headers?: HeadersInit;
}

export interface ResolveSuccess {
  ok: true;
  data: {
    routeId: string;
    providerType?: string;
    modelId: string | null;
    explanation: string;
  };
}

export interface PolicyViolation {
  policyId: string;
  policyName: string;
  type: string;
  message: string;
}

export interface ResolveErrorBody {
  error: string;
  message?: string;
  violations?: PolicyViolation[];
  data?: Record<string, unknown>;
}

/** Discriminated error result: known error codes with optional body. */
export interface ResolveError {
  ok: false;
  status: number;
  error: string;
  message?: string;
  violations?: PolicyViolation[];
  body?: ResolveErrorBody;
}

export type ResolveResult = ResolveSuccess | ResolveError;

export interface EvaluateOptions {
  baseUrl?: string;
  projectId: string;
  environmentId?: string;
  routeId?: string;
  modelId?: string;
  providerType?: string;
  modelLifecycleState?: string;
  auth: { type: "bearer"; token: string };
  headers?: HeadersInit;
}

export interface EvaluateResult {
  allowed: boolean;
  violations: PolicyViolation[];
}

/** Thrown when evaluate returns non-2xx; includes status and parsed body when JSON. */
export type RestormelApiError = Error & {
  status: number;
  error: string;
  message: string;
  violations?: PolicyViolation[];
  body?: unknown;
};
