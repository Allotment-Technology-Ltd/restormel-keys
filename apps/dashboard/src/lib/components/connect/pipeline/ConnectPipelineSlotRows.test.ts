// @vitest-environment jsdom
/**
 * RES-113 PR-2 — the ONE plug-point slot-row renderer (placement spec §5 item 3;
 * copy pack §2.7). ux-contracts §3 states covered: success (rows), error (save
 * failure line), plus the §2.7 absent-with-reason posture.
 *
 * Pins:
 *  - three rows named ONLY by the §0 stage table (never extractor/embed/verifier);
 *  - §2.7 outcome lines VERBATIM, one per curated option; recommended first with
 *    the RECOMMENDED tag ("the recommended default" for AT);
 *  - selection = glyph + word + aria-pressed (R3-A3 — never colour/fill alone);
 *  - BLOCKED/AMBIGUOUS names NEVER render (REC-GOV-022; fragment-assembled so the
 *    licensing grep stays clean, mirroring pipeline-config.slots.test.ts);
 *  - a11y on the Change secondary: accessible name names the stage, aria-expanded,
 *    open moves focus to the current choice, Escape closes + returns focus;
 *  - saves PUT the pipeline-slots API; success re-derives rows + announces on the
 *    persistent status region; failure renders the §2.7 line, state preserved;
 *  - the §2.7 incompatibility reason line renders when the derivation excludes an
 *    option (via the rowsOverride seam — the shipped CLEARED menus are family-
 *    disjoint, so the real catalog cannot fire it today);
 *  - customisation summary only when bundle ≠ default (singular + plural).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/svelte";
import { tick } from "svelte";
import ConnectPipelineSlotRows from "./ConnectPipelineSlotRows.svelte";
import type { PipelineSlotRow } from "$lib/connect/pipeline-config";

const STAGE_NAMES = ["Reading your documents", "Making it searchable", "Checking against sources"];

/** REC-GOV-022 BLOCKED/AMBIGUOUS names, assembled from fragments (never literals). */
const FORBIDDEN_NAMES = [
  ["N", "V", "-", "Embed"],
  ["Patro", "nus"],
  ["Ly", "nx"],
  ["Bes", "poke"],
  ["Mini", "Check"],
  ["Ji", "na"],
  ["lyt", "ang"],
  ["Sur", "ya"],
].map((parts) => parts.join(""));

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

describe("slot rows — default bundle (§2.7 anatomy)", () => {
  it("renders exactly three rows named by the §0 stage table, with current choices", () => {
    const { getByText, queryByText, container } = render(ConnectPipelineSlotRows, {
      props: { graphTargetId: "g-1", bundle: {} },
    });
    expect(container.querySelectorAll(".slot-row")).toHaveLength(3);
    for (const name of STAGE_NAMES) expect(getByText(name)).toBeTruthy();
    // Recommended defaults are the current choices on a default bundle.
    expect(getByText("PaddleOCR-VL")).toBeTruthy();
    expect(getByText("BGE-M3")).toBeTruthy();
    expect(getByText("Granite Guardian")).toBeTruthy();
    // Default bundle: NO customisation summary (honest absence, §0).
    expect(queryByText(/changed from the recommended default/)).toBeNull();
    // Store is never a slot row.
    expect(queryByText(/store/i)).toBeNull();
  });

  it("Change secondaries carry the §2.7 accessible name and aria-expanded", () => {
    const { getByRole } = render(ConnectPipelineSlotRows, {
      props: { graphTargetId: "g-1", bundle: {} },
    });
    for (const name of STAGE_NAMES) {
      const btn = getByRole("button", { name: `Change the model for ${name}` });
      expect(btn.getAttribute("aria-expanded")).toBe("false");
    }
  });

  it("BLOCKED/AMBIGUOUS names never render, across every open menu", async () => {
    const { container, getAllByRole } = render(ConnectPipelineSlotRows, {
      props: { graphTargetId: "g-1", bundle: {} },
    });
    for (const change of getAllByRole("button", { name: /^Change the model for / })) {
      await fireEvent.click(change);
      const text = container.textContent ?? "";
      for (const forbidden of FORBIDDEN_NAMES) {
        expect(text.toLowerCase()).not.toContain(forbidden.toLowerCase());
      }
    }
  });
});

