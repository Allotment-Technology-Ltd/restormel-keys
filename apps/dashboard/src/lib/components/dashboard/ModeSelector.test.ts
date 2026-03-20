// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/svelte";
import { get } from "svelte/store";
import ModeSelector from "./ModeSelector.svelte";
import { USER_MODE_STORAGE_KEY, clearUserMode, userMode } from "$lib/stores/user-mode";

describe("ModeSelector", () => {
  beforeEach(() => {
    localStorage.clear();
    clearUserMode();
  });

  it("updates userMode store when a tile is clicked", async () => {
    const { getByRole } = render(ModeSelector);

    await fireEvent.click(getByRole("button", { name: /Starting a new project/i }));

    expect(get(userMode)).toBe("new_project");
    expect(localStorage.getItem(USER_MODE_STORAGE_KEY)).toBe("new_project");
  });
});
