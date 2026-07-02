// @vitest-environment jsdom
/**
 * RES-113 PR-5 (5-lens review fixes) — the journey Build wizard shell, flag-ON.
 *
 * Pins the behaviours the review corrected:
 *   • lens 2 §1/§2: an explicit `?step=sources` visit that ARRIVES with a
 *     non-empty selection renders the document-manage aside (the selection
 *     editor's only mount) and is NEVER force-corrected to launch — while the
 *     sources ASK (arrived empty) still auto-advances to launch once one
 *     source exists (copy pack §2.2).
 *   • lens 4 §3: a state-derived panel swap relocates focus to the new panel
 *     heading (a11y skill: never destroy the focused element in an {#if} swap
 *     without relocating focus).
 *   • lens 5 §1: the flag-ON template banner's secondary carries no arrow —
 *     the → glyph belongs to the state's one yellow primary alone (pack §0).
 *
 * getByRole-first per the accessibility skill; panel internals are mocked to a
 * presentational stub (they are out of PR-5 scope — the wizard shell is under
 * test, not the panels).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/svelte";
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

let pageUrl = new URL("https://app.local/keys/dashboard/sources/ingest");
vi.mock("$app/stores", () => ({
  get page() {
    return readable({
      url: pageUrl,
      data: { moduleFlags: { onboardingJourney: true, connectHostManagedGraphStore: false } },
    });
  },
}));

// Panel internals are out of scope — stub them with a trivial presentational
// component so the shell renders without the panels' own fetch lifecycles.
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

function wizardData(step: PipelineWizardStepId, p: PipelineWizardProgress) {
  return {
    step,
    wizard: p,
    runDefaults: null,
    workspaceId: "ws-1",
    phase: "initial" as const,
  };
}

beforeEach(() => {
  gotoSpy.mockClear();
  sessionStorage.clear();
  // jsdom ships neither matchMedia nor scrollIntoView; goToStep's
  // post-navigation scroll consults both.
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  Element.prototype.scrollIntoView = vi.fn();
});

describe("ConnectPipelineWizard — journey Build (flag ON)", () => {
  it("explicit ?step=sources with a selection renders the manage aside — never corrected to launch", async () => {
    // Lens 2 §1/§2: the spine says launch (key + 3 documents), but the user
    // explicitly navigated to sources (deep link / "Run again with more
    // documents") — the selection editor must render, with a way back.
    pageUrl = new URL("https://app.local/keys/dashboard/sources/ingest?step=sources");
    const { getByRole, queryByText } = render(ConnectPipelineWizard, {
      props: { data: wizardData("sources", progress()) },
    });
    await tick();
    // §2.2 header, verbatim; no step eyebrow (the visitor is past step 2).
    expect(getByRole("heading", { name: "Add your documents" })).toBeTruthy();
    expect(queryByText("STEP 2 OF 4")).toBeNull();
    // The escape hatch back to the spine.
    expect(getByRole("link", { name: "← Back to Build" })).toBeTruthy();
    // No URL correction fired — the explicit visit wins.
    expect(gotoSpy).not.toHaveBeenCalled();
  });

  it("the sources ASK (arrived empty) still auto-advances to launch once one source exists", async () => {
    pageUrl = new URL("https://app.local/keys/dashboard/sources/ingest?step=sources");
    const empty = progress({ selectedDocumentCount: 0, parsedDocumentCount: 0, hasGraph: false });
    const { getByText, rerender } = render(ConnectPipelineWizard, {
      props: { data: wizardData("sources", empty) },
    });
    await tick();
    // Arrived with nothing selected → this is the ask, eyebrow and all.
    expect(getByText("STEP 2 OF 4")).toBeTruthy();
    expect(gotoSpy).not.toHaveBeenCalled();
    // One source appears (copy pack §2.2: advances automatically — no Continue).
    await rerender({
      data: wizardData("sources", progress({ selectedDocumentCount: 1, parsedDocumentCount: 1 })),
    });
    await waitFor(() => expect(gotoSpy).toHaveBeenCalled());
    const [href, opts] = gotoSpy.mock.calls[0];
    expect(String(href)).toContain("step=launch");
    expect(opts).toMatchObject({ replaceState: true, keepFocus: true });
  });

  it("a state-derived panel swap relocates focus to the new panel heading", async () => {
    // Lens 4 §3 / a11y skill: the provider ask's controls unmount when the key
    // arrives — focus must land on the next panel's heading, not <body>.
    pageUrl = new URL("https://app.local/keys/dashboard/sources/ingest?step=provider");
    const empty = progress({
      hasProviderKey: false,
      selectedDocumentCount: 0,
      parsedDocumentCount: 0,
      hasGraph: false,
    });
    const { getByRole, rerender } = render(ConnectPipelineWizard, {
      props: { data: wizardData("provider", empty) },
    });
    await tick();
    expect(getByRole("heading", { name: "Add an AI provider key" })).toBeTruthy();
    // Key saved → the derived panel advances provider → sources.
    await rerender({
      data: wizardData("provider", progress({ selectedDocumentCount: 0, parsedDocumentCount: 0, hasGraph: false })),
    });
    await waitFor(() => {
      const heading = getByRole("heading", { name: "Add your documents" });
      expect(document.activeElement).toBe(heading);
    });
  });

  it("flag-ON template banner secondary carries no arrow (pack §0: → is the primary's alone)", async () => {
    // Lens 5 §1. The banner needs a pending template + a graph store.
    pageUrl = new URL(
      "https://app.local/keys/dashboard/sources/ingest?step=provider&template=engineering-knowledge",
    );
    const { getByRole } = render(ConnectPipelineWizard, {
      props: {
        data: wizardData(
          "provider",
          progress({ hasProviderKey: false, selectedDocumentCount: 0, hasGraph: false }),
        ),
      },
    });
    await tick();
    const banner = getByRole("button", { name: "Go to Domain step" });
    expect(banner.textContent).not.toContain("→");
  });
});
