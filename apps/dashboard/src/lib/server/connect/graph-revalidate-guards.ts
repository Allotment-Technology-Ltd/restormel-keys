import type { ConnectGraphRevalidateScope } from "@restormel/contracts/connect";
import type { ConnectGraphStatsView } from "$lib/server/connect/graph-explorer-service";

/** Returns a user-facing error when the requested scope has nothing to process. */
export function graphRevalidateEmptyMessage(
  stats: ConnectGraphStatsView | null,
  scope: ConnectGraphRevalidateScope,
): string | null {
  if (!stats || stats.units === 0) {
    return "Your graph has no ideas to re-validate yet.";
  }

  if (scope === "quarantine" && stats.validation.awaiting_triage === 0) {
    return "No quarantined ideas need auto-remediation right now.";
  }

  if (scope === "unsupported" && stats.validation.unsupported_untriaged === 0) {
    return "No unsupported ideas awaiting review match this scope.";
  }

  return null;
}
