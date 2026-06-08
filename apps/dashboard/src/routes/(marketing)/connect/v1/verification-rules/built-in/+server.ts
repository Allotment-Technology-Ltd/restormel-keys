/**
 * GET /connect/v1/verification-rules/built-in — the built-in "Restormel Core v1" rule set.
 * Static, public reference config (no workspace scoping).
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { handleGetBuiltInVerificationRules } from "$lib/server/connect-v1/verification-rules-handler";

export const GET: RequestHandler = async () => {
  const outcome = handleGetBuiltInVerificationRules();
  return json(outcome.ruleSet, { status: 200 });
};
