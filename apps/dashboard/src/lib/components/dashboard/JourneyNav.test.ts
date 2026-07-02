// @vitest-environment jsdom
/**
 * RES-113 PR-4 — the STRIPPED journey nav shell (JourneyNav.svelte).
 *
 * Pins the founder's stripped-nav decision (REC-ADR-022 Consequences) and the
 * dimmed-item accessibility contract documented in the component:
 *   • reachable items are real links; the active one carries aria-current="page"
 *     (alias-aware per the shipped redirect map);
 *   • a dimmed item is a focusable disclosure BUTTON — never `aria-disabled`
 *     (the element is operable: it discloses why the section is locked) — with
 *     its locked state readable via aria-describedby BEFORE activation;
 *   • activating it reveals the copy pack §5.3 explanation and moves focus into
 *     it; Escape closes it and returns focus to the opener (X10);
 *   • no dots, badges, counts, or inline lock text in the chrome.
 *
 * getByRole-first per the accessibility skill's testing convention.
 */
import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/svelte";
import { tick } from "svelte";
import JourneyNav from "./JourneyNav.svelte";
import {
  HOME_HREF,
  BUILD_HREF,
  VERIFY_HREF,
  CONNECT_HUB_HREF,
  INGEST_FLOW_HREF,
  resolveJourneyNav,
  type JourneyNavSignals,
} from "$lib/nav-config";
import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";

const ON = { ...MVP_MODULE_DEFAULTS, onboardingJourney: true, connect: true };

/** Real resolver output — the shell renders exactly what the server derives. */
function itemsFor(over: Partial<JourneyNavSignals> = {}) {
  return resolveJourneyNav(
    {
      completedRunCount: 0,
      units: 0,
      connectionCount: 0,
      flaggedClaimCount: 0,
      everHadVerifyActivity: false,
      projectCount: 1,
      ...over,
    },
    ON,
  ).items;
}

describe("JourneyNav — stripped journey nav (flag-ON shell)", () => {
  it("S1: Home + Build are links; Connect is a dimmed disclosure button; no Verify", () => {
    const { getByRole, queryByRole } = render(JourneyNav, {
      items: itemsFor(),
      currentPath: HOME_HREF,
    });
    expect(getByRole("link", { name: "Home" }).getAttribute("href")).toBe(HOME_HREF);
    expect(getByRole("link", { name: "Build" }).getAttribute("href")).toBe(BUILD_HREF);
    const connect = getByRole("button", { name: "Connect" });
    expect(connect.getAttribute("aria-expanded")).toBe("false");
    // NOT aria-disabled: the element is operable (it discloses the lock reason).
    expect(connect.getAttribute("aria-disabled")).toBeNull();
    expect(queryByRole("link", { name: "Connect" })).toBeNull();
    expect(queryByRole("link", { name: "Verify" })).toBeNull();
  });

  it("marks the active item with aria-current, alias-aware (ingest flow lights Build)", () => {
    const { getByRole } = render(JourneyNav, {
      items: itemsFor(),
      currentPath: INGEST_FLOW_HREF,
    });
    expect(getByRole("link", { name: "Build" }).getAttribute("aria-current")).toBe("page");
    expect(getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBeNull();
  });

  it("STRIPPED chrome: no badges, no counts, no visible inline lock reason", () => {
    const { container, getByRole } = render(JourneyNav, {
      items: itemsFor(),
      currentPath: HOME_HREF,
    });
    expect(container.querySelector(".nav-badge")).toBeNull();
    // The dimmed item's visible text is JUST the label…
    expect(getByRole("button", { name: "Connect" }).textContent?.trim()).toBe("Connect");
    // …the reason exists only as the visually-hidden description (clip pattern)
    // until clicked — no explanation panel is mounted.
    expect(container.querySelector(".journey-lock-note")).toBeNull();
    const hint = container.querySelector("[id^='journey-lock-hint-']");
    expect(hint?.className).toContain("sr-only");
  });

  it("announces the locked state via aria-describedby BEFORE activation", () => {
    const { getByRole } = render(JourneyNav, {
      items: itemsFor(),
      currentPath: HOME_HREF,
    });
    const connect = getByRole("button", { name: "Connect" });
    const hintId = connect.getAttribute("aria-describedby");
    expect(hintId).toBeTruthy();
    const hint = document.getElementById(hintId!);
    expect(hint?.textContent).toContain("Locked.");
    expect(hint?.textContent).toContain("Connect unlocks once you've added documents.");
  });

  it("click reveals the §5.3 explanation, wires aria-controls, and moves focus into it", async () => {
    const { getByRole } = render(JourneyNav, {
      items: itemsFor(),
      currentPath: HOME_HREF,
    });
    const connect = getByRole("button", { name: "Connect" });
    await fireEvent.click(connect);
    await tick();
    const note = getByRole("note");
    expect(connect.getAttribute("aria-expanded")).toBe("true");
    expect(connect.getAttribute("aria-controls")).toBe(note.id);
    // Copy pack §5.3 template instance, verbatim: one sentence + one spine link.
    expect(note.textContent).toContain("Connect unlocks once you've added documents.");
    const action = getByRole("link", { name: "Add your documents" });
    expect(action.getAttribute("href")).toBe(BUILD_HREF);
    // Focus relocation on the {#if} swap: focus lands on the revealed note.
    expect(document.activeElement).toBe(note);
  });

  it("Escape closes the explanation and returns focus to the dimmed item (X10)", async () => {
    const { getByRole, queryByRole } = render(JourneyNav, {
      items: itemsFor(),
      currentPath: HOME_HREF,
    });
    const connect = getByRole("button", { name: "Connect" });
    connect.focus();
    await fireEvent.click(connect);
    await tick();
    expect(queryByRole("note")).not.toBeNull();
    await fireEvent.keyDown(window, { key: "Escape" });
    await tick();
    expect(queryByRole("note")).toBeNull();
    expect(connect.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(connect);
  });

  it("clicking the dimmed item again closes the explanation", async () => {
    const { getByRole, queryByRole } = render(JourneyNav, {
      items: itemsFor(),
      currentPath: HOME_HREF,
    });
    const connect = getByRole("button", { name: "Connect" });
    await fireEvent.click(connect);
    await tick();
    await fireEvent.click(connect);
    await tick();
    expect(queryByRole("note")).toBeNull();
    expect(connect.getAttribute("aria-expanded")).toBe("false");
  });

  it("S3/S4: Verify enters as a plain link (no badge, no count) and Connect unlocks", () => {
    const items = itemsFor({ units: 100, flaggedClaimCount: 3, connectionCount: 1 });
    const { getByRole, queryByRole, container } = render(JourneyNav, {
      items,
      currentPath: HOME_HREF,
    });
    expect(getByRole("link", { name: "Verify" }).getAttribute("href")).toBe(VERIFY_HREF);
    expect(getByRole("link", { name: "Connect" }).getAttribute("href")).toBe(CONNECT_HUB_HREF);
    expect(queryByRole("button", { name: "Connect" })).toBeNull();
    // No numerals anywhere in the chrome — the flagged count never surfaces here.
    expect(container.textContent).not.toMatch(/\d/);
  });
});
