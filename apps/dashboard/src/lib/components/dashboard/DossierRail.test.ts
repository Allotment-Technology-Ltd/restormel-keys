// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/svelte";
import { tick } from "svelte";
import Harness from "./DossierRailHarness.svelte";

describe("DossierRail keyboard contract", () => {
  it("is a labelled modal dialog when open", async () => {
    const { getByTestId, getByRole } = render(Harness);
    await fireEvent.click(getByTestId("opener"));
    const dialog = getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
  });

  it("moves focus into the rail (close button) on open", async () => {
    const { getByTestId, getByRole } = render(Harness);
    await fireEvent.click(getByTestId("opener"));
    await tick();
    expect((document.activeElement as HTMLElement | null)?.getAttribute("aria-label")).toBe("Close panel");
    // sanity: the dialog exists
    expect(getByRole("dialog")).toBeTruthy();
  });

  it("closes on Escape and returns focus to the opener", async () => {
    const { getByTestId, queryByRole } = render(Harness);
    const opener = getByTestId("opener") as HTMLButtonElement;
    // Keyboard users focus the opener before activating it — that's the element
    // focus should return to on close.
    opener.focus();
    await fireEvent.click(opener);
    await tick();
    await fireEvent.keyDown(document, { key: "Escape" });
    await tick();
    expect(queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("traps Tab from the last focusable back to the first", async () => {
    const { getByTestId, getByRole } = render(Harness);
    await fireEvent.click(getByTestId("opener"));
    await tick();
    const inner = getByTestId("inner") as HTMLElement;
    inner.focus();
    expect(document.activeElement).toBe(inner);
    // Tab off the last focusable wraps to the first (the close button).
    await fireEvent.keyDown(document, { key: "Tab" });
    expect((document.activeElement as HTMLElement).getAttribute("aria-label")).toBe("Close panel");
    expect(getByRole("dialog")).toBeTruthy();
  });
});
