/**
 * Command palette — navigation registry, result types, and client-side filtering.
 *
 * This module is importable by both the Svelte component and unit tests.
 * It has no server-side imports (no $lib/server/*).
 *
 * Nav-registry destinations are sourced from docs/design/ux-contracts.md §1 (the canonical
 * nav model). Per-stage cross-links are also added here so the registry stays the
 * single source of truth for palette nav commands.
 */
import { DASHBOARD_BASE } from "$lib/dashboard-base";

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type SearchResultKind =
  | "project"
  | "route"
  | "policy"
  | "gateway_key"
  | "model"
  | "ingest_run"
  | "graph_unit";

export type SearchResultItem = {
  kind: SearchResultKind;
  id: string;
  /** Display label (project name, route name, etc.). */
  title: string;
  /** Optional secondary context (project name for a route, key prefix, etc.). */
  subtitle: string | null;
  /** Dashboard URL to navigate to on selection. */
  url: string;
};

export type SearchResultGroup = {
  kind: SearchResultKind;
  label: string;
  items: SearchResultItem[];
};

export type SearchResponse = {
  groups: SearchResultGroup[];
  /** Milliseconds elapsed server-side (for honest latency note). */
  elapsed_ms: number;
};

// ---------------------------------------------------------------------------
// Navigation command types
// ---------------------------------------------------------------------------

export type NavCommand = {
  /** Unique id, stable across sessions (used as recent-item key). */
  id: string;
  label: string;
  /** Optional keyboard shortcut label (display only). */
  shortcut?: string;
  /** Section heading shown in the palette above this group. */
  section: string;
  url: string;
};

// ---------------------------------------------------------------------------
// Navigation registry (canonical ux-contracts §1 destinations + cross-links)
// ---------------------------------------------------------------------------

/** All navigation commands registered in the palette.
 *  Cross-link entries are prefixed with "Go to" to distinguish from entity search.
 *  R2: section names and URLs follow the north-star IA (redesign §2.2).
 */
export const NAV_COMMANDS: NavCommand[] = [
  // Work sections (the product loop)
  { id: "nav:home", label: "Home", section: "Navigate", url: DASHBOARD_BASE + "/home" },
  { id: "nav:sources", label: "Sources", section: "Navigate", url: DASHBOARD_BASE + "/sources" },
  { id: "nav:runs", label: "Runs", section: "Navigate", url: DASHBOARD_BASE + "/runs" },
  { id: "nav:claims", label: "Claims", section: "Navigate", url: DASHBOARD_BASE + "/claims" },
  { id: "nav:claims-memory", label: "Claims · Memory inbox", section: "Navigate", url: DASHBOARD_BASE + "/claims/memory" },
  { id: "nav:prove", label: "Prove", section: "Navigate", url: DASHBOARD_BASE + "/prove" },
  { id: "nav:agents", label: "Agents", section: "Navigate", url: DASHBOARD_BASE + "/agents" },
  { id: "nav:testing", label: "Testing", section: "Navigate", url: DASHBOARD_BASE + "/testing" },
  // Foundation group
  { id: "nav:connections", label: "Connections", section: "Navigate", url: DASHBOARD_BASE + "/integrations" },
  { id: "nav:gateway-keys", label: "Gateway keys", section: "Navigate", url: DASHBOARD_BASE + "/access" },
  { id: "nav:routes", label: "Routes", section: "Navigate", url: DASHBOARD_BASE + "/routes" },
  { id: "nav:ingest-routes", label: "Routes · Ingest routes", section: "Navigate", url: DASHBOARD_BASE + "/routes/ingestion" },
  { id: "nav:guard-rails", label: "Guard rails", section: "Navigate", url: DASHBOARD_BASE + "/policies" },
  { id: "nav:projects", label: "Projects", section: "Navigate", url: DASHBOARD_BASE + "/projects" },
  { id: "nav:model-catalog", label: "Model catalog", section: "Navigate", url: DASHBOARD_BASE + "/models" },
  { id: "nav:sandbox", label: "Request tester", section: "Navigate", url: DASHBOARD_BASE + "/sandbox" },
  // Observe group
  { id: "nav:logs", label: "Logs", section: "Navigate", url: DASHBOARD_BASE + "/logs" },
  { id: "nav:usage", label: "Usage", section: "Navigate", url: DASHBOARD_BASE + "/analytics" },
  { id: "nav:health", label: "Health", section: "Navigate", url: DASHBOARD_BASE + "/healthcheck" },
  // Out-of-nav (merges into Agents in R5)
  { id: "nav:dev-tools", label: "CLI & agents", section: "Navigate", url: DASHBOARD_BASE + "/dev-tools" },
  // Quick actions
  { id: "action:new-ingest-run", label: "New ingest run", section: "Actions", url: DASHBOARD_BASE + "/sources/ingest?step=launch" },
  { id: "action:new-project", label: "New project", section: "Actions", url: DASHBOARD_BASE + "/projects?create=1" },
  { id: "action:review-claims", label: "Review flagged claims", section: "Actions", url: DASHBOARD_BASE + "/claims?filter=review" },
  { id: "action:start-ingest-flow", label: "Start ingest (guided flow)", section: "Actions", url: DASHBOARD_BASE + "/sources/ingest" },
  // Cross-links: run → claims (W3.4 scope — scorecard → producing run handled in W2.3 coordination)
  { id: "cross:claims-review", label: "Claims · Needing review", section: "Actions", url: DASHBOARD_BASE + "/claims?filter=review" },
  { id: "cross:runs-latest", label: "Runs · Latest ingest run", section: "Actions", url: DASHBOARD_BASE + "/runs" },
  // Account
  { id: "nav:settings", label: "Profile & settings", section: "Account", url: DASHBOARD_BASE + "/settings" },
  { id: "nav:billing", label: "Subscription", section: "Account", url: DASHBOARD_BASE + "/billing" },
];

