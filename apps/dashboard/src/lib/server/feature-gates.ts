import type { IntegrationsLocals } from "$lib/server/integrations-auth";

export type ProFeature = "healthcheck" | "embedding";

function parseCsv(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Temporary pro gating: env-driven.
 * - Production: disabled unless RESTORMEL_PRO_FEATURES includes the feature (or "all")
 * - Dev: enabled by default unless RESTORMEL_PRO_DEV_DEFAULT=false
 */
export function isProFeatureEnabled(feature: ProFeature): boolean {
  const allowAll = (process.env.RESTORMEL_PRO_FEATURES ?? "").trim().toLowerCase();
  if (allowAll === "all") return true;
  const enabled = parseCsv(process.env.RESTORMEL_PRO_FEATURES).has(feature);
  if (process.env.NODE_ENV !== "production") {
    const devDefault = (process.env.RESTORMEL_PRO_DEV_DEFAULT ?? "true").toLowerCase() !== "false";
    return enabled || devDefault;
  }
  return enabled;
}

/**
 * Placeholder for future billing-based entitlements. For now, this is purely env-gated.
 * We keep the signature local-aware so we can add workspace plan checks later.
 */
export function hasProAccess(_locals: IntegrationsLocals, feature: ProFeature): boolean {
  return isProFeatureEnabled(feature);
}

