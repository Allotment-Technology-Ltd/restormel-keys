# Theme L — dashboard epic template

**Purpose:** Checklist for any new **hosted** capability that needs a home in [`apps/dashboard`](../../apps/dashboard) when the customer does not build their own UI.

**IA context:** [THEME-L-IA-MATRIX.md](./THEME-L-IA-MATRIX.md)

---

## Before building

- [ ] **Product owner:** Which pillar (Keys / Testing / Graph / Integrations)?
- [ ] **Surfaces:** Marketing blurb only, or docs, or signed-in dashboard, or MCP — update THEME-L-IA-MATRIX row.
- [ ] **Secrets:** No raw keys in UI or MCP output ([security-baseline.md](../governance/security-baseline.md)); masked prefixes / fingerprints only.

---

## Layout regions

| Region | Include |
|--------|---------|
| **Overview** | Summary, health, primary CTA, links to docs |
| **Activity** | Recent items, correlation-friendly ids (run, project), filters |
| **Detail** | Single resource inspector, related links |
| **Settings** | Configuration, integrations, env hints (placeholders only in copy) |

---

## Required UX states

Per [.cursor/rules/04-ux-safety.mdc](../../.cursor/rules/04-ux-safety.mdc):

- [ ] **Loading**
- [ ] **Empty** (first-time / no data)
- [ ] **Error** (recoverable message, no secret leakage)
- [ ] **Success** confirmation for mutations

---

## Implementation steps

1. [ ] Add or extend route under `apps/dashboard/src/routes/keys/dashboard/…`
2. [ ] Update [`nav-config.ts`](../../apps/dashboard/src/lib/nav-config.ts) (`PATH_TO_TITLE` if needed)
3. [ ] Use [`@restormel/keys-tokens`](../../packages/keys-tokens) / design system ([design-system-index.md](../design/design-system-index.md))
4. [ ] Add or update in-app docs under `/keys/docs` or product docs tree
5. [ ] Update [THEME-L-MCP-PARITY.md](./THEME-L-MCP-PARITY.md) if MCP tools are added

---

## Review

- [ ] **a11y:** Focus order, labels, meaningful status text
- [ ] **Mobile:** Dashboard is desktop-first; confirm mobile-gate copy still correct if touched
