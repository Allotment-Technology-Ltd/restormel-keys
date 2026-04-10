/**
 * Restormel Keys — Paddle Bootstrap (catalog only)
 *
 * Creates (or reuses) Paddle products and prices: Keys Pro, Keys Team, Platform bundle.
 * Does not create webhooks (configure in Paddle Dashboard → Developer tools → Notifications).
 *
 * Per Paddle docs: 240 requests/min per IP; on 429 you must wait 60s (Retry-After header).
 * Paddle recommends creating products/prices via the Dashboard; this script is for automation.
 *
 * Usage:
 *   pnpm run bootstrap-paddle -- --force-create
 *   pnpm run bootstrap-paddle -- --dry-run
 *   pnpm run bootstrap-paddle -- --write-env=apps/dashboard/.env.paddle.generated
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

type PaddleMode = "sandbox" | "production";
type CurrencyCode = "GBP" | "USD";
type BillingInterval = "month" | "year";

interface PaddleErrorResponse {
  error?: { code?: string; detail?: string; message?: string };
}

interface PaddleListMeta {
  pagination?: { per_page?: number; next?: string | null; has_more?: boolean };
}

interface PaddleListResponse<T> extends PaddleErrorResponse {
  data?: T[];
  meta?: PaddleListMeta;
}

/** Product with embedded prices when using ?include=prices */
interface PaddleProductWithPrices extends PaddleProduct {
  prices?: PaddlePrice[];
}

interface PaddleDataResponse<T> extends PaddleErrorResponse {
  data?: T;
}

interface PaddleProduct {
  id: string;
  name?: string;
  status?: string;
  tax_category?: string;
  custom_data?: Record<string, unknown>;
}

interface PaddlePrice {
  id: string;
  product_id?: string;
  status?: string;
  name?: string;
  billing_cycle?: { interval?: string; frequency?: number } | null;
  unit_price?: { amount?: string; currency_code?: string };
  custom_data?: Record<string, unknown>;
}

interface ScriptOptions {
  dryRun: boolean;
  forceCreate: boolean;
  writeEnvPath: string | null;
  showHelp: boolean;
}

interface PriceDefinition {
  key: string;
  envVar: string;
  amountMinor: number;
  currency: CurrencyCode;
  recurring: boolean;
  interval: BillingInterval;
  frequency: number;
  displayName: string;
  description: string;
}

interface ProductDefinition {
  key: string;
  name: string;
  description: string;
  prices: PriceDefinition[];
}

interface PriceResolution {
  definition: PriceDefinition;
  id: string;
  created: boolean;
}