// ---------------------------------------------------------------------------
// Client-side filtering
// ---------------------------------------------------------------------------

/**
 * Filter nav commands by a query string.
 * Uses a simple substring/prefix match — good enough for <30 commands.
 * Returns results ordered by: exact match > starts-with > contains.
 */
export function filterNavCommands(commands: NavCommand[], query: string): NavCommand[] {
  if (!query.trim()) return commands;
  const q = query.toLowerCase().trim();
  const exact: NavCommand[] = [];
  const starts: NavCommand[] = [];
  const contains: NavCommand[] = [];
  for (const cmd of commands) {
    const label = cmd.label.toLowerCase();
    if (label === q) exact.push(cmd);
    else if (label.startsWith(q)) starts.push(cmd);
    else if (label.includes(q)) contains.push(cmd);
  }
  return [...exact, ...starts, ...contains];
}

/**
 * Fuzzy-match a query against a result item's title + subtitle.
 * Each token in the query must appear somewhere in the combined text.
 */
export function matchesQuery(item: SearchResultItem, query: string): boolean {
  if (!query.trim()) return true;
  const haystack = `${item.title} ${item.subtitle ?? ""}`.toLowerCase();
  return query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .every((token) => haystack.includes(token));
}

/**
 * Group search result items by kind. Preserves server order within each kind.
 */
export function groupSearchResults(items: SearchResultItem[]): SearchResultGroup[] {
  const kindMeta: Record<SearchResultKind, { label: string; order: number }> = {
    project: { label: "Projects", order: 0 },
    route: { label: "Routes", order: 1 },
    policy: { label: "Guard rails", order: 2 },
    gateway_key: { label: "Gateway keys", order: 3 },
    model: { label: "Models", order: 4 },
    ingest_run: { label: "Ingest runs", order: 5 },
    graph_unit: { label: "Claims", order: 6 },
  };
  const map = new Map<SearchResultKind, SearchResultItem[]>();
  for (const item of items) {
    const list = map.get(item.kind) ?? [];
    list.push(item);
    map.set(item.kind, list);
  }
  const groups: SearchResultGroup[] = [];
  const orderedKinds = (Object.entries(kindMeta) as [SearchResultKind, { label: string; order: number }][])
    .sort((a, b) => a[1].order - b[1].order)
    .map(([k]) => k);
  for (const kind of orderedKinds) {
    const items = map.get(kind);
    if (items && items.length > 0) {
      groups.push({ kind, label: kindMeta[kind].label, items });
    }
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Recent items (localStorage key)
// ---------------------------------------------------------------------------

export const RECENT_ITEMS_STORAGE_KEY = "rk_palette_recent";
export const RECENT_ITEMS_MAX = 5;

export type RecentItem = {
  id: string;
  label: string;
  url: string;
  kind: "nav" | SearchResultKind;
  visitedAt: number;
};

export function loadRecentItems(): RecentItem[] {
  try {
    const raw = localStorage.getItem(RECENT_ITEMS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    return parsed.filter(isRecentItem).sort((a, b) => b.visitedAt - a.visitedAt);
  } catch {
    return [];
  }
}

export function saveRecentItem(item: RecentItem): void {
  try {
    const items = loadRecentItems().filter((i) => i.id !== item.id);
    items.unshift(item);
    localStorage.setItem(RECENT_ITEMS_STORAGE_KEY, JSON.stringify(items.slice(0, RECENT_ITEMS_MAX)));
  } catch {
    // localStorage not available — ignore
  }
}

function isRecentItem(v: unknown): v is RecentItem {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.label === "string" &&
    typeof r.url === "string" &&
    typeof r.kind === "string" &&
    typeof r.visitedAt === "number"
  );
}
