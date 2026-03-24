/** Sections that can be hidden from the dashboard UI via RESTORMEL_DASHBOARD_UI_HIDDEN. */
export const DASHBOARD_UI_SECTIONS = [
  "policies",
  "routes",
  "models",
  "providers",
  "analytics",
  "logs",
  "healthcheck",
  "sandbox",
  "copy-for-ci",
  "dev-tools",
  "billing",
  "projects",
] as const;

export type DashboardUiSection = (typeof DASHBOARD_UI_SECTIONS)[number];

export const DASHBOARD_UI_SECTION_SET = new Set<string>(DASHBOARD_UI_SECTIONS);