const REQUEST_TIMEOUT_MS = 30_000; // Prevent fetch from hanging indefinitely
const RATE_LIMIT_COOLDOWN_MS = 60_000; // Paddle: 60s when 429
const DELAY_BETWEEN_REQUESTS_MS = 1_500; // Space requests to stay under 240/min

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function readMinorUnits(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw?.trim()) return fallback;
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer in minor units.`);
  }
  return parsed;
}

const PRODUCT_DEFINITIONS: ProductDefinition[] = [
  {
    key: "keys_pro",
    name: "Restormel Keys Pro",
    description: "Restormel Keys Pro subscription — cloud API and dashboard.",
    prices: [
      { key: "keys_pro_monthly_gbp", envVar: "PADDLE_PRICE_KEYS_PRO_MONTHLY_GBP", amountMinor: readMinorUnits("PADDLE_SETUP_KEYS_PRO_MONTHLY_GBP", 1000), currency: "GBP", recurring: true, interval: "month", frequency: 1, displayName: "Pro Monthly (GBP)", description: "Restormel Keys Pro monthly subscription in GBP." },
      { key: "keys_pro_monthly_usd", envVar: "PADDLE_PRICE_KEYS_PRO_MONTHLY_USD", amountMinor: readMinorUnits("PADDLE_SETUP_KEYS_PRO_MONTHLY_USD", 2400), currency: "USD", recurring: true, interval: "month", frequency: 1, displayName: "Pro Monthly (USD)", description: "Restormel Keys Pro monthly subscription in USD." },
      { key: "keys_pro_annual_gbp", envVar: "PADDLE_PRICE_KEYS_PRO_ANNUAL_GBP", amountMinor: readMinorUnits("PADDLE_SETUP_KEYS_PRO_ANNUAL_GBP", 19200), currency: "GBP", recurring: true, interval: "year", frequency: 1, displayName: "Pro Annual (GBP)", description: "Restormel Keys Pro annual subscription in GBP." },
      { key: "keys_pro_annual_usd", envVar: "PADDLE_PRICE_KEYS_PRO_ANNUAL_USD", amountMinor: readMinorUnits("PADDLE_SETUP_KEYS_PRO_ANNUAL_USD", 24000), currency: "USD", recurring: true, interval: "year", frequency: 1, displayName: "Pro Annual (USD)", description: "Restormel Keys Pro annual subscription in USD." },
    ],
  },
  {
    key: "keys_team",
    name: "Restormel Keys Team",
    description: "Restormel Keys Team — higher limits and collaboration (catalog; checkout when entitlements ship).",
    prices: [
      { key: "keys_team_monthly_gbp", envVar: "PADDLE_PRICE_KEYS_TEAM_MONTHLY_GBP", amountMinor: readMinorUnits("PADDLE_SETUP_KEYS_TEAM_MONTHLY_GBP", 3500), currency: "GBP", recurring: true, interval: "month", frequency: 1, displayName: "Team Monthly (GBP)", description: "Restormel Keys Team monthly subscription in GBP." },
      { key: "keys_team_monthly_usd", envVar: "PADDLE_PRICE_KEYS_TEAM_MONTHLY_USD", amountMinor: readMinorUnits("PADDLE_SETUP_KEYS_TEAM_MONTHLY_USD", 8400), currency: "USD", recurring: true, interval: "month", frequency: 1, displayName: "Team Monthly (USD)", description: "Restormel Keys Team monthly subscription in USD." },
    ],
  },
  {
    key: "platform_suite",
    name: "Restormel Platform",
    description: "Restormel Platform — Keys Pro + Testing Pro + Graph Pro bundle (catalog; checkout when bundle entitlements ship).",
    prices: [
      { key: "platform_monthly_gbp", envVar: "PADDLE_PRICE_PLATFORM_MONTHLY_GBP", amountMinor: readMinorUnits("PADDLE_SETUP_PLATFORM_MONTHLY_GBP", 3500), currency: "GBP", recurring: true, interval: "month", frequency: 1, displayName: "Platform Monthly (GBP)", description: "Restormel Platform monthly bundle in GBP." },
      { key: "platform_monthly_usd", envVar: "PADDLE_PRICE_PLATFORM_MONTHLY_USD", amountMinor: readMinorUnits("PADDLE_SETUP_PLATFORM_MONTHLY_USD", 8400), currency: "USD", recurring: true, interval: "month", frequency: 1, displayName: "Platform Monthly (USD)", description: "Restormel Platform monthly bundle in USD." },
    ],
  },
];

function parseOptions(args: string[]): ScriptOptions {
  let dryRun = false, forceCreate = false, writeEnvPath: string | null = null, showHelp = false;
  for (const arg of args) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--help" || arg === "-h") showHelp = true;
    else if (arg === "--force-create") forceCreate = true;
    else if (arg.startsWith("--write-env=")) writeEnvPath = arg.slice("--write-env=".length).trim() || null;
  }
  return { dryRun, forceCreate, writeEnvPath, showHelp };
}

function printHelp(): void {
  console.log(`
Restormel Keys Paddle bootstrap (catalog only)

Usage:
  pnpm run bootstrap-paddle -- --force-create   # recommended (skips discovery, avoids hangs)
  pnpm run bootstrap-paddle -- --dry-run
  pnpm run bootstrap-paddle -- --force-create --write-env=apps/dashboard/.env.paddle.generated

Required env: PADDLE_API_KEY

