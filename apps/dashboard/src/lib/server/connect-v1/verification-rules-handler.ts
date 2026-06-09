/**
 * GET /connect/v1/verification-rules[/built-in] — verification rule sets (Stage 4C).
 *
 * `active` resolves the rule set in force for a workspace: the workspace's domain-pack override
 * (inline weights or a referenced rule set id) falling back to the built-in "Restormel Core v1".
 * `built-in` returns the core rule set definition (static, public reference config).
 */
import type { VerificationRuleSet, DomainPackVerificationRules } from "@restormel/contracts/verification-rules";
import { RESTORMEL_CORE_RULE_SET, resolveVerificationRuleSet } from "@restormel/graphrag-core";
import { authorizeKnowledgeWorkspaceRequest } from "./auth.js";
import { getSelectedDomainPackId, getDomainPackForUi } from "$lib/server/connect/domain-pack-service";

export type VerificationRulesOutcome =
  | { ok: true; status: 200; ruleSet: VerificationRuleSet }
  | { ok: false; status: number; body: Record<string, unknown> };

export async function handleGetActiveVerificationRules(args: {
  locals: App.Locals;
  workspaceId: string | null;
  projectId?: string;
}): Promise<VerificationRulesOutcome> {
  const workspaceId = args.workspaceId?.trim();
  if (!workspaceId) {
    return { ok: false, status: 400, body: { error: "invalid_request", message: "workspace_id is required" } };
  }

  const auth = await authorizeKnowledgeWorkspaceRequest({
    locals: args.locals,
    workspaceId,
    projectId: args.projectId,
  });
  if ("error" in auth && "status" in auth) {
    return { ok: false, status: auth.status, body: { error: auth.error, message: auth.message } };
  }

  // Resolve the workspace's domain-pack verification override (best-effort: fall back to core).
  let override: DomainPackVerificationRules | undefined;
  try {
    const packId = await getSelectedDomainPackId(auth.workspaceId);
    if (packId) {
      const pack = await getDomainPackForUi(auth.workspaceId, packId);
      override = pack?.verification_rules;
    }
  } catch {
    override = undefined;
  }

  return { ok: true, status: 200, ruleSet: resolveVerificationRuleSet(override ?? null) };
}

export function handleGetBuiltInVerificationRules(): { ok: true; status: 200; ruleSet: VerificationRuleSet } {
  return { ok: true, status: 200, ruleSet: RESTORMEL_CORE_RULE_SET };
}
