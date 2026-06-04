import type { DashboardUiSection } from "$lib/dashboard-ui-sections";

/** Monitor sub-areas shown in coming-soon nav (maps to Usage / Logs / Health pages). */
export type MonitorInterestItem = "usage" | "logs" | "health";

export const MONITOR_COMING_SOON_ITEMS: { id: MonitorInterestItem; label: string }[] = [
  { id: "usage", label: "Usage" },
  { id: "logs", label: "Logs" },
  { id: "health", label: "Health" },
];

const MONITOR_INTEREST_SET = new Set<string>(["usage", "logs", "health"]);

export function parseMonitorInterestParam(raw: string | null): MonitorInterestItem | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  return MONITOR_INTEREST_SET.has(s) ? (s as MonitorInterestItem) : null;
}

export function dashboardSectionToMonitorInterest(section: DashboardUiSection): MonitorInterestItem | null {
  if (section === "analytics") return "usage";
  if (section === "logs") return "logs";
  if (section === "healthcheck") return "health";
  return null;
}
