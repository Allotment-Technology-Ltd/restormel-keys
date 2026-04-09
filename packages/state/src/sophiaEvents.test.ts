import { describe, expect, it } from "vitest";
import { projectWorkingMemory } from "./reducer.js";
import {
  createStoaHistorySummarizationEvent,
  createStoaScopeClearEvent,
  createStoaTurnDigestEvents,
} from "./sophiaEvents.js";

const policy = { maxCellsPerScope: 10, maxApproxTokensPerScope: 8000 };

describe("sophia event helpers", () => {
  it("creates turn digest flow", () => {
    const events = createStoaTurnDigestEvents({
      id: "turn-1",
      ts: "2026-04-01T12:00:00.000Z",
      run_id: "r1",
      user_turn_digest_cell_id: "digest-1",
      user_turn_digest: "User asked about billing.",
    });
    const v = projectWorkingMemory(events, policy);
    expect(v.scopes.stoa_session?.[0]?.text).toContain("billing");
  });

  it("summarization removes prior cells", () => {
    const events = [
      ...createStoaTurnDigestEvents({
        id: "t1",
        ts: "2026-04-01T12:00:00.000Z",
        run_id: "r1",
        user_turn_digest_cell_id: "d1",
        user_turn_digest: "A",
      }),
      createStoaHistorySummarizationEvent({
        id: "sum-1",
        ts: "2026-04-01T12:01:00.000Z",
        run_id: "r1",
        remove_cell_ids: ["d1"],
        summary_cell_id: "s1",
        summary_text: "Summary A",
      }),
    ];
    const v = projectWorkingMemory(events, policy);
    expect(v.scopes.stoa_session).toHaveLength(1);
    expect(v.scopes.stoa_session[0].id).toBe("s1");
  });

  it("scope clear empties stoa_session", () => {
    const events = [
      ...createStoaTurnDigestEvents({
        id: "t1",
        ts: "2026-04-01T12:00:00.000Z",
        run_id: "r1",
        user_turn_digest_cell_id: "d1",
        user_turn_digest: "X",
      }),
      createStoaScopeClearEvent({
        id: "clr",
        ts: "2026-04-01T12:02:00.000Z",
        run_id: "r1",
      }),
    ];
    const v = projectWorkingMemory(events, policy);
    expect(v.scopes.stoa_session).toBeUndefined();
  });
});
