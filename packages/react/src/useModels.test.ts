import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useModels } from "./useModels";
import { createKeys } from "@restormel/keys";
import { openaiProvider } from "@restormel/keys";

describe("useModels", () => {
  it("returns modelIds from keys", () => {
    const keys = createKeys(
      { keys: [], routing: {} },
      { providers: [openaiProvider] }
    );
    const { result } = renderHook(() => useModels(keys));
    expect(result.current.modelIds.length).toBeGreaterThan(0);
    expect(result.current.groups).toBeDefined();
  });

  it("returns empty when keys is null", () => {
    const { result } = renderHook(() => useModels(null));
    expect(result.current.modelIds).toEqual([]);
    expect(result.current.groups).toEqual([]);
  });
});
