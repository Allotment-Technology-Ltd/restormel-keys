# 05 · State model & interactions

The valuable, framework-agnostic core. The prototype's React state ports **directly** to Svelte —
the *shape* below is what matters, not the React.

---

## 1. The state object

Three things fully describe where a user is in the journey. Persisted to `localStorage` (key
`restormel_proto_v2` in the mock; use a real store keyed per workspace in production).

```ts
type Persona = 'initial' | 'learning' | 'advanced';

interface OnboardingState {
  persona: Persona;          // demo switch in the prototype; real = inferred/asked
  screen: string;            // current section slug (home/build/verify/connect/store/…)
  progress: {                // which milestones are complete
    m0?: boolean; m1?: boolean; m2?: boolean; m3?: boolean; m4?: boolean;
  };
  graph: {
    ideas: number;           // 0 before ingest → 1204 after
    trust: number;           // 100 demo · 88 post-ingest · 97 post-verify
    sources: number;         // 0 → 3
    flagged: number;         // 6 weak claims after ingest → 0 after triage
    stack: 'managed' | 'self';
    connections: number;     // apps connected
  };
}
```

Fresh state: `{ persona, screen:'home', progress:{}, graph:{ ideas:0, trust:100, sources:0,
flagged:0, stack:'managed', connections:0 } }`.

## 2. Personas → path

```ts
const PATHS = {
  initial:  ['m0','m1','m4'],            // minimum to a live graph
  learning: ['m0','m1','m2','m4'],       // + verify
  advanced: ['m0','m1','m2','m3','m4'],  // + own store
};
```
The "next milestone after X" = the next entry in the persona's path. Drives every "Next: …" CTA
and which Home tile is the primary (yellow) action.

## 3. Milestone effects (what completing each does to `graph`)

```ts
function applyEffect(id, g) {
  if (id === 'm1') return { ...g, ideas:1204, sources:3, flagged:6, trust:88 }; // ingest built it
  if (id === 'm2') return { ...g, flagged:0, trust:97 };                         // triage cleared
  if (id === 'm3') return { ...g, stack:'self' };                                // moved to own DB
  if (id === 'm4') return { ...g, connections: Math.max(1, g.connections) };     // first connection
  return g;
}
```
Completing a milestone = set `progress[id]=true` **and** apply its effect. These numbers are the
demo's; wire to real API responses in production but keep the same fields.

## 4. Section ↔ milestone mapping

`m0→home · m1→build · m2→verify · m3→store · m4→connect`. Navigation uses section slugs; the
journey logic uses milestone ids. Keep both and map between them (`MILE_TO_SECTION`).

## 5. Derived values (compute, don't store)

- **trust (in M2)** = `88 + (sourcesGate?3:0) + (embedGate?2:0) + (validateGate?4:0)` → 97 when all
  clear. (In Svelte: `$derived`.)
- **graph name** = `ideas ? 'acme-graph' : 'starter-graph'`.
- **live** = `connections > 0`.
- **Home primary action** = first incomplete milestone in the persona path → its tile, filled
  yellow. Everything else ghost.

## 6. Per-screen local state (transient, not persisted)

- **M0 / Ask:** `{ asking, answer }` — 800ms fake "searching" then show answer+citations.
- **M1:** `{ step: sources|configure|running|done, sources[], keyVal, adv, runIdx, fault, runErr,
  rateMsg, keyErr }`. `runIdx` walks the stage list on a timer; `fault` is the prototype's
  edge-case injector (none|fail|rate|key).
- **M2:** `{ srcDone, embDone, valDone, qi }` (triage index).
- **M3:** `{ step: connect|verifying|found|keys, engine, choice: use|add|separate }`.
- **M4:** `{ wstep: type|access|name, draft:{type,access,name}, connections[] }`.

## 7. Edge / unhappy states (REQUIRED — honesty is a product principle)

Built into the prototype; reproduce them. Trigger points & messaging:

| Where | State | Behaviour & copy |
|---|---|---|
| M1 run | **Stage fails** | Active stage → coral "failed" row (✕). Coral banner names the stage + "Earlier stages are saved — retry the run." + **↻ Retry run** (clears error, re-runs clean). |
| M1 run | **Rate-limited** | Amber banner: "Provider rate-limited. Backing off and retrying automatically — no action needed." Stage shows "rate-limited…", then resumes itself. |
| M1 configure | **Bad / expired key** | On Launch: stay on Configure, coral banner "Provider rejected this key. It's expired or lacks access…", don't enter the run. |
| Runs / Sources | **Empty** | Dashed empty card ("No runs yet" / "No sources yet") + a button to the next action. |
| M3 connect | **Can't reach DB** | (extend) connection failure → error + retry, same coral pattern; nothing destructive happened. |
| Home tiles | **Locked** | Pre-requisite not met (e.g. Connect before ingest) → lock icon + plain reason, not a dead disabled control. |

Pattern for all failures: **name what failed, reassure about what's safe, offer the single
obvious recovery.** Never a generic toast.

## 8. Animation / transitions

- Stage progress bars + spinners during ingest (the run console is the one "alive" screen).
- Button hover-lift / active-press (token-driven, `.08s`).
- Trust meter fill animates as gates clear.
- Honor `prefers-reduced-motion` (disable transitions; show end-state, never a stuck
  pre-animation opacity:0).

## 9. Reference

`Restormel Prototype.html` + `proto-app.jsx` implement all of the above end-to-end across the
three personas, including every edge state.
