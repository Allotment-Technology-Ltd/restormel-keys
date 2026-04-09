import { describe, expect, it } from "vitest";
import { InMemoryRunsStore } from "./runs-store.js";

describe("InMemoryRunsStore", () => {
  it("lists with pagination", async () => {
    const s = new InMemoryRunsStore();
    await s.createQueued("a", "/w");
    await s.createQueued("b", "/w");
    await s.createQueued("c", "/w");
    const p1 = await s.list({ limit: 2, offset: 0 });
    expect(p1.items.length).toBe(2);
    expect(p1.next_offset).toBe(2);
    const p2 = await s.list({ limit: 2, offset: 2 });
    expect(p2.items.length).toBe(1);
    expect(p2.next_offset).toBeNull();
  });
});
