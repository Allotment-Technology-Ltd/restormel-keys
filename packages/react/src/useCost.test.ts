import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCost } from "./useCost";
import { createKeys } from "@restormel/keys";
import { openaiProvider } from "@restormel/keys";

describe("useCost", () => {
  it("returns cost for model when keys has providers", () => {
    const keys = createKeys(
      { keys: [], routing: {} },
      { providers: [openaiProvider] }
    );
    const { result } = renderHook(() => useCost(keys, "gpt-4o"));
    expect(result.current.cost).not.toBeNull();
    expect(result.current.cost?.modelId).toBe("gpt-4o");
  });

  it("returns null when keys is null", () => {
    const { result } = renderHook(() => useCost(null, "gpt-4o"));
    expect(result.current.cost).toBeNull();
  });

  it("returns null when modelId is null", () => {
    const keys = createKeys(
      { keys: [], routing: {} },
      { providers: [openaiProvider] }
    );
    const { result } = renderHook(() => useCost(keys, null));
    expect(result.current.cost).toBeNull();
  });
});
