// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/svelte";
import ConnectWizard from "./ConnectWizard.svelte";

/**
 * The M4 first-connection wizard (RES-113 PR-E). Contract:
 *  - MCP + REST are selectable; widget/SDK/GraphQL are locked "coming soon";
 *  - Type → Access → Name advances on Continue, read-only is the safe default;
 *  - the live preview fills in as steps complete.
 *
 * The `create`/`cancel` event paths are exercised end-to-end by
 * ConnectionsManager.test.ts (clicking Create mints a key via the CRUD), so this
 * file asserts wizard behaviour + preview without re-listening to component events
 * (Svelte 5 removed the `$on` instance API).
 */
describe("ConnectWizard", () => {
  it("offers MCP + REST as selectable and locks the coming-soon methods", () => {
    const { getByRole } = render(ConnectWizard, { props: { connectApiBase: "https://c.dev" } });
    expect((getByRole("button", { name: /MCP server/i }) as HTMLButtonElement).disabled).toBe(false);
    expect((getByRole("button", { name: /REST API/i }) as HTMLButtonElement).disabled).toBe(false);
    const widget = getByRole("button", { name: /Chat widget/i }) as HTMLButtonElement;
    expect(widget.disabled).toBe(true);
    expect(widget.textContent).toMatch(/coming soon/i);
    const graphql = getByRole("button", { name: /GraphQL/i }) as HTMLButtonElement;
    expect(graphql.disabled).toBe(true);
  });

  it("Continue is disabled until a type is chosen", async () => {
    const { getByRole } = render(ConnectWizard, { props: { connectApiBase: "https://c.dev" } });
    expect((getByRole("button", { name: /Continue/i }) as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.click(getByRole("button", { name: /MCP server/i }));
    expect((getByRole("button", { name: /Continue/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("walks Type → Access → Name with read-only preselected and a building preview", async () => {
    const { getByRole, getByText, container } = render(ConnectWizard, {
      props: { connectApiBase: "https://connect.restormel.dev" },
    });

    // Step 1 — Type. Preview shows MCP once chosen.
    await fireEvent.click(getByRole("button", { name: /MCP server/i }));
    await fireEvent.click(getByRole("button", { name: /Continue/i }));

    // Step 2 — Access; read-only is the safe default (pressed).
    expect(getByText(/What can this connection do/i)).toBeTruthy();
    const readBtn = getByRole("button", { name: /Looks up Read-only/i });
    expect(readBtn.getAttribute("aria-pressed")).toBe("true");
    await fireEvent.click(getByRole("button", { name: /Continue/i }));

    // Step 3 — Name; seeded with the MCP placeholder, Create available.
    const nameInput = container.querySelector("#m4-conn-name") as HTMLInputElement;
    expect(nameInput.value).toBe("agent");
    expect(getByRole("button", { name: /Create connection/i })).toBeTruthy();

    // Live preview reflects the chosen type + access + name + mock endpoint.
    await fireEvent.input(nameInput, { target: { value: "agent-readonly" } });
    expect(getByText("/connect/invoke#agent-readonly", { exact: false })).toBeTruthy();
  });

  it("back from a later step returns to the previous step (no cancel)", async () => {
    const { getByRole, getByText } = render(ConnectWizard, { props: { connectApiBase: "https://c.dev" } });
    await fireEvent.click(getByRole("button", { name: /REST API/i }));
    await fireEvent.click(getByRole("button", { name: /Continue/i }));
    expect(getByText(/What can this connection do/i)).toBeTruthy();
    // Back button is labelled with the previous step.
    await fireEvent.click(getByRole("button", { name: /← Type/i }));
    expect(getByText(/How does it connect/i)).toBeTruthy();
  });
});
