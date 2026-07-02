// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/svelte";
import ConnectWizard from "./ConnectWizard.svelte";

/**
 * The M4 guided fork (RES-113 PR-7 — the collapsed wizard, REC-ADR-018 addendum
 * 2026-07-01; copy pack §4.2). Contract:
 *  - two method cards only (MCP first, REST second), user-goal titles;
 *  - NO step strip, NO access step, NO live-preview aside;
 *  - one prefilled non-blocking name field (prefill tracks the card until edited);
 *  - project chip ONLY when genuinely ambiguous (2+ projects, no default);
 *  - one primary CTA, disabled with a visible hint until a card is chosen.
 *
 * The `create` event path is exercised end-to-end by ConnectionsManager.test.ts
 * (Svelte 5 removed the `$on` instance API).
 */
describe("ConnectWizard (guided fork)", () => {
  it("renders exactly the two MVP goal cards, MCP first (copy pack §4.2)", () => {
    const { getAllByRole, getByRole, queryByRole } = render(ConnectWizard);
    expect(getByRole("heading", { name: "What do you want to connect?" })).toBeTruthy();
    const cards = getAllByRole("button", { pressed: false });
    // Two unpressed cards + the create button also matches role button — assert by name.
    expect(getByRole("button", { name: /Connect an agent/i })).toBeTruthy();
    expect(getByRole("button", { name: /Connect your own code/i })).toBeTruthy();
    expect(queryByRole("button", { name: /Chat widget/i })).toBeNull();
    expect(queryByRole("button", { name: /GraphQL/i })).toBeNull();
    expect(queryByRole("button", { name: /SDK/i })).toBeNull();
    expect(cards.length).toBeGreaterThanOrEqual(2);
  });

  it("has no step strip and no live-preview aside (wizard collapse)", () => {
    const { queryByText, queryByLabelText } = render(ConnectWizard);
    expect(queryByLabelText(/Connection steps/i)).toBeNull();
    expect(queryByText(/Your connection so far/i)).toBeNull();
    expect(queryByText(/What can this connection do/i)).toBeNull();
  });

  it("Create is disabled with a visible hint until a card is chosen; zero typing needed after", async () => {
    const { getByRole, getByText, queryByText } = render(ConnectWizard);
    const create = getByRole("button", { name: /Create connection/i }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    expect(getByText("Choose one to continue.")).toBeTruthy();

    await fireEvent.click(getByRole("button", { name: /Connect an agent/i }));
    expect(create.disabled).toBe(false);
    expect(queryByText("Choose one to continue.")).toBeNull();
    // Prefilled name — Create accepts the default with zero typing.
    const nameInput = getByRole("textbox", { name: /Connection name/i }) as HTMLInputElement;
    expect(nameInput.value).toBe("agent");
  });

  it("name prefill tracks the chosen card until the user edits it", async () => {
    const { getByRole } = render(ConnectWizard);
    const nameInput = getByRole("textbox", { name: /Connection name/i }) as HTMLInputElement;

    await fireEvent.click(getByRole("button", { name: /Connect an agent/i }));
    expect(nameInput.value).toBe("agent");
    await fireEvent.click(getByRole("button", { name: /Connect your own code/i }));
    expect(nameInput.value).toBe("backend");

    // Once edited, switching cards no longer clobbers the user's name.
    await fireEvent.input(nameInput, { target: { value: "my-thing" } });
    await fireEvent.click(getByRole("button", { name: /Connect an agent/i }));
    expect(nameInput.value).toBe("my-thing");
  });

  it("selection is exposed via aria-pressed (glyph + state, never fill alone)", async () => {
    const { getByRole, getByText, getAllByText } = render(ConnectWizard);
    const agent = getByRole("button", { name: /Connect an agent/i });
    expect(agent.getAttribute("aria-pressed")).toBe("false");
    // BOTH mark states pair glyph + word — a lone □ reads as debris (5-lens fix).
    expect(getAllByText("□ select").length).toBe(2);
    await fireEvent.click(agent);
    expect(agent.getAttribute("aria-pressed")).toBe("true");
    expect(getByText("■ selected")).toBeTruthy();
    expect(getAllByText("□ select").length).toBe(1);
  });

  it("states the enforced read-only line for the first connection (copy pack §4.2)", () => {
    const { getByText } = render(ConnectWizard, { props: { variant: "first", access: "read" } });
    expect(
      getByText(
        "Your first connection is read-only — it can look things up but can't add, change, or delete anything in your graph.",
      ),
    ).toBeTruthy();
  });

  it("uses the add-variant access lines for S2 adds (copy pack §4.5)", async () => {
    const read = render(ConnectWizard, { props: { variant: "add", access: "read" } });
    expect(read.getByText(/New connections start read-only/i)).toBeTruthy();
    read.unmount();

    const rw = render(ConnectWizard, { props: { variant: "add", access: "read_write" } });
    expect(rw.getByText(/This connection is read \+ write/i)).toBeTruthy();
  });

  it("project chip renders ONLY when genuinely ambiguous, and Change reveals the select", async () => {
    const projects = [
      { id: "a", name: "Alpha" },
      { id: "b", name: "Beta" },
    ];

    // Unambiguous (default exists) — silent resolution, no chip.
    const silent = render(ConnectWizard, {
      props: { projects, projectId: "b", projectAmbiguous: false },
    });
    expect(silent.queryByText("PROJECT")).toBeNull();
    silent.unmount();

    // Ambiguous — compact chip with the resolved project + Change.
    const { getByText, getByRole, queryByRole } = render(ConnectWizard, {
      props: { projects, projectId: "a", projectAmbiguous: true },
    });
    expect(getByText("PROJECT")).toBeTruthy();
    expect(getByText("Alpha")).toBeTruthy();
    expect(queryByRole("combobox")).toBeNull();
    await fireEvent.click(getByRole("button", { name: "Change" }));
    const select = getByRole("combobox", { name: /Project for this connection/i });
    expect(select).toBeTruthy();
    // Focus relocated to the select (the Change button was destroyed).
    expect(document.activeElement).toBe(select);
  });

  it("surfaces the parent's create error as an alert", () => {
    const { getByRole } = render(ConnectWizard, {
      props: { createError: "We couldn't create the connection — something failed on our side. Try again in a moment." },
    });
    expect(getByRole("alert").textContent).toMatch(/couldn't create the connection/i);
  });

  it("the alert region persists empty at boot — never created on demand inside {#if}", () => {
    const { getByRole } = render(ConnectWizard);
    // A live region born with its content does not announce (a11y skill anti-pattern);
    // the region must exist before any error text is injected.
    expect(getByRole("alert").textContent?.trim()).toBe("");
  });
});
