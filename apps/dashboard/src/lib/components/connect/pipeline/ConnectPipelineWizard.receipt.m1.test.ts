// @vitest-environment jsdom
/**
 * RES-113 PR-4 — the launch-panel configuration receipt (copy pack §2.7).
 *
 * The receipt is ONE muted line on the journey launch panel, rendered ONLY when
 * `bundle ≠ default`. That predicate is `data.pipelineCustomised`, computed
 * server-side and gated on the `m1PlugPoints` flag (false when the flag is OFF or
 * the bundle is the recommended default) — so the component test drives the
 * predicate directly:
 *
 *   • default bundle (pipelineCustomised false)  → renders nothing
 *   • customised bundle (pipelineCustomised true) → renders the ONE line once,
 *     copy-pack VERBATIM, with the inline "Review choices" affordance onto the
 *     shipped sources-page "Advanced — full pipeline control" disclosure
 *   • no per-row teasers are introduced (decision: none)
 *   • flag-OFF / default is byte-identical (the launch header is unchanged bar the
 *     absent receipt)
 *
 * getByRole-first per the accessibility skill; the launch body panel is out of
 * scope (runDefaults is null → the header under test renders; the body is a
 * loading stub).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/svelte";
import { readable } from "svelte/store";
import { tick } from "svelte";
import type {
  PipelineWizardProgress,
  PipelineWizardStepId,
} from "$lib/connect/pipeline-config";

// ── $app mocks ────────────────────────────────────────────────────────────
const gotoSpy = vi.fn((..._args: unknown[]) => Promise.resolve());
vi.mock("$app/navigation", () => ({
  goto: (...args: unknown[]) => gotoSpy(...args),
  invalidate: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("$app/environment", () => ({ browser: true }));

let pageUrl = new URL("https://app.local/keys/dashboard/sources/ingest?step=launch");
vi.mock("$app/stores", () => ({
  get page() {
    return readable({
      url: pageUrl,
      data: { moduleFlags: { onboardingJourney: true, connectHostManagedGraphStore: false } },
    });
  },
}));

// Panel internals are out of scope — stub them so the shell renders without the
// panels' own fetch lifecycles.
vi.mock("$lib/components/connect/pipeline/ConnectProviderKeyPanel.svelte", () =>
  import("$lib/components/brutalist/BrutalLoadingState.svelte"),
);
vi.mock("$lib/components/connect/pipeline/ConnectSourcesPanel.svelte", () =>
  import("$lib/components/brutalist/BrutalLoadingState.svelte"),
);

import ConnectPipelineWizard from "./ConnectPipelineWizard.svelte";

function progress(over: Partial<PipelineWizardProgress> = {}): PipelineWizardProgress {
  return {
    hasGraphStore: true,
    graphStoreLabel: "Host-managed Postgres graph store",
    hasProviderKey: true,
    hasCustomPack: false,
    packTitle: "General knowledge",
    selectedDomainPackId: "pack-1",
    connectionCount: 0,
    parsedDocumentCount: 5,
    selectedDocumentCount: 3,
    hasGraph: true,
    agentReady: false,
    modelsReady: true,
    ...over,
  };
}

function wizardData(
  step: PipelineWizardStepId,
  p: PipelineWizardProgress,
  extra: { pipelineCustomised?: boolean } = {},
) {
  return {
    step,
    wizard: p,
    runDefaults: null,
    workspaceId: "ws-1",
    phase: "initial" as const,
    ...extra,
  };
}

const RECEIPT_TEXT = "Runs your customised pipeline.";
const RECEIPT_LINK = "Review choices";

beforeEach(() => {
  gotoSpy.mockClear();
  pageUrl = new URL("https://app.local/keys/dashboard/sources/ingest?step=launch");
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  Element.prototype.scrollIntoView = vi.fn();
});

describe("ConnectPipelineWizard — launch-panel receipt (PR-4)", () => {
  it("customised bundle renders the ONE receipt line once, copy-pack verbatim", async () => {
    const { container, getByRole } = render(ConnectPipelineWizard, {
      props: { data: wizardData("launch", progress(), { pipelineCustomised: true }) },
    });
    await tick();

    // The launch panel itself rendered (its outcome line proves we're on launch).
    expect(getByRole("heading", { name: "Rebuild your graph" })).toBeTruthy();

    const receipts = container.querySelectorAll(".journey-receipt");
    expect(receipts.length).toBe(1); // exactly once — no per-row teasers
    const receipt = receipts[0] as HTMLElement;
    // Copy pack §2.7 VERBATIM: "Runs your customised pipeline. [Review choices]".
    expect(receipt.textContent?.replace(/\s+/g, " ").trim()).toBe(
      `${RECEIPT_TEXT} ${RECEIPT_LINK}`,
    );

    // "[Review choices]" is an inline text link (no arrow, no button styling —
    // §2.5) onto the shipped sources-page Advanced disclosure — not a new surface.
    const link = getByRole("link", { name: RECEIPT_LINK });
    expect(link.getAttribute("href")).toContain("/sources#advanced-heading");
    expect(link.textContent).not.toContain("→");
    expect(link.classList.contains("btn")).toBe(false);
  });

  it("default bundle renders nothing (predicate false ⇒ no receipt, no per-row teasers)", async () => {
    const { container, queryByText, queryByRole } = render(ConnectPipelineWizard, {
      props: { data: wizardData("launch", progress(), { pipelineCustomised: false }) },
    });
    await tick();

    expect(container.querySelectorAll(".journey-receipt").length).toBe(0);
    expect(queryByText(RECEIPT_TEXT)).toBeNull();
    expect(queryByRole("link", { name: RECEIPT_LINK })).toBeNull();
  });

  it("flag-OFF (pipelineCustomised absent) is byte-identical: launch header unchanged, no receipt", async () => {
    // Server sends no `pipelineCustomised` when the flag is OFF — the launch
    // header renders exactly as before this PR, receipt absent.
    const { container, getByRole } = render(ConnectPipelineWizard, {
      props: { data: wizardData("launch", progress()) },
    });
    await tick();

    // The pre-existing launch header lines still render, unchanged.
    expect(getByRole("heading", { name: "Rebuild your graph" })).toBeTruthy();
    expect(container.querySelector(".journey-expectation")?.textContent).toBe(
      "Usually takes 1–3 minutes.",
    );
    // …and nothing new is added.
    expect(container.querySelectorAll(".journey-receipt").length).toBe(0);
  });
});
