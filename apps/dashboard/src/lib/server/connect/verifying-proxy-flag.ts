/**
 * Feature flag for the verifying proxy (REC-PLAN-010 / W2-2 Phase B).
 *
 * DEFAULT OFF. The entire upstream-MCP registration + readonly-profile + proxy
 * policy surface is inert unless `RESTORMEL_VERIFYING_PROXY=1`. There is NO remote
 * or unauthenticated route in Phase B; the flag gates the control-plane service
 * functions so an accidental wiring cannot expose them in production.
 */
export function isVerifyingProxyEnabled(): boolean {
  return process.env.RESTORMEL_VERIFYING_PROXY === "1";
}

/** Throwable guard for service entrypoints. */
export function assertVerifyingProxyEnabled():
  | { ok: true }
  | { ok: false; status: 404; error: "not_found"; message: string } {
  if (!isVerifyingProxyEnabled()) {
    return {
      ok: false,
      status: 404,
      error: "not_found",
      message: "The verifying proxy is not enabled on this deployment.",
    };
  }
  return { ok: true };
}
