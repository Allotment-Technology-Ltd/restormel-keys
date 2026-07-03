import { describe, expect, it } from "vitest";
import { openrouterProvider, portkeyProvider } from "@restormel/keys";

describe("provider adapters available", () => {
  it("exports OpenRouter provider", () => {
    expect(openrouterProvider.id).toBe("openrouter");
    expect(typeof openrouterProvider.validateKey).toBe("function");
  });

  it("exports Portkey provider", () => {
    expect(portkeyProvider.id).toBe("portkey");
    expect(typeof portkeyProvider.validateKey).toBe("function");
  });
});