describe("slot rows — curated list (open/close, focus, selection marks)", () => {
  it("opening renders §2.7 outcome lines verbatim, recommended first, and moves focus to the current choice", async () => {
    const { getByRole, getByText, container } = render(ConnectPipelineSlotRows, {
      props: { graphTargetId: "g-1", bundle: {} },
    });
    const change = getByRole("button", { name: "Change the model for Reading your documents" });
    await fireEvent.click(change);
    await tick();
    expect(change.getAttribute("aria-expanded")).toBe("true");

    // §2.7 outcome lines, VERBATIM (one per curated option).
    expect(
      getByText(
        "The recommended reader. Handles most documents well and keeps the exact position of every fact, so citations can highlight the source passage.",
      ),
    ).toBeTruthy();
    expect(
      getByText(
        "The most accurate on difficult documents — scanned pages, dense tables, many languages. Runs as a hosted service, so your pages leave your infrastructure.",
      ),
    ).toBeTruthy();
    expect(
      getByText(
        "The fastest on plain, cleanly laid-out pages — a good fit for large volumes of simple documents. Less accurate on difficult ones.",
      ),
    ).toBeTruthy();

    const options = [...container.querySelectorAll<HTMLButtonElement>(".slot-option")];
    expect(options).toHaveLength(3);
    // Recommended default renders first, tagged for AT as "the recommended default".
    expect(options[0]?.textContent).toContain("RECOMMENDED");
    expect(options[0]?.textContent).toContain("the recommended default");
    // Selection is glyph + word + aria-pressed — never fill alone (R3-A3).
    expect(options[0]?.getAttribute("aria-pressed")).toBe("true");
    expect(options[0]?.textContent).toContain("■ selected");
    expect(options[1]?.getAttribute("aria-pressed")).toBe("false");
    expect(options[1]?.textContent).toContain("□ select");
    // Focus lands on the current choice, not the first tabbable chrome.
    expect(document.activeElement).toBe(options[0]);
  });

  it("Escape closes the list and returns focus to the Change opener (X10)", async () => {
    const { getByRole, container } = render(ConnectPipelineSlotRows, {
      props: { graphTargetId: "g-1", bundle: {} },
    });
    const change = getByRole("button", { name: "Change the model for Making it searchable" });
    await fireEvent.click(change);
    await tick();
    const selected = container.querySelector<HTMLButtonElement>('.slot-option[aria-pressed="true"]');
    expect(selected).not.toBeNull();
    await fireEvent.keyDown(selected as HTMLButtonElement, { key: "Escape" });
    expect(container.querySelector(".slot-options")).toBeNull();
    expect(change.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(change);
  });
});

describe("slot rows — persistence (§2.7 save states)", () => {
  it("choosing an option PUTs the pipeline-slots API, re-derives the row, and announces", async () => {
    const fetchMock = vi.fn(async () =>
      okResponse({ ok: true, pipeline_slots: { extract: "mistral-ocr-4" } }),
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const { getByRole, getByText, container } = render(ConnectPipelineSlotRows, {
      props: { graphTargetId: "g-1", bundle: {} },
    });
    await fireEvent.click(getByRole("button", { name: "Change the model for Reading your documents" }));
    await tick();
    const target = [...container.querySelectorAll<HTMLButtonElement>(".slot-option")].find((b) =>
      b.textContent?.includes("Mistral OCR 4"),
    );
    await fireEvent.click(target as HTMLButtonElement);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/keys/dashboard/api/connect/graph-library/g-1/pipeline-slots",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ slot: "extract", option_id: "mistral-ocr-4" }),
        }),
      );
    });
    // Row re-derived from the server-authoritative map: current choice updated…
    await waitFor(() => {
      const updated = container.querySelector<HTMLButtonElement>(
        '.slot-option[aria-pressed="true"]',
      );
      expect(updated?.textContent).toContain("Mistral OCR 4");
    });
    // …the §2.7 customisation summary appears (singular)…
    expect(getByText("1 stage changed from the recommended default.")).toBeTruthy();
    // …and the persistent polite region announces the registered confirmation.
    const status = container.querySelector('[role="status"]');
    expect(status?.textContent).toBe("Reading your documents now uses Mistral OCR 4.");
  });

  it("a failed save renders the §2.7 failure line and preserves the selection", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => failResponse()) as unknown as typeof fetch);
    const { getByRole, getByText, container } = render(ConnectPipelineSlotRows, {
      props: { graphTargetId: "g-1", bundle: {} },
    });
    await fireEvent.click(getByRole("button", { name: "Change the model for Checking against sources" }));
    await tick();
    const target = [...container.querySelectorAll<HTMLButtonElement>(".slot-option")].find((b) =>
      b.textContent?.includes("HHEM-2.1-Open"),
    );
    await fireEvent.click(target as HTMLButtonElement);
    await waitFor(() => {
      expect(
        getByText("We couldn't save that choice — your pipeline is unchanged. Try again."),
      ).toBeTruthy();
    });
    expect(getByText("We couldn't save that choice — your pipeline is unchanged. Try again.").getAttribute("role")).toBe("alert");
    // State preserved: the current choice is still the recommended default.
    const selected = container.querySelector<HTMLButtonElement>('.slot-option[aria-pressed="true"]');
    expect(selected?.textContent).toContain("Granite Guardian");
  });
});

