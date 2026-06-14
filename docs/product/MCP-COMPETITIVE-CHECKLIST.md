---
title: Restormel MCP — internal positioning checklist
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-13
last-reviewed: 2026-06-13
review-interval: P12M
---

# Restormel MCP — internal positioning checklist

**Audience:** engineering and GTM narrative (not public marketing unless legal review). **Purpose:** contrast Restormel’s MCP surface with common alternatives.

| Dimension | Generic single-product MCP servers | Cloud-only agent UIs | Restormel `@restormel/mcp` (Horizon) |
|-----------|-------------------------------------|-------------------------|--------------------------------------|
| Product breadth | One vendor API (e.g. one SaaS) | Often one host or closed catalog | **Keys + Testing + Graph + State** read helpers; Keys control-plane tools |
| Offline / air-gapped | Varies | Usually requires vendor cloud | **Suite read tools** need no network; stdio-only |
| Structured errors | Often prose-only | Varies | **`RST_*` / `RST_SUITE_*`** codes on suite tools + readiness |
| BYOK / routing story | Uncommon or opaque | N/A | **Restormel Keys** routing, policies, Gateway keys documented end-to-end |
| HTTP parity for agents | Rare for MCP tools | N/A | **Zuplo `POST /api/suite/invoke`** mirrors suite semantics with consumer keys |
| Doc ↔ agent parity | Weak | Weak | [THEME-L-MCP-PARITY.md](../architecture/THEME-L-MCP-PARITY.md) + canonical doc map |

**When to revisit:** After each **`@restormel/mcp`** minor that adds suite or control-plane tools, update this table if a row becomes inaccurate.
