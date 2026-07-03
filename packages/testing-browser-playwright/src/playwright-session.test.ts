import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { createPlaywrightTestingSession } from "./playwright-session.js";
import { browserTracesToCoreEvents } from "./trace-bridge.js";

const here = dirname(fileURLToPath(import.meta.url));
const basicWebFixture = join(here, "../../../examples/testing-basic-web/index.html");

describe("PlaywrightTestingSession", () => {
  it(
    "navigates to basic-web fixture, reads heading, screenshot + trace + console snapshot",
    async () => {
      const session = await createPlaywrightTestingSession({ headless: true });
      const dir = await mkdtemp(join(tmpdir(), "rt-browser-"));
      try {
        await session.navigate(pathToFileURL(basicWebFixture).href);
        await session.waitForLoad("domcontentloaded");
        const titleText = await session.getVisibleText({ kind: "role", role: "heading" });
        expect(titleText).toContain("basic-web");

        const png = join(dir, "page.png");
        const ref = await session.screenshot(png);
        expect(ref).toEqual({ kind: "screenshot", path: png, mimeType: "image/png" });

        const traces = session.drainTraceEntries();
        expect(traces.some((t) => t.kind === "navigation")).toBe(true);
        expect(traces.some((t) => t.kind === "observation")).toBe(true);
        expect(session.getConsoleSnapshot()).toEqual([]);
        expect(Array.isArray(session.getNetworkSnapshot())).toBe(true);
      } finally {
        await session.dispose();
        await rm(dir, { recursive: true, force: true });
      }
    },
    60_000,
  );

  it(
    "click and fill against a temp page",
    async () => {
      const session = await createPlaywrightTestingSession({ headless: true });
      const dir = await mkdtemp(join(tmpdir(), "rt-browser-"));
      try {
        const html = `<!doctype html><html><body>
          <label>Name <input type="text" aria-label="User name" id="n" /></label>
          <button type="button">Submit</button>
          <p id="out"></p>
          <script>
            document.querySelector('button').onclick = function() {
              document.getElementById('out').textContent = document.getElementById('n').value;
            };
          </script>
        </body></html>`;
        const file = join(dir, "page.html");
        await writeFile(file, html, "utf8");
        await session.navigate(pathToFileURL(file).href);
        await session.fill({ kind: "role", role: "textbox", name: "User name" }, "Ada");
        await session.click({ kind: "role", role: "button", name: "Submit" });
        const out = await session.getVisibleText({ kind: "css", selector: "#out" });
        expect(out.trim()).toBe("Ada");
        await session.waitForVisible({ kind: "css", selector: "#out" });
      } finally {
        await session.dispose();
        await rm(dir, { recursive: true, force: true });
      }
    },
    60_000,
  );

  it("browserTracesToCoreEvents maps adapter lines to core TraceEvent", () => {
    const core = browserTracesToCoreEvents(
      [
        { timestamp: "2026-01-01T00:00:00.000Z", kind: "navigation", summary: "goto /" },
        { timestamp: "2026-01-01T00:00:01.000Z", kind: "action", summary: "click" },
      ],
      { runId: "run_1", goalId: "g1", startingStepIndex: 10 },
    );
    expect(core).toHaveLength(2);
    expect(core[0]?.stepIndex).toBe(10);
    expect(core[1]?.stepIndex).toBe(11);
    expect(core[0]?.runId).toBe("run_1");
    expect(core[0]?.goalId).toBe("g1");
    expect(typeof core[0]?.id).toBe("string");
  });

  it("dispose is idempotent", async () => {
    const session = await createPlaywrightTestingSession({ headless: true });
    await session.dispose();
    await session.dispose();
  });
});
