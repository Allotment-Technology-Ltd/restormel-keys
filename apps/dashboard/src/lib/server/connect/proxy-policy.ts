/**
 * Per-tenant verifying-proxy policy (REC-PLAN-010 / W2-2 Phase B, B4).
 *
 * EXTENDS the existing `policies` table + `rule_definition` JSONB (+ bindings +
 * audit) — it does NOT fork a new table. A proxy policy is a `policies` row with
 * `type = "verifying_proxy"` and a `rule_definition` shaped by `ProxyPolicyRule`:
 *
 *   - allowedUpstreams: upstream_mcp_targets ids this policy may resolve.
 *   - allowedTools:     tool-name allow-list (intersected with connect-readonly).
 *   - minTrustScore:    abstention threshold — extends the verification-policy
 *                       `minTrustScore`/`include` half rather than duplicating it.
 *   - profile:          tool profile name; only "connect-readonly" in Phase B.
 *
 * This module is pure decision logic over a rule_definition object — persistence
 * uses the shared `createPolicy`/`updatePolicy`/`getPolicy` neon helpers and the
 * audit trail they already emit.
 */

export const VERIFYING_PROXY_POLICY_TYPE = "verifying_proxy" as const;

export type ProxyPolicyRule = {
  /** Upstream target ids this policy permits the proxy to resolve. Empty/absent = none. */
  allowedUpstreams?: string[];
  /** Tool-name allow-list, intersected with the connect-readonly profile. */
  allowedTools?: string[];
  /**
   * Abstention threshold: the proxy abstains (does not answer) below this verified
   * trust score. Extends the verification-policy minTrustScore/include semantics.
   */
  minTrustScore?: number;
  /** Tool profile. Phase B ships only the deny-by-default readonly profile. */
  profile?: "connect-readonly";
};

/** Default rule for a freshly created proxy policy: deny-by-default everywhere. */
export function defaultProxyPolicyRule(): ProxyPolicyRule {
  return {
    allowedUpstreams: [],
    allowedTools: [],
    minTrustScore: 0,
    profile: "connect-readonly",
  };
}

/** Parse/normalise an arbitrary rule_definition JSON into a ProxyPolicyRule. */
export function parseProxyPolicyRule(raw: unknown): ProxyPolicyRule {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaultProxyPolicyRule();
  const r = raw as Record<string, unknown>;
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const minTrust =
    typeof r.minTrustScore === "number" && Number.isFinite(r.minTrustScore)
      ? Math.min(1, Math.max(0, r.minTrustScore))
      : 0;
  return {
    allowedUpstreams: strArr(r.allowedUpstreams),
    allowedTools: strArr(r.allowedTools),
    minTrustScore: minTrust,
    profile: r.profile === "connect-readonly" ? "connect-readonly" : "connect-readonly",
  };
}

/** Is this upstream target id permitted by the policy? Deny-by-default. */
export function isUpstreamAllowedByPolicy(rule: ProxyPolicyRule, upstreamId: string): boolean {
  const list = rule.allowedUpstreams ?? [];
  return list.includes(upstreamId);
}

/**
 * Does a verified trust score clear the policy's abstention threshold?
 * `include` semantics: a request is included (answered) only at or above the bar.
 */
export function meetsTrustThreshold(rule: ProxyPolicyRule, trustScore: number): boolean {
  const bar = rule.minTrustScore ?? 0;
  return trustScore >= bar;
}

/**
 * Effective tool allow-list for a dispatch: the policy's allowedTools intersected
 * with the per-target allowed_tools (both narrow; neither widens). An empty result
 * with a non-empty input means the readonly profile alone governs the tool surface.
 */
export function effectiveToolAllowList(
  rule: ProxyPolicyRule,
  targetAllowedTools?: readonly string[] | null,
): string[] | null {
  const policyList = rule.allowedTools ?? [];
  if (policyList.length === 0 && (!targetAllowedTools || targetAllowedTools.length === 0)) {
    return null; // no explicit narrowing; connect-readonly profile is the gate
  }
  if (policyList.length === 0) return [...(targetAllowedTools ?? [])];
  if (!targetAllowedTools || targetAllowedTools.length === 0) return [...policyList];
  return policyList.filter((t) => targetAllowedTools.includes(t));
}
