import { describe, expect, it } from "vitest";
import {
  VERIFYING_PROXY_POLICY_TYPE,
  defaultProxyPolicyRule,
  effectiveToolAllowList,
  isUpstreamAllowedByPolicy,
  meetsTrustThreshold,
  parseProxyPolicyRule,
} from "./proxy-policy";

describe("proxy policy (verifying proxy B4)", () => {
  it("uses the verifying_proxy policy type (extends the policies table, not a fork)", () => {
    expect(VERIFYING_PROXY_POLICY_TYPE).toBe("verifying_proxy");
  });

  it("defaults to deny-by-default (no upstreams, no tools, threshold 0, readonly profile)", () => {
    const rule = defaultProxyPolicyRule();
    expect(rule.allowedUpstreams).toEqual([]);
    expect(rule.allowedTools).toEqual([]);
    expect(rule.profile).toBe("connect-readonly");
    expect(isUpstreamAllowedByPolicy(rule, "any-id")).toBe(false);
  });

  it("permits only explicitly allowed upstreams", () => {
    const rule = parseProxyPolicyRule({ allowedUpstreams: ["up-1", "up-2"] });
    expect(isUpstreamAllowedByPolicy(rule, "up-1")).toBe(true);
    expect(isUpstreamAllowedByPolicy(rule, "up-3")).toBe(false);
  });

  it("clamps and applies the abstention threshold (include semantics)", () => {
    const rule = parseProxyPolicyRule({ minTrustScore: 0.7 });
    expect(meetsTrustThreshold(rule, 0.7)).toBe(true);
    expect(meetsTrustThreshold(rule, 0.69)).toBe(false);
    expect(meetsTrustThreshold(rule, 1)).toBe(true);
    // Out-of-range values are clamped to [0,1].
    expect(parseProxyPolicyRule({ minTrustScore: 5 }).minTrustScore).toBe(1);
    expect(parseProxyPolicyRule({ minTrustScore: -3 }).minTrustScore).toBe(0);
  });

  it("intersects policy + target tool lists (narrows, never widens)", () => {
    const rule = parseProxyPolicyRule({ allowedTools: ["search_docs", "get_status"] });
    expect(effectiveToolAllowList(rule, ["get_status", "list_items"])).toEqual(["get_status"]);
    // Policy-only narrowing.
    expect(effectiveToolAllowList(rule, null)).toEqual(["search_docs", "get_status"]);
    // Target-only narrowing.
    expect(effectiveToolAllowList(defaultProxyPolicyRule(), ["only_this"])).toEqual(["only_this"]);
    // No explicit narrowing → null (connect-readonly profile is the gate).
    expect(effectiveToolAllowList(defaultProxyPolicyRule(), null)).toBeNull();
  });

  it("normalises an arbitrary/garbage rule_definition safely", () => {
    expect(parseProxyPolicyRule(null)).toEqual(defaultProxyPolicyRule());
    expect(parseProxyPolicyRule("nope")).toEqual(defaultProxyPolicyRule());
    expect(parseProxyPolicyRule({ allowedTools: [1, "ok", null] }).allowedTools).toEqual(["ok"]);
  });
});
