import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { KeyManager } from "./KeyManager";

// Avoid importing keys-elements so we don't trigger Svelte mount in jsdom.
// Define a minimal custom element so the wrapper renders something.
beforeAll(() => {
  if (typeof customElements !== "undefined" && !customElements.get("rk-key-manager")) {
    class RkKeyManager extends HTMLElement {
      static get observedAttributes() {
        return ["user-id"];
      }
    }
    customElements.define("rk-key-manager", RkKeyManager);
  }
});

describe("KeyManager", () => {
  it("renders the custom element with user-id attribute", () => {
    const keys = null;
    render(<KeyManager keys={keys} userId="u-1" />);
    const el = document.querySelector("rk-key-manager");
    expect(el).not.toBeNull();
    expect(el?.getAttribute("user-id")).toBe("u-1");
  });

  it("calls onKeyRemoved when rk-key-removed is dispatched", async () => {
    const onKeyRemoved = vi.fn();
    render(<KeyManager keys={null} userId="u-1" onKeyRemoved={onKeyRemoved} />);
    const el = document.querySelector("rk-key-manager");
    el?.dispatchEvent(
      new CustomEvent("rk-key-removed", { bubbles: true, detail: { keyId: "k1" } })
    );
    expect(onKeyRemoved).toHaveBeenCalledWith("k1");
  });

  it("calls onKeyAdded when rk-key-added is dispatched", () => {
    const onKeyAdded = vi.fn();
    render(<KeyManager keys={null} userId="u-1" onKeyAdded={onKeyAdded} />);
    const el = document.querySelector("rk-key-manager");
    el?.dispatchEvent(
      new CustomEvent("rk-key-added", {
        bubbles: true,
        detail: { key: { provider: "openai", id: "k1" }, apiKey: "sk-x" },
      })
    );
    expect(onKeyAdded).toHaveBeenCalledWith({ provider: "openai", id: "k1" }, "sk-x");
  });
});
