import { afterEach, describe, expect, it } from "vitest";
import { createRunsStoreFromEnv } from "./create-store.js";

describe("createRunsStoreFromEnv", () => {
  afterEach(() => {
    delete process.env.RESTORMEL_RUNS_DATABASE_URL;
    delete process.env.DATABASE_URL;
  });

  it("uses in-memory when no database URL", async () => {
    const s = await createRunsStoreFromEnv();
    expect(s.kind).toBe("memory");
  });
});
