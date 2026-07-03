import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useKeys } from "./useKeys";
import { openaiProvider } from "@restormel/keys";

const stableConfig = { keys: [] as const, routing: { defaultProvider: "openai" as const } };
const stableOptions = { providers: [openaiProvider] };

describe("useKeys", () => {
  it("returns keys instance when config and options are valid", () => {
    const { result } = renderHook(() => useKeys(stableConfig, stableOptions));
    expect(result.current.keys).not.toBeNull();
    expect(result.current.keys?.getAllModelIds?.()).toBeDefined();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("returns loading false and error null on success", () => {
    const config = { keys: [] as const, routing: {} };
    const options = { providers: [] as const };
    const { result } = renderHook(() => useKeys(config, options));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
