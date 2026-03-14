import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/svelte";
import ModelSelector from "./ModelSelector.svelte";
import { createKeys } from "@restormel/keys";
import { openaiProvider, anthropicProvider } from "@restormel/keys";

const providers = [openaiProvider, anthropicProvider];

describe("ModelSelector", () => {
  it("renders with region and theme classes", () => {
    const config = { keys: [], routing: { defaultProvider: "openai" } };
    const keys = createKeys(config, { providers });
    render(ModelSelector, { props: { keys, providers } });

    const region = screen.getByRole("region", { name: /model selection/i });
    expect(region).toBeInTheDocument();
    expect(region).toHaveClass("rk-model-selector", "rk-dark");
  });

  it("shows provider names when resolved", async () => {
    const config = {
      keys: [{ provider: "openai", id: "k1" }],
      routing: { defaultProvider: "openai" },
    };
    const keys = createKeys(config, { providers });
    render(ModelSelector, { props: { keys, providers } });

    expect(await screen.findByText("OpenAI")).toBeInTheDocument();
    expect(screen.getByText("Anthropic")).toBeInTheDocument();
  });

  it("groups models under each provider", async () => {
    const config = {
      keys: [{ provider: "openai", id: "k1" }],
      routing: { defaultProvider: "openai" },
    };
    const keys = createKeys(config, { providers });
    render(ModelSelector, { props: { keys, providers } });

    expect(await screen.findByRole("button", { name: "gpt-4o (available)" })).toBeInTheDocument();
    expect(screen.getByText("OpenAI")).toBeInTheDocument();
  });

  it("respects theme custom property container", () => {
    const config = { keys: [], routing: {} };
    const keys = createKeys(config, { providers });
    render(ModelSelector, { props: { keys, providers } });
    const el = document.querySelector(".rk-model-selector");
    expect(el).toHaveClass("rk-dark");
  });
});
