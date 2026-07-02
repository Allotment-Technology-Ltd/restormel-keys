// @vitest-environment jsdom
/**
 * RES-113 PR-3 — the deployment-preset control (placement spec §5 item 4; copy
 * pack §2.7). ux-contracts §3 states: success (switch applied + announced), error
 * (§6.2 switch-failure line), plus the destructive-confirm blast-radius rule
 * (ux-craft §3.5).
 *
 * Pins:
 *  - the "Where your pipeline runs" field renders all four copy-pack §2.7 options
 *    with their outcome lines, VERBATIM; the applied preset shows glyph + word +
 *    aria-pressed (R3-A3), never colour alone;
 *  - choosing a preset opens a role="alertdialog" stating {n} stages (singular +
 *    plural); Escape closes it and returns focus to the opener (X10);
 *  - confirm PUTs the pipeline-preset API and announces "Setup switched to
 *    {preset}." on the persistent polite region; a failure renders the §6.2 line,
 *    state preserved, announced on the persistent assertive region.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/svelte";
import { tick } from "svelte";
import ConnectPipelinePresetControl from "./ConnectPipelinePresetControl.svelte";

vi.mock("$app/navigation", () => ({ invalidateAll: vi.fn().mockResolvedValue(undefined) }));

function okResponse(body: Record<string, unknown>) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}
function failResponse(status = 500) {
  return { ok: false, status, json: async () => ({}) } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("preset control — field anatomy (§2.7)", () => {
  it("renders the label, helper, and all four options with outcome lines verbatim", () => {
    const { getByText } = render(ConnectPipelinePresetControl, {
      props: { graphTargetId: "g-1", bundle: {} },
    });
    expect(getByText("Where your pipeline runs")).toBeTruthy();
    expect(
      getByText("One choice swaps the whole vetted setup. You can still adjust individual stages below."),
    ).toBeTruthy();
    expect(getByText("Fully managed (recommended)")).toBeTruthy();
    expect(getByText("Highest accuracy")).toBeTruthy();
    expect(getByText("Regional residency")).toBeTruthy();
    expect(getByText("Self-host air-gapped")).toBeTruthy();
    expect(
      getByText("Your documents are processed only inside your chosen region."),
    ).toBeTruthy();
    expect(
      getByText(
        "Everything runs on your own infrastructure — nothing ever leaves it. You provide the computing power.",
      ),
    ).toBeTruthy();
  });

  it("marks the applied preset with glyph + word + aria-pressed (never colour alone)", () => {
    const { getByRole } = render(ConnectPipelinePresetControl, {
      props: { graphTargetId: "g-1", bundle: { pipeline_preset: "highest-accuracy" } },
    });
    const applied = getByRole("button", { name: /Highest accuracy/ });
    expect(applied.getAttribute("aria-pressed")).toBe("true");
    expect(applied.textContent).toContain("■ selected");
    const other = getByRole("button", { name: /Regional residency/ });
    expect(other.getAttribute("aria-pressed")).toBe("false");
    expect(other.textContent).toContain("□ select");
  });
});

describe("preset control — confirm + persistence", () => {
  it("opens an alertdialog with the plural {n}, PUTs the API, and announces", async () => {
    const fetchMock = vi.fn(async () =>
      okResponse({ ok: true, preset: "highest-accuracy", preset_name: "Highest accuracy", pipeline_slots: {} }),
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const { getByRole, container } = render(ConnectPipelinePresetControl, {
      props: { graphTargetId: "g-1", bundle: {} },
    });
    await fireEvent.click(getByRole("button", { name: /Highest accuracy/ }));
    await tick();
    const dialog = getByRole("alertdialog");
    // From a default bundle, highest-accuracy swaps all three stages (plural).
    expect(dialog.textContent).toContain(
      "Switch to Highest accuracy? This swaps 3 stages to that setup. Your graph and answers stay as they are — the new setup applies from your next build.",
    );
    await fireEvent.click(getByRole("button", { name: "Switch setup" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/keys/dashboard/api/connect/graph-library/g-1/pipeline-preset",
        expect.objectContaining({ method: "PUT", body: JSON.stringify({ preset: "highest-accuracy" }) }),
      );
    });
    await waitFor(() => {
      const status = container.querySelector('[role="status"]');
      expect(status?.textContent).toBe("Setup switched to Highest accuracy.");
    });
  });

  it("uses the singular confirm when a preset swaps exactly one stage", async () => {
    const { getByRole } = render(ConnectPipelinePresetControl, {
      props: { graphTargetId: "g-1", bundle: {} },
    });
    // regional-residency changes only extract from a default bundle ⇒ "1 stage".
    await fireEvent.click(getByRole("button", { name: /Regional residency/ }));
    await tick();
    expect(getByRole("alertdialog").textContent).toContain("This swaps 1 stage to that setup.");
  });

  it("Escape closes the confirm and returns focus to the opener (X10)", async () => {
    const { getByRole, queryByRole } = render(ConnectPipelinePresetControl, {
      props: { graphTargetId: "g-1", bundle: {} },
    });
    const opener = getByRole("button", { name: /Self-host air-gapped/ });
    await fireEvent.click(opener);
    await tick();
    const dialog = getByRole("alertdialog");
    await fireEvent.keyDown(dialog, { key: "Escape" });
    expect(queryByRole("alertdialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("a failed switch renders the §6.2 line and announces on the assertive region, state preserved", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => failResponse()) as unknown as typeof fetch);
    const { getByRole, container } = render(ConnectPipelinePresetControl, {
      props: { graphTargetId: "g-1", bundle: {} },
    });
    const SWITCH_ERROR = "We couldn't switch the setup — your pipeline is unchanged. Try again.";
    await fireEvent.click(getByRole("button", { name: /Highest accuracy/ }));
    await tick();
    await fireEvent.click(getByRole("button", { name: "Switch setup" }));
    await waitFor(() => {
      expect(container.querySelector(".preset-error")?.textContent).toContain(SWITCH_ERROR);
    });
    // Visible line is not itself a live region.
    expect(container.querySelector(".preset-error")?.getAttribute("role")).toBeNull();
    const alertRegion = container.querySelector('[role="alert"]');
    expect(alertRegion?.getAttribute("aria-live")).toBe("assertive");
    expect(alertRegion?.textContent).toBe(SWITCH_ERROR);
    // Nothing was applied: no option is pressed (state preserved).
    expect(getByRole("button", { name: /Highest accuracy/ }).getAttribute("aria-pressed")).toBe("false");
  });
});
