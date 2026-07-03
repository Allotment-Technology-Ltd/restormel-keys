import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/svelte";
import ModelSelector from "./ModelSelector.svelte";
import { createKeys } from "@restormel/keys";
import { openaiProvider, anthropicProvider } from "@restormel/keys";
import { expectElementHasClasses } from "./testing/assert-dom";

const providers = [openaiProvider, anthropicProvider];

describe("ModelSelector", () => {
  it("renders with region and theme classes", () => {
    const config = { keys: [], routing: { defaultProvider: "openai" } };
    const keys = createKeys(config, { providers });
    render(ModelSelector, { props: { keys, providers } });

    const region = screen.getByRole("region", { name: /model selection/i });
    expect(region).toBeTruthy();
    expectElementHasClasses(region, "rk-model-selector", "rk-dark");
  });

  it("shows provider names when resolved", async () => {
    const config = {
      keys: [{ provider: "openai", id: "k1" }],
      routing: { defaultProvider: "openai" },
    };
    const keys = createKeys(config, { providers });
    render(ModelSelector, { props: { keys, providers } });

    expect(await screen.findByText("OpenAI")).toBeTruthy();
    expect(screen.getByText("Anthropic")).toBeTruthy();
  });

  it("groups models under each provider", async () => {
    const config = {
      keys: [{ provider: "openai", id: "k1" }],
      routing: { defaultProvider: "openai" },
    };
    const keys = createKeys(config, { providers });
    render(ModelSelector, { props: { keys, providers } });

    expect(await screen.findByRole("button", { name: "gpt-4o (available)" })).toBeTruthy();
    expect(screen.getByText("OpenAI")).toBeTruthy();
  });

  it("respects theme custom property container", () => {
    const config = { keys: [], routing: {} };
    const keys = createKeys(config, { providers });
    render(ModelSelector, { props: { keys, providers } });
    const el = document.querySelector(".rk-model-selector");
    expectElementHasClasses(el, "rk-dark");
  });

  it("still resolves when policy entry is soft-blocked", async () => {
    const config = {
      keys: [{ provider: "openai", id: "k1" }],
      routing: { defaultProvider: "openai" },
    };
    const keys = createKeys(config, { providers });
    render(ModelSelector, {
      props: {
        keys,
        providers,
        policyAvailability: {
          "openai:gpt-4o": {
            available: false,
            reason: "Restormel temporarily unavailable",
            enforcement: "soft",
          },
        },
      },
    });

    expect(await screen.findByRole("button", { name: "gpt-4o (available)" })).toBeTruthy();
  });

  it("keeps hard policy-blocked models unavailable", async () => {
    const config = {
      keys: [{ provider: "openai", id: "k1" }],
      routing: { defaultProvider: "openai" },
    };
    const keys = createKeys(config, { providers });
    render(ModelSelector, {
      props: {
        keys,
        providers,
        policyAvailability: {
          "openai:gpt-4o": {
            available: false,
            reason: "Policy: blocked by test",
            enforcement: "hard",
          },
        },
      },
    });

    const blocked = await screen.findByRole("button", {
      name: /gpt-4o \(Policy: blocked by test\)/i,
    });
    expect(blocked).toBeInstanceOf(HTMLButtonElement);
    expect((blocked as HTMLButtonElement).disabled).toBe(true);
  });
});
