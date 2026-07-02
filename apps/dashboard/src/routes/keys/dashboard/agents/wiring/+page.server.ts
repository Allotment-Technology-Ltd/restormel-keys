/**
 * R5: Agents / Wiring tab — moved from the /agents root page (which was /connect/mcp).
 * The workspace cache is warmed by the parent +layout.server.ts.
 */
import { perfSpan } from "$lib/debug/server-perf";
import type { PageServerLoad } from "./$types";
import { loadConnectAgentSetupForAgentsStep } from "$lib/server/connect/agent-setup-context";
import { requireConnectWorkspace } from "$lib/server/connect/workspace-cache";
import { sessionUser } from "$lib/server/session-user";
import { listRequestLogs } from "$lib/server/neon";
import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";

export const load: PageServerLoad = async (event) => {
  const user = sessionUser(event.locals);
  if (!user) {
    // `liveKeyIds` is inert here (same pattern as PR-2's null journey counts).
    return { signedIn: false, agentSetup: Promise.resolve(null), liveKeyIds: Promise.resolve([]) };
  }
  const agentSetup = (async () => {
    const endMcp = perfSpan("connect/mcp", "loadConnectAgentSetup");
    try {
      const workspace = await requireConnectWorkspace(event.locals, event.parent);
      const setup = await loadConnectAgentSetupForAgentsStep({
        workspaceId: workspace.id,
        userId: user.uid,
      });
      endMcp();
      return setup;
    } catch {
      endMcp();
      return null;
    }
  })();

  // RES-113 PR-7 (flag-ON only): the per-connection `LIVE` honesty signal.
  // Mirrors Home's `hasAppTraffic24h` probe (PR-3) but resolved PER KEY at the
  // panel level: a connection is LIVE iff ≥1 request in the last 24h is
  // attributed to its gateway key, with the pipeline's own `connect_ingest`
  // writes excluded — so a rebuild can never light a connection's LIVE chip
  // (REC-ADR-016). The window is the 500 most recent non-ingest rows (same
  // tradeoff as Home's live-pulse window). Flag-OFF: no query issued, resolves
  // [] — an inert field the flag-OFF page never reads (PR-2 null-field pattern).
  const journeyOn = Boolean((event.locals.moduleFlags ?? MVP_MODULE_DEFAULTS).onboardingJourney);
  const liveKeyIds: Promise<string[]> = journeyOn
    ? (async () => {
        const workspace = await requireConnectWorkspace(event.locals, event.parent);
        const now = Date.now();
        const logs = await listRequestLogs(workspace.id, {
          since: now - 24 * 60 * 60 * 1000,
          until: now,
          limit: 500,
          excludeSource: "connect_ingest",
        });
        const ids = new Set<string>();
        for (const log of logs) {
          // Belt-and-braces re-filter for legacy rows whose source tag lives
          // outside the JSONB predicate (mirrors the Home activity filter).
          if (log.source !== "connect_ingest" && log.gatewayKeyId) ids.add(log.gatewayKeyId);
        }
        return [...ids];
      })().catch(() => [])
    : Promise.resolve([]);

  return { signedIn: true, agentSetup, liveKeyIds };
};
