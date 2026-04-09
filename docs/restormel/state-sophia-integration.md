# SOPHIA — wiring `@restormel/state` (Stoa + escalation)

SOPHIA’s **Stoa** dialogue stack (`src/routes/api/stoa/dialogue/+server.ts`), **prompt history** (`src/lib/server/stoa/prompt.ts`), and **escalation / summarization** (`src/lib/server/stoa/escalation.ts`) already mutate conversation state in production. This document describes how to **emit Restormel State events** alongside that logic without extracting Firebase or document stores into this monorepo.

**Prerequisites:** `@restormel/state` and `@restormel/context-packs` from npm (tag **`platform-v*`** train) or workspace tarballs.

## 1. Choose storage for the event log

Keep your existing conversation / thread documents. Add either:

- A sub-collection or array field `state_events` (append-only, max length enforced in app code), or
- A parallel collection keyed by `thread_id` with ordered writes.

Events are plain JSON matching `StateEvent` from `@restormel/state` (`memory_cell_upsert`, `memory_summarize_compact`, etc.).

## 2. Turn boundary (dialogue `+server.ts`)

After you persist the user message (or a redacted digest), append events from **`createStoaTurnDigestEvents`**:

```ts
import { createStoaTurnDigestEvents } from "@restormel/state";

// id: uuid per write; ts: ISO now; run_id: same id you pass to observability traces
const events = createStoaTurnDigestEvents({
  id: crypto.randomUUID(),
  ts: new Date().toISOString(),
  run_id: runId,
  user_turn_digest_cell_id: `turn-${turnIndex}`,
  user_turn_digest: redactedUserSummaryText,
});
await appendStateEvents(threadId, events);
```

**Security:** Never store raw API keys or full provider payloads in `user_turn_digest`; follow `docs/security-baseline.md` patterns.

## 3. Escalation / history summarization (`escalation.ts`)

When you collapse transcript chunks into a summary, emit **`createStoaHistorySummarizationEvent`** with the cell ids you removed from working memory and the new summary cell id:

```ts
import { createStoaHistorySummarizationEvent } from "@restormel/state";

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

This repo does not ship SOPHIA server code; implement the above in **Allotment-Technology-Ltd/sophia** and bump dependencies after the next **`platform-v*`** publish that includes `@restormel/state`.
