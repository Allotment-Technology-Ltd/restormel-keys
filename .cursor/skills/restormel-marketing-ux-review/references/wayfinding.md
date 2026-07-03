
# Restormel UX Wayfinding Review

Use this skill when a user reports confusion about **which page they’re on**, or when navigation states can strand users (e.g. a collapsed sidebar that can’t be restored).

## UX checks

- **Recoverability**: Any collapsed/hidden nav must have an always-available control to restore it.
- **Current location**: The page has a clear, visible title (H1) and the nav indicates the active item.
- **Orientation**: “You are here” context is present (section label, breadcrumb, or consistent header).
- **A11y**:
  - Toggle controls are keyboard accessible and have correct `aria-pressed` or `aria-expanded`.
  - Focus order still works when nav is collapsed.
  - Skip links land at meaningful content.
- **State clarity**: Loading/error/empty/success states don’t remove the user’s ability to navigate.

## What to output when used

- **Blocking UX issue(s)** with reproduction steps
- **Minimal fix** (smallest code change that resolves it)
- **A11y notes** (what aria/keyboard behavior is required)

