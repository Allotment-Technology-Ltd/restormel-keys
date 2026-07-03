import type { ArtifactRef } from "@restormel/testing-core";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { resolveLocator } from "./locator.js";
import type {
  BrowserConsoleLine,
  BrowserNetworkLine,
  BrowserSessionTraceEntry,
  PlaywrightTestingSessionOptions,
  TestingBrowserSession,
  TestingLocator,
} from "./types.js";

const MAX_CONSOLE = 200;
const MAX_NETWORK = 120;
const MAX_TEXT_SNIPPET = 2000;

function nowIso(): string {
  return new Date().toISOString();
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

export class PlaywrightTestingSession implements TestingBrowserSession {
  readonly page: Page;

  private readonly browser: Browser;
  private readonly context: BrowserContext;
  private readonly defaultTimeoutMs: number;

  private readonly consoleLines: BrowserConsoleLine[] = [];
  private readonly networkLines: BrowserNetworkLine[] = [];
  private readonly traceBuffer: BrowserSessionTraceEntry[] = [];

  private disposed = false;

  private constructor(browser: Browser, context: BrowserContext, page: Page, defaultTimeoutMs: number) {
    this.browser = browser;
    this.context = context;
    this.page = page;
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  static async create(options: PlaywrightTestingSessionOptions = {}): Promise<PlaywrightTestingSession> {
    const defaultTimeoutMs = options.timeoutMs ?? 30_000;
    const browser = await chromium.launch({
      headless: options.headless ?? true,
    });
    const context = await browser.newContext({
      viewport: options.viewport ?? { width: 1280, height: 720 },
      ...(options.storageState !== undefined && options.storageState.length > 0
        ? { storageState: options.storageState }
        : {}),
    });
    const page = await context.newPage();
    page.setDefaultTimeout(defaultTimeoutMs);
    page.setDefaultNavigationTimeout(defaultTimeoutMs);

    const session = new PlaywrightTestingSession(browser, context, page, defaultTimeoutMs);

    page.on("console", (msg) => {
      if (session.consoleLines.length >= MAX_CONSOLE) {
        session.consoleLines.shift();
      }
      session.consoleLines.push({
        type: msg.type(),
        text: truncate(msg.text(), MAX_TEXT_SNIPPET),
      });
    });

    page.on("requestfinished", async (req) => {
      if (session.networkLines.length >= MAX_NETWORK) {
        session.networkLines.shift();
      }
      let status = 0;
      try {
        const res = await req.response();
        status = res?.status() ?? 0;
      } catch {
        status = 0;
      }
      session.networkLines.push({
        url: truncate(req.url(), 500),
        method: req.method(),
        status,
      });
    });

    return session;
  }

  private pushTrace(kind: BrowserSessionTraceEntry["kind"], summary: string, metadata?: Record<string, unknown>): void {
    this.traceBuffer.push({
      timestamp: nowIso(),
      kind,
      summary,
      metadata,
    });
  }

  async navigate(
    url: string,
    options?: { timeoutMs?: number; waitUntil?: "load" | "domcontentloaded" | "networkidle" },
  ): Promise<void> {
    this.assertAlive();
    const waitUntil = options?.waitUntil ?? "load";
    await this.page.goto(url, {
      timeout: options?.timeoutMs ?? this.defaultTimeoutMs,
      waitUntil,
    });
    this.pushTrace("navigation", `navigate ${truncate(url, 300)}`, { waitUntil });
  }

  async click(locator: TestingLocator, options?: { timeoutMs?: number }): Promise<void> {
    this.assertAlive();
    const loc = resolveLocator(this.page, locator);
    const desc = locatorSummary(locator);
    await loc.click({ timeout: options?.timeoutMs ?? this.defaultTimeoutMs });
    this.pushTrace("action", `click ${desc}`);
  }

  async fill(locator: TestingLocator, value: string, options?: { timeoutMs?: number }): Promise<void> {
    this.assertAlive();
    const loc = resolveLocator(this.page, locator);
    const desc = locatorSummary(locator);
    await loc.fill(value, { timeout: options?.timeoutMs ?? this.defaultTimeoutMs });
    this.pushTrace("action", `fill ${desc}`, { valueLength: value.length });
  }

  async waitForLoad(state: "load" | "domcontentloaded" | "networkidle" = "load"): Promise<void> {
    this.assertAlive();
    await this.page.waitForLoadState(state);
    this.pushTrace("action", `waitForLoadState ${state}`);
  }

  async waitForVisible(locator: TestingLocator, options?: { timeoutMs?: number }): Promise<void> {
    this.assertAlive();
    const loc = resolveLocator(this.page, locator);
    await loc.waitFor({ state: "visible", timeout: options?.timeoutMs ?? this.defaultTimeoutMs });
    this.pushTrace("action", `wait visible ${locatorSummary(locator)}`);
  }

  async getVisibleText(locator: TestingLocator): Promise<string> {
    this.assertAlive();
    const loc = resolveLocator(this.page, locator);
    const text = await loc.innerText();
    this.pushTrace("observation", `text ${locatorSummary(locator)}`, { length: text.length });
    return text;
  }

  async screenshot(path: string): Promise<ArtifactRef> {
    this.assertAlive();
    await this.page.screenshot({ path, type: "png", fullPage: false });
    this.pushTrace("observation", `screenshot ${path}`, { path });
    return { kind: "screenshot", path, mimeType: "image/png" };
  }

  getConsoleSnapshot(): readonly BrowserConsoleLine[] {
    return [...this.consoleLines];
  }

  getNetworkSnapshot(): readonly BrowserNetworkLine[] {
    return [...this.networkLines];
  }

  drainTraceEntries(): BrowserSessionTraceEntry[] {
    const out = [...this.traceBuffer];
    this.traceBuffer.length = 0;
    return out;
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    try {
      await this.context.close();
    } catch {
      /* ignore */
    }
    try {
      await this.browser.close();
    } catch {
      /* ignore */
    }
  }

  private assertAlive(): void {
    if (this.disposed) {
      throw new Error("PlaywrightTestingSession is disposed");
    }
  }
}

function locatorSummary(loc: TestingLocator): string {
  if (loc.kind === "css") {
    return `css:${truncate(loc.selector, 120)}`;
  }
  const name = loc.name === undefined ? "" : typeof loc.name === "string" ? ` "${truncate(loc.name, 80)}"` : " /RegExp/";
  return `role:${loc.role}${name}`;
}

/**
 * Launch Chromium and return a narrow testing session (one page).
 */
export async function createPlaywrightTestingSession(
  options?: PlaywrightTestingSessionOptions,
): Promise<TestingBrowserSession> {
  return PlaywrightTestingSession.create(options);
}
