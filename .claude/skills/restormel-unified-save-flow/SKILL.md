---
name: restormel-unified-save-flow
description: >-
  Collapse scattered multi-step save / apply / publish actions in the Restormel
  dashboard into ONE honest, stateful action per intent — and keep the user in
  context after the action (never bounce them out). Use when a setup or editor
  surface needs more than one click to take effect (e.g. "save config" + "apply
  to server" + "publish"), when a save/publish redirects the user away from the
  thing they were editing, when designing the unsaved→saving→saved/live state
  machine for a button, or when an operator reports "it took three saves" or "it
  threw me out to another screen". Pairs with restormel-neu-brutalist-ui for the
  visual grammar of the action bar and status pill.
---

# Restormel unified save / publish flow

Interaction-design conventions for state-changing editor surfaces in the Keys
dashboard. Two recurring defects this skill exists to prevent:

1. **Save sprawl** — one logical "make my edit take effect" intent fragmented
   across several buttons in several tabs (e.g. *Save route* + *Apply to server*
   + *Publish draft*), so the operator never knows whether their change is live.
2. **Context ejection** — a save/apply/publish that navigates the user away from
   the record they were editing (usually a stray `goto`, a `throw redirect` in a
   load that re-runs, or an over-broad `invalidateAll()` that re-runs a layout
   load with redirect branches).

## Principle: one intent → one action → honest state

Map the real persistence steps first. There are usually three distinct *intents*,
not three *clicks*:

| Intent | What it persists | Keep separate? |
|--------|------------------|----------------|
| Save the working configuration | the editable record + its children (draft) | **No** — merge every "save this edit" button into ONE save per surface |
| Make it take effect on the server / gateway | the same write, plus any gateway/graph sync | usually the SAME operation as the save — **merge** unless the sync is a genuinely separate, slow, idempotent push the operator should trigger deliberately |
| Promote draft → live (publish) | a `publishedVersion` / live pointer | **Yes, if a draft↔live distinction is real** — but make it ONE deliberate, clearly-labelled action, visible from the surface you're editing, not buried in another tab |

Decision rule:
- If "apply to server" and "publish" write the same bytes to the same place,
  they are the same operation — collapse them.
- If publish promotes a saved draft to live (`version` vs `publishedVersion`),
  keep it as a single deliberate step, but surface it next to the work (an
  always-visible action bar / banner), and make its state truthful.
- Never require the operator to remember to visit a second tab to make their
  change real.

## The state machine (label + aria-live, no lies)

A unified action button must reflect the true persistence state. Minimum states:

```
idle/clean     → "Saved" (disabled)         // nothing to do
dirty/unsaved  → "Save changes" (enabled)    // local edits not on server
saving         → "Saving…" (disabled, busy)  // write in flight
saved/synced   → "Saved" + last-saved time   // server holds it; show timestamp
error          → inline error + "Retry"      // never silently swallow
```

When a draft↔live split exists, add a second, clearly distinct control:

```
draft-differs-from-live → "Publish (vN → live)" with a confirm that states the
                          blast radius (diff vs current live version)
live-matches-draft      → "Live · vN" (disabled / informational)
```

Rules:
- Drive labels from real flags (`dirty`, `saving`, `version !== publishedVersion`),
  never from optimistic guesses.
- Wrap status text in `aria-live="polite"` (`role="status"`).
- A publish that makes traffic flow MUST confirm and state what goes live.
- Show a last-saved timestamp once synced — "Saved" with no proof reads as a lie.

## Never eject the user (the redirect rule)

After save / apply / publish the user **stays on the record they were editing**.

- **Do not** `goto()` to a list/parent screen on success. The breadcrumb is the
  way back; success is staying put with updated state.
- **Refresh narrowly.** SvelteKit: prefer the page's scoped `depends()` key via
  `invalidate('app:<thing>:<id>')`, **not** `invalidateAll()`. `invalidateAll()`
  re-runs every `load` on the page *including layout loads* — and Restormel
  dashboard layout loads contain `throw redirect(...)` branches (auth, gated
  sections, malformed-param fixups). On a transient backend blip during that
  re-run, those branches can fire and bounce the operator to `/projects` or
  `/login`. Scope the invalidation to the data that actually changed.
- If the editor page already declares `depends('app:route-detail:<id>')` (it
  does), every mutation on that page should refresh through that key. Audit
  child components (e.g. a flow canvas) for stray `invalidateAll()` and replace
  with the same scoped refresh the parent uses.
- If you must navigate (rare), navigate to a route-context view (the record or
  its own sub-view), never to the projects/parent list.

## Where the bodies are buried (Keys specifics)

- Route editor: `apps/dashboard/src/routes/keys/dashboard/projects/[id]/routes/[routeId]/+page.svelte`
  declares `depends('app:route-detail:<id>')`; refresh via
  `invalidate('app:route-detail:<id>')` (the page's `refreshRouteDetail()`).
- `RouteFlowCanvas.svelte` ("Apply to server") must refresh through the same
  scoped key the parent uses — pass a refresh callback down rather than calling
  `invalidateAll()` inside the child.
- Publish endpoint `…/routes/[routeId]/publish` promotes `version` →
  `publishedVersion`; the draft↔live split is real, so publish stays a deliberate
  action — but it lives on an always-visible action bar, not only the Versions tab.
- `VersionsPanel.svelte` owns the publish call; it already calls `onMutated()`
  (scoped refresh) and stays put — reuse it, don't reinvent publish.

## Server-side (when the action writes)

- Re-authorize on the write (project/workspace scope) — never trust the client.
- Parameterised SQL only for any binding/route write.
- Return JSON (`{ data }` / `{ error }`); the publish/apply endpoints must NOT
  `throw redirect` — navigation is the client's decision, and "stay put" is it.

## Checklist before opening the PR

- [ ] Every "save this edit" button on the surface collapsed to one save per intent.
- [ ] Draft→live kept as ONE deliberate action only if the split is real, and it
      is visible from the editing surface (not stranded in another tab).
- [ ] Button label + status reflect true state (idle/dirty/saving/saved/error;
      draft-differs/live) with `aria-live`.
- [ ] No `goto`/`redirect` to a list screen on success; refresh is scoped
      (`invalidate('app:<thing>:<id>')`, not `invalidateAll()`).
- [ ] Child components refresh through the parent's scoped key, no stray
      `invalidateAll()`.
- [ ] Visual grammar via restormel-neu-brutalist-ui (action bar = ledger cap +
      body, mono labels, hard borders).
- [ ] `pnpm --filter dashboard run check` clean; high-risk-security pass if the
      write touches server routes / DB.