describe("slot rows — customised bundle + reason line", () => {
  it("a two-slot customisation renders the plural §2.7 summary and marks rows non-default", () => {
    const { getByText } = render(ConnectPipelineSlotRows, {
      props: {
        graphTargetId: "g-1",
        bundle: { pipeline_slots: { extract: "mistral-ocr-4", embed: "qwen3-embedding-8b" } },
      },
    });
    expect(getByText("2 stages changed from the recommended default.")).toBeTruthy();
    expect(getByText("Mistral OCR 4")).toBeTruthy();
    expect(getByText("Qwen3-Embedding-8B")).toBeTruthy();
  });

  it("renders the single §2.7 reason line, verbatim, when a row excluded an option", async () => {
    // rowsOverride seam: the shipped CLEARED menus are family-disjoint, so the
    // real catalog cannot produce blockedReason today (see pipeline-config PR-1
    // note) — the seam covers the registered line's rendering.
    const rows: PipelineSlotRow[] = [
      {
        slot: "validate",
        stageName: "Checking against sources",
        currentName: "Granite Guardian",
        isDefault: true,
        options: [
          {
            id: "granite-guardian",
            name: "Granite Guardian",
            outcome:
              "The recommended check. Clear cases pass quickly, unclear ones get a stronger look, and anything still uncertain waits for your verdict.",
            isRecommended: true,
            isSelected: true,
          },
        ],
        blockedReason:
          "Some options aren't offered with your current choices. The stage that checks against sources always uses a different maker from the stage that reads your documents, so the check stays independent.",
      },
    ];
    const { getByRole, getByText, container } = render(ConnectPipelineSlotRows, {
      props: { graphTargetId: "g-1", bundle: {}, rowsOverride: rows },
    });
    await fireEvent.click(getByRole("button", { name: "Change the model for Checking against sources" }));
    await tick();
    expect(
      getByText(
        "Some options aren't offered with your current choices. The stage that checks against sources always uses a different maker from the stage that reads your documents, so the check stays independent.",
      ),
    ).toBeTruthy();
    expect(container.querySelectorAll(".slot-reason")).toHaveLength(1);
  });
});