Optional: PADDLE_ENVIRONMENT=sandbox|production, PADDLE_SETUP_* (minor units for Pro/Team/Platform),
PADDLE_SKIP_DISCOVERY=true, PADDLE_DEFAULT_TAX_CATEGORY=standard

Paddle rate limits: 240 req/min per IP; 60s cooldown on 429.
`);
}

function paddleMode(): PaddleMode {
  const env = (process.env.PADDLE_ENVIRONMENT ?? process.env.PADDLE_ENV ?? "").trim().toLowerCase();
  return env === "production" ? "production" : "sandbox";
}

function paddleBaseUrl(mode: PaddleMode): string {
  return mode === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
}

function requiredEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} is required.`);
  return v;
}

function optionalEnv(name: string): string | null {
  return process.env[name]?.trim() || null;
}

function toMinorAmountString(value: number): string {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid minor amount: ${value}`);
  return String(Math.floor(value));
}

function customDataValue(record: Record<string, unknown> | undefined, key: string): string | null {
  const v = record?.[key];
  return typeof v === "string" ? v : null;
}

function priceCurrency(price: PaddlePrice): CurrencyCode | null {
  const c = price.unit_price?.currency_code;
  return c === "GBP" || c === "USD" ? c : null;
}

function priceAmountMinor(price: PaddlePrice): number | null {
  const raw = price.unit_price?.amount;
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

/** Fetch and read body with full timeout (connection + body read). */
async function fetchWithTimeout(
  url: string,
  opts: RequestInit & { timeoutMs?: number }
): Promise<{ status: number; headers: Headers; text: string }> {
  const { timeoutMs = REQUEST_TIMEOUT_MS, ...init } = opts;

  const doFetch = async () => {
    const res = await fetch(url, init);
    const text = await res.text();
    return { status: res.status, headers: res.headers, text };
  };

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs / 1000}s`)), timeoutMs);
  });

  return Promise.race([doFetch(), timeoutPromise]);
}

class PaddleClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly apiVersion: string;
  private readonly dryRun: boolean;
  private readonly maxRetries: number;
  private lastRequestTime = 0;

  constructor(opts: { baseUrl: string; apiKey: string; apiVersion: string; dryRun: boolean; maxRetries: number }) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.apiKey = opts.apiKey;
    this.apiVersion = opts.apiVersion;
    this.dryRun = opts.dryRun;
    this.maxRetries = Math.max(0, opts.maxRetries);
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "Paddle-Version": this.apiVersion,
    };
  }

  private async throttle(): Promise<void> {
    const delay = DELAY_BETWEEN_REQUESTS_MS;
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < delay) await sleep(delay - elapsed);
    this.lastRequestTime = Date.now();
  }

  private async request<T>(
    method: "GET" | "POST",
    pathOrUrl: string,
    body?: Record<string, unknown>,
    label?: string
  ): Promise<T> {
    const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${this.baseUrl}${pathOrUrl}`;
    let attempt = 0;

    while (true) {
      attempt += 1;
      await this.throttle();
      if (label) console.log(`[PADDLE] ${label}...`);

      let result: { status: number; headers: Headers; text: string };
      try {
        result = await fetchWithTimeout(url, {
          method,
          headers: this.headers(),
          body: body ? JSON.stringify(body) : undefined,
          timeoutMs: REQUEST_TIMEOUT_MS,
        });
      } catch (err) {
        throw err instanceof Error ? err : new Error(String(err));
      }

      const payload = (result.text ? JSON.parse(result.text) : {}) as T & PaddleErrorResponse;

      if (result.status === 429) {
        const retryAfter = result.headers.get("Retry-After");
        const waitMs = retryAfter
          ? Math.max(RATE_LIMIT_COOLDOWN_MS, Number.parseInt(retryAfter, 10) * 1000)
          : RATE_LIMIT_COOLDOWN_MS;
        if (attempt > this.maxRetries) {
          throw new Error(`[Paddle] Rate-limited after ${this.maxRetries + 1} retries. Wait ${Math.ceil(waitMs / 1000)}s and try again.`);
        }
        console.warn(`[PADDLE] Rate limit (429); waiting ${Math.ceil(waitMs / 1000)}s per Paddle docs (attempt ${attempt}/${this.maxRetries + 1})`);
        await sleep(waitMs);
        continue;
      }

      if (!result.status.toString().startsWith("2")) {
        const detail = payload?.error?.detail ?? payload?.error?.message ?? `HTTP ${result.status}`;
        throw new Error(`[Paddle ${method} ${pathOrUrl}] ${detail}`);
      }

      if (label) console.log(`[PADDLE] ${label} — done`);
      return payload as T;
    }
  }

  async listAll<T>(path: string, label?: string): Promise<T[]> {
    const out: T[] = [];
    let next: string | null = `${this.baseUrl}${path}`;
    let first = true;
    while (next) {
      const page = await this.request<PaddleListResponse<T>>("GET", next, undefined, first ? label : undefined);
      out.push(...(page.data ?? []));
      const n = page.meta?.pagination?.next ?? null;
      next = n ? (n.startsWith("http") ? n : `${this.baseUrl}${n}`) : null;
      first = false;
    }
    return out;
  }

  /** List products with embedded prices in a single request (avoids separate /prices call that can hang). */
  async listProductsWithPrices(label = "List products (with prices)"): Promise<{
    products: PaddleProduct[];
    prices: PaddlePrice[];
  }> {
    const products: PaddleProduct[] = [];
    const prices: PaddlePrice[] = [];
    let next: string | null = `${this.baseUrl}/products?per_page=100&include=prices`;
    let first = true;
    while (next) {
      const page = await this.request<PaddleListResponse<PaddleProductWithPrices>>(
        "GET",
        next,
        undefined,
        first ? label : undefined
      );
      const items = page.data ?? [];
      for (const p of items) {
        const { prices: embedded, ...product } = p;
        products.push(product);
        if (Array.isArray(embedded)) prices.push(...embedded);
      }
      const n = page.meta?.pagination?.next ?? null;
      next = n ? (n.startsWith("http") ? n : `${this.baseUrl}${n}`) : null;
      first = false;
    }
    return { products, prices };
  }

  async create<T>(path: string, body: Record<string, unknown>, label?: string): Promise<T | null> {
    if (this.dryRun) return null;
    const res = await this.request<PaddleDataResponse<T>>("POST", path, body, label);
    return res.data ?? null;
  }
}

async function ensureProduct(
  client: PaddleClient,
  existing: PaddleProduct[],
  def: ProductDefinition,
  taxCategory: string
): Promise<{ product: PaddleProduct; created: boolean }> {
  const match = existing.find(
    (p) => customDataValue(p.custom_data, "keys_product_key") === def.key || p.name === def.name
  );
  if (match) return { product: match, created: false };

  const payload = {
    name: def.name,
    description: def.description,
    tax_category: taxCategory,
    custom_data: { integration: "restormel-keys", keys_product_key: def.key },
  };
  const created = await client.create<PaddleProduct>("/products", payload, `Create product: ${def.name}`);
  if (!created)
    return { product: { id: `dryrun:${def.key}`, name: def.name, custom_data: payload.custom_data }, created: true };
  return { product: created, created: true };
}

async function ensurePrice(
  client: PaddleClient,
  existing: PaddlePrice[],
  productId: string,
  def: PriceDefinition
): Promise<PriceResolution> {
  const match = existing.find((p) => customDataValue(p.custom_data, "keys_price_key") === def.key);
  if (match) {
    const cur = priceCurrency(match);
    const amt = priceAmountMinor(match);
    if (cur && cur !== def.currency && !match.id.startsWith("dryrun:"))
      console.warn(`[WARN] ${def.key} currency mismatch: existing=${cur} desired=${def.currency}`);
    if (amt != null && amt !== def.amountMinor && !match.id.startsWith("dryrun:"))
      console.warn(`[WARN] ${def.key} amount mismatch: existing=${amt} desired=${def.amountMinor}`);
    return { definition: def, id: match.id, created: false };
  }

  const payload: Record<string, unknown> = {
    product_id: productId,
    name: def.displayName,
    description: def.description,
    unit_price: { amount: toMinorAmountString(def.amountMinor), currency_code: def.currency },
    custom_data: { integration: "restormel-keys", keys_price_key: def.key },
  };
  if (def.recurring) payload.billing_cycle = { interval: def.interval, frequency: def.frequency };

  const created = await client.create<PaddlePrice>("/prices", payload, `Create price: ${def.displayName}`);
  return { definition: def, id: created?.id ?? `dryrun:${def.key}`, created: true };
}

function buildEnvOutput(mode: PaddleMode, prices: PriceResolution[]): string {
  const lines = [
    "# Generated by scripts/bootstrap-paddle.ts (Restormel Keys)",
    `# ${new Date().toISOString()}`,
    `PADDLE_ENVIRONMENT=${mode}`,
    "",
    "# Paddle price IDs",
  ];
  for (const p of prices) lines.push(`${p.definition.envVar}=${p.id}`);
  lines.push("");
  return lines.join("\n");
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  if (options.showHelp) {
    printHelp();
    return;
  }

  const apiKey = requiredEnv("PADDLE_API_KEY");
  const mode = paddleMode();
  const skipDiscovery =
    options.forceCreate || (process.env.PADDLE_SKIP_DISCOVERY ?? "").trim().toLowerCase() === "true";
  const taxCategory = optionalEnv("PADDLE_DEFAULT_TAX_CATEGORY") ?? "standard";

  const client = new PaddleClient({
    apiKey,
    baseUrl: paddleBaseUrl(mode),
    apiVersion: String(Number.parseInt(process.env.PADDLE_API_VERSION ?? "1", 10) || 1),
    dryRun: options.dryRun,
    maxRetries: Number.parseInt(process.env.PADDLE_API_RETRY_MAX ?? "5", 10) || 5,
  });

  console.log(`[PADDLE] Mode=${mode} dryRun=${options.dryRun} (${paddleBaseUrl(mode)})`);
  console.log(`[PADDLE] Request timeout: ${REQUEST_TIMEOUT_MS / 1000}s | Delay between requests: ${DELAY_BETWEEN_REQUESTS_MS}ms`);

  let existingProducts: PaddleProduct[] = [];
  let existingPrices: PaddlePrice[] = [];

  if (!skipDiscovery) {
    const { products, prices } = await client.listProductsWithPrices("List products (with prices)");
    existingProducts = products;
    existingPrices = prices;
    console.log(`[PADDLE] Found ${existingProducts.length} products, ${existingPrices.length} prices`);
  } else {
    console.log("[PADDLE] Discovery skipped (--force-create or PADDLE_SKIP_DISCOVERY)");
  }

  const priceResults: PriceResolution[] = [];

  for (const productDef of PRODUCT_DEFINITIONS) {
    const { product, created } = await ensureProduct(client, existingProducts, productDef, taxCategory);
    if (created) existingProducts.push(product);

    for (const priceDef of productDef.prices) {
      const pr = await ensurePrice(client, existingPrices, product.id, priceDef);
      priceResults.push(pr);
      if (pr.created)
        existingPrices.push({
          id: pr.id,
          product_id: product.id,
          custom_data: { integration: "restormel-keys", keys_price_key: priceDef.key },
          unit_price: { amount: String(priceDef.amountMinor), currency_code: priceDef.currency },
        });
    }
  }

  const envOutput = buildEnvOutput(mode, priceResults);

  console.log("");
  console.log("=== Restormel Keys Paddle catalog ===");
  for (const p of priceResults) {
    console.log(`  ${p.definition.envVar}: ${p.id} ${p.created ? "(created)" : "(reused)"}`);
  }
  console.log("");
  console.log("=== Env block (price IDs) ===");
  console.log(envOutput);

  if (options.writeEnvPath) {
    const abs = resolve(process.cwd(), options.writeEnvPath);
    writeFileSync(abs, envOutput, "utf-8");
    console.log(`[PADDLE] Wrote ${abs}`);
  }
}

main().catch((err) => {
  console.error("[PADDLE] Bootstrap failed:", err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
