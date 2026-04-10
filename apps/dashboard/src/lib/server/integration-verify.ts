/**
 * Provider integration verification: registry entry points for POST …/integrations/[id]/verify.
 * Live network probes belong in provider-specific modules; keep logs free of secrets and raw PII.
 */
export type IntegrationVerifyInput = {
  providerType: string;
  hasCredential: boolean;
};

export type IntegrationVerifyOutcome = {
  verificationStatus: "verified" | "failed" | "pending";
  detail: string;
};

export function runIntegrationVerificationProbe(input: IntegrationVerifyInput): IntegrationVerifyOutcome {
  if (!input.hasCredential) {
    return {
      verificationStatus: "failed",
      detail: "Add a provider credential before running verification.",
    };
  }
  const p = input.providerType.trim().toLowerCase();
  if (p === "openrouter" || p === "portkey" || p === "vercel_ai" || p === "vercel") {
    return {
      verificationStatus: "pending",
      detail:
        "Credential is stored. The dashboard does not call provider APIs from this action yet — send a test request through Restormel Resolve or use your gateway’s health checks.",
    };
  }
  return {
    verificationStatus: "pending",
    detail: "Credential is stored. Provider-specific automated probes are not enabled for this type yet.",
  };
}
