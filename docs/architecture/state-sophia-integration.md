# SOPHIA — wiring `@restormel/state` (Stoa + escalation)

SOPHIA’s **Stoa** dialogue stack (`src/routes/api/stoa/dialogue/+server.ts`), **prompt history** (`src/lib/server/stoa/prompt.ts`), and **escalation / summarization** (`src/lib/server/stoa/escalation.ts`) already mutate conversation state in production. This document describes how to **emit Restormel State events** alongside that logic without extracting Firebase or document stores into this monorepo.

**Prerequisites:** `@restormel/state` and `@restormel/context-packs` from npm (tag **`platform-v*`** train) or workspace tarballs.

**Stoa-specific builders** (turn digest, summarization, scope clear) are **not** exported from `@restormel/state` — they are SOPHIA-only. Copy the reference module below into the SOPHIA repo (for example `src/lib/server/stoa/restormelStoaStateEvents.ts`) and import from there.

## Reference module (copy into SOPHIA)

```ts
// SOPHIA-only — Stoa dialogue boundaries. Keep in sync with docs/architecture/state-sophia-integration.md
import type { StateEvent } from "@restormel/state";

const DEFAULT_STOA_SCOPE = "stoa_session";

/** Compact user-turn digest at a Stoa dialogue boundary. No secrets in `user_turn_digest`. */
export function createStoaTurnDigestEvents(params: {
  id: string;
  ts: string;
  run_id: string;
  scope?: string;
  user_turn_digest_cell_id: string;
  user_turn_digest: string;
}): StateEvent[] {
  const scope = params.scope ?? DEFAULT_STOA_SCOPE;
  return [
    {
      type: "memory_cell_upsert",
      id: params.id,
      ts: params.ts,
      scope,
      cell_id: params.user_turn_digest_cell_id,
      text: params.user_turn_digest,
      run_id: params.run_id,
    },
  ];
}

/** Escalation / history summarization: drop `remove_cell_ids`, insert `summary_text`. */
export function createStoaHistorySummarizationEvent(params: {
  id: string;
  ts: string;
  run_id: string;
  scope?: string;
  remove_cell_ids: string[];
  summary_cell_id: string;
  summary_text: string;
  pinned?: boolean;
}): StateEvent {
  const scope = params.scope ?? DEFAULT_STOA_SCOPE;
  return {
    type: "memory_summarize_compact",
    id: params.id,
    ts: params.ts,
    scope,
    remove_cell_ids: [...params.remove_cell_ids],
    summary_cell_id: params.summary_cell_id,
    summary_text: params.summary_text,
    pinned: params.pinned,
    run_id: params.run_id,
  };
}

/** New Stoa thread: empty default `stoa_session` scope in the projection. */
export function createStoaScopeClearEvent(params: {
  id: string;
  ts: string;
  run_id: string;
  scope?: string;
}): StateEvent {
  return {
    type: "scope_clear",
    id: params.id,
    ts: params.ts,
    scope: params.scope ?? DEFAULT_STOA_SCOPE,
    run_id: params.run_id,
  };
}
```

| Helper | When to emit |
|--------|----------------|
| `createStoaTurnDigestEvents` | After persisting the user turn (or a **redacted** digest) at a dialogue step. |
| `createStoaHistorySummarizationEvent` | When escalation compresses transcript chunks into one summary cell. |
| `createStoaScopeClearEvent` | When starting a **new** Stoa session / thread and you want `stoa_session` cleared. |

## 1. Choose storage for the event log

Keep your existing conversation / thread documents. Add either:

- A sub-collection or array field `state_events` (append-only, max length enforced in app code), or
- A parallel collection keyed by `thread_id` with ordered writes.

Ordering and ids: [state-host-persistence-recipe.md](./state-host-persistence-recipe.md).

Events are plain JSON matching `StateEvent` from `@restormel/state` (`memory_cell_upsert`, `memory_summarize_compact`, etc.).

## 2. Turn boundary (dialogue `+server.ts`)

After you persist the user message (or a redacted digest):

```ts
import { createStoaTurnDigestEvents } from "$lib/server/stoa/restormelStoaStateEvents"; // your path

const events = createStoaTurnDigestEvents({
  id: crypto.randomUUID(),
  ts: new Date().toISOString(),
  run_id: runId,
  user_turn_digest_cell_id: `turn-${turnIndex}`,
  user_turn_digest: redactedUserSummaryText,
});
await appendStateEvents(threadId, events);
```

**Security:** Never store raw API keys or full provider payloads in `user_turn_digest`; follow `docs/governance/security-baseline.md` patterns.

## 3. Escalation / history summarization (`escalation.ts`)

```ts
import { createStoaHistorySummarizationEvent } from "$lib/server/stoa/restormelStoaStateEvents";

await appendStateEvents(threadId, [
  createStoaHistorySummarizationEvent({
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    run_id: runId,
    remove_cell_ids: obsoleteDigestIds,
    summary_cell_id: `summary-${batchId}`,
    summary_text: modelSummaryText,
  }),
]);
```

## 4. New dialogue thread

Call **`createStoaScopeClearEvent`** when starting a fresh Stoa session if you want the default `stoa_session` scope emptied in the projection.

## 5. Internal debug page (admin)

1. Load events for a thread, sort by `ts` then `id` (same order as the reducer).
2. `projectWorkingMemory(events, policy)` → view.
3. `workingMemoryToDebugJson(view)` → JSON for an operator-only route or support tool.

Optional: render `workingMemoryToPromptBlock(view, ["stoa_session", "user_preferences"])` next to the live prompt for side-by-side debugging.

## 6. Context packs + observability

When building `ContextPackRetrievalInput` for the engine pass:

```ts
import {
  attachCorrelationToRetrievalInput,
  observabilityCorrelationFromView,
  projectWorkingMemory,
} from "@restormel/state";

const view = projectWorkingMemory(events, policy);
const input = attachCorrelationToRetrievalInput(contextPackInputFromRetrieval(result), {
  run_id: runId,
  retrieval_version: retrievalVersion,
  state_sequence: view.last_sequence,
  materialized_memory_event_ids: view.applied_event_ids.slice(-20),
});

const traceMeta = observabilityCorrelationFromView(runId, view);
// attach traceMeta to RunTrace.metadata or structured logs
```

## 7. Verification checklist

- [ ] Event ids are unique; timestamps ISO-8601.
- [ ] Reducer input is append-only except for deliberate admin tools (avoid rewriting history in place).
- [ ] Policy caps match product expectations for token budget vs model context.
- [ ] Correlation fields appear on bad-answer investigations (run id + tail event ids).

This repo does not ship SOPHIA server code; implement the above in **Allotment-Technology-Ltd/sophia** and bump `@restormel/state` per [CHANGELOG](https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/packages/state/CHANGELOG.md) when upgrading.
