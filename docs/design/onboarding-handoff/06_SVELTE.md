# 06 · React → Svelte translation guide

The clickable prototype is React (`proto-app.jsx`) **only because that was the fastest way to
mock an interactive flow.** Restormel Keys is Svelte — so **recreate, don't port.** This guide
makes the translation mechanical.

> Golden rule: take the **structure, copy, state shape, and behaviour** from the mock; take the
> **styling** from the existing codebase token layer and utility classes. Delete the prototype's
> inline CSS entirely.

---

## 1. Where this lives in the repo

Suggested feature folder (confirm conventions first):

```
apps/dashboard/src/
  routes/
    (app)/                      # authenticated shell
      +layout.svelte            # sidebar + topbar (extend existing)
      +page.svelte              # HOME
      build/+page.svelte        # M1
      verify/+page.svelte       # M2
      connect/+page.svelte      # M4 (+ /connect/[id] detail)
      settings/
        providers/+page.svelte
        store/+page.svelte      # M3
        routes/+page.svelte
        audit/+page.svelte
        metrics/+page.svelte
  lib/
    onboarding/
      graph.svelte.ts           # the state store (§3)
      personas.ts               # PATHS + persona meta
      AskGraph.svelte           # M0/M4 ask UI (shared)
      GraphHero.svelte          # home hero
      StatusTile.svelte         # home tiles
      ingest/
        IngestWizard.svelte     # M1 step machine
        SourceList.svelte
        ModelDisclosure.svelte
        RunConsole.svelte       # stages + edge states
      verify/
        TrustMeter.svelte
        GateCard.svelte
        ClaimTriage.svelte
      connect/
        ConnectWizard.svelte    # type → access → name
        ConnectionsList.svelte
        ConnectionRow.svelte
```

## 2. Hook → rune mapping

| React (prototype) | Svelte 5 |
|---|---|
| `useState(x)` | `let v = $state(x)` |
| `const d = useMemo(()=>…)` / derived `const trust = …` | `let d = $derived(…)` |
| `useEffect(()=>{…},[dep])` | `$effect(() => { … })` (reads its deps automatically) |
| `useEffect(()=>{…},[])` mount | `onMount(() => { … })` |
| `useRef(null)` (timer handle) | a plain `let tmr` (module/closure variable) |
| `setS(p => ({...p, k:v}))` | mutate `$state` directly: `state.k = v` (runes are deep-reactive) |
| props `function C({s, go})` | `let { s, go } = $props()` |
| `onClick={fn}` | `onclick={fn}` |
| conditional `{cond && <X/>}` | `{#if cond}<X/>{/if}` |
| list `arr.map(x => <Row/>)` | `{#each arr as x}<Row/>{/each}` |
| `React.Fragment` | nothing / `<svelte:fragment>` |

## 3. The state store (`graph.svelte.ts`)

Port the prototype's persisted state (`05_STATE.md`) to a runes store:

```ts
// lib/onboarding/graph.svelte.ts
import { PATHS, applyEffect, freshState } from './personas';

const KEY = 'restormel_onboarding';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? freshState('learning'); }
  catch { return freshState('learning'); }
}

export const onboarding = $state(load());

export function persist() { localStorage.setItem(KEY, JSON.stringify(onboarding)); }
export function go(section: string) { onboarding.screen = section; persist(); }
export function complete(id: string) {
  onboarding.progress[id] = true;
  Object.assign(onboarding.graph, applyEffect(id, onboarding.graph));
  persist();
}
export function setPersona(p) { Object.assign(onboarding, freshState(p)); persist(); }
```

In production: replace `localStorage` with the real graph/workspace API; keep the same field
names so components don't change. The persona switch becomes inferred state, not a demo toggle.

## 4. Timers (the run console)

The prototype walks `runIdx` through the ingest stages on `setTimeout`. In Svelte:

```svelte
<script>
  let runIdx = $state(0);
  let runErr = $state(null);
  onMount(() => {
    let i = 0, t;
    const FAULT_AT = 1; // Relate
    const tick = () => {
      if (i === FAULT_AT && fault === 'fail') { runErr = STAGES[FAULT_AT]; return; }
      i++;
      if (i < STAGES.length) { runIdx = i; t = setTimeout(tick, 850); }
      else { runIdx = STAGES.length; t = setTimeout(() => step = 'done', 650); }
    };
    t = setTimeout(tick, 850);
    return () => clearTimeout(t);
  });
</script>
```
In production these timers are replaced by **real ingest progress** (SSE / polling). Keep the
per-stage UI; feed it real stage events. The edge states (`05_STATE.md` §7) map onto real error
events — don't drop them.

## 5. Styling

- **Delete** all `<style>` blocks and inline `style=` from the prototype. They reproduce the
  token system; you already have it.
- Use the existing classes: `.btn .btn-primary`, `.card`, `.brut-kicker`, `.input`,
  `.status-success/-warning/-error`, the `--color-*`/`--space-*`/`--shadow-*` vars.
- For component-local layout, Svelte scoped `<style>` is fine — but reference token vars, never
  literal hexes/px-from-memory.
- Icons: the mock uses small inline SVGs (chat bubble, plug, exchange arrows, code brackets,
  node-graph for connection types). Use the codebase's icon set if there is one; otherwise lift
  those SVGs from `M4 Connections.html`.

## 6. Don't port

- The persona segmented control in the top bar (it's a **demo** affordance). Persona is real,
  inferred state in production.
- The `fault` injector control on M1 Configure (demo-only) — but **do** keep the failure *states*
  it triggers, wired to real errors.
- The `localStorage` reset button and any "prototype"-labelled chrome.

## 7. Build sequence

Follow `07_PROMPTS.md` — it's ordered so each step yields something runnable: store → nav/shell →
Home → M1 (hardest) → M0 → M4 → M2 → M3 → polish.
