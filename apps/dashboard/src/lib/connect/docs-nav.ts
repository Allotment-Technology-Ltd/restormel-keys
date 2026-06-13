/**
 * Knowledge in-app docs sidebar — single source for navigation blocks.
 * Mirrors the Keys docs-nav structure (DocsNavBlock) so DocsShell can render it.
 */
import type { DocsNavBlock } from "$lib/keys/docs-nav";

export const knowledgeDocsNavBlocks: DocsNavBlock[] = [
  { kind: "link", href: "/docs", label: "Restormel docs" },
  { kind: "link", href: "/connect", label: "Connect" },
  {
    kind: "section",
    label: "Concepts",
    ariaLabel: "Concepts section",
    items: [
      { href: "/connect/docs", label: "Overview" },
      { href: "/keys/docs/guides/verified-context", label: "Verified context" },
      { href: "/connect/docs#endpoints", label: "Endpoints" },
      { href: "/connect/docs#contract", label: "Contract" },
    ],
  },
  { kind: "divider" },
  {
    kind: "section",
    label: "Sub-products",
    ariaLabel: "Sub-products section",
    items: [
      { href: "/connect/docs#ingest", label: "Ingest" },
      { href: "/connect/docs#retrieve", label: "Retrieve" },
      { href: "/connect/docs#verify", label: "Verify" },
    ],
  },
  { kind: "divider" },
  {
    kind: "section",
    label: "Guides",
    ariaLabel: "Guides section",
    items: [
      {
        href: "/keys/docs/guides/connect-first-graph-onboarding",
        label: "First graph onboarding",
      },
    ],
  },
  { kind: "divider" },
  {
    kind: "section",
    label: "Operate",
    ariaLabel: "Operate section",
    items: [{ href: "/connect/docs#mcp", label: "MCP tools" }],
  },
];
