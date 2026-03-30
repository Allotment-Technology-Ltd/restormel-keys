#!/usr/bin/env node
/**
 * Sync Paddle USD price IDs from canonical GBP prices.
 *
 * GBP remains canonical. USD is derived from GBP using FX and rounding policy.
 * By default this runs in report mode. Use --apply to create/update prices and
 * write Vercel production env vars.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const APPLY = process.argv.includes("--apply");
const REDEPLOY = process.argv.includes("--redeploy");

const PADDLE_API_KEY = (process.env.PADDLE_API_KEY || "").trim();
if (!PADDLE_API_KEY) {
  console.error("Missing required env: PADDLE_API_KEY");
  process.exit(1);
}

const GBP_MONTHLY_MINOR = parseInt(process.env.CANONICAL_PRO_MONTHLY_GBP_MINOR || "1000", 10); // £10
const GBP_ANNUAL_MINOR = parseInt(process.env.CANONICAL_PRO_ANNUAL_GBP_MINOR || "19200", 10); // £192
const USD_ROUNDING_CENTS = parseInt(process.env.USD_ROUNDING_CENTS || "100", 10); // nearest $1
const MIN_DRIFT_CENTS = parseInt(process.env.USD_MIN_DRIFT_CENTS || "100", 10); // update if >= $1 drift
const FX_URL = (process.env.FX_RATE_URL || "https://api.frankfurter.app/latest?from=GBP&to=USD").trim();

const ROOT = resolve(".");
const VERCEL_TOKEN = (process.env.VERCEL_TOKEN || "").trim();

function assertPositiveInt(name, value) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
}

assertPositiveInt("CANONICAL_PRO_MONTHLY_GBP_MINOR", GBP_MONTHLY_MINOR);
assertPositiveInt("CANONICAL_PRO_ANNUAL_GBP_MINOR", GBP_ANNUAL_MINOR);
assertPositiveInt("USD_ROUNDING_CENTS", USD_ROUNDING_CENTS);
assertPositiveInt("USD_MIN_DRIFT_CENTS", MIN_DRIFT_CENTS);

function roundTo(value, step) {
  return Math.max(step, Math.round(value / step) * step);
}

function deriveUsdMinor(gbpMinor, rate) {
  const rawUsdMinor = gbpMinor * rate;
  return roundTo(rawUsdMinor, USD_ROUNDING_CENTS);
}

async function paddleGet(path) {
  const res = await fetch(`https://api.paddle.com${path}`, {
    headers: {
      Authorization: `Bearer ${PADDLE_API_KEY}`,
      "Content-Type": "application/json",
      "Paddle-Version": "1",
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = body?.error?.detail || body?.error?.message || res.statusText;
    throw new Error(`Paddle GET ${path} failed (${res.status}): ${detail}`);
  }
  return body;
}

async function paddlePost(path, payload) {
  const res = await fetch(`https://api.paddle.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PADDLE_API_KEY}`,
      "Content-Type": "application/json",
      "Paddle-Version": "1",
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = body?.error?.detail || body?.error?.message || res.statusText;
    throw new Error(`Paddle POST ${path} failed (${res.status}): ${detail}`);
  }
  return body;
}

function parseMinorAmount(price) {
  const amount = price?.unit_price?.amount;
  const n = parseInt(String(amount ?? ""), 10);
  return Number.isFinite(n) ? n : null;
}

function isActive(price) {
  return String(price?.status || "").toLowerCase() === "active";
}

function customKey(price) {
  return typeof price?.custom_data?.keys_price_key === "string" ? price.custom_data.keys_price_key : null;
}

function createdAtValue(item) {
  const raw = item?.created_at;
  const t = Date.parse(raw || "");
  return Number.isFinite(t) ? t : 0;
}

function newest(items) {
  return [...items].sort((a, b) => createdAtValue(b) - createdAtValue(a))[0] || null;
}

function runVercel(args, input) {
  const full = ["vercel", ...args];
  const res = spawnSync("npx", full, {
    cwd: ROOT,
    input,
    encoding: "utf8",
    env: {
      ...process.env,
      ...(VERCEL_TOKEN ? { VERCEL_TOKEN } : {}),
    },
  });
  if (res.status !== 0) {
    throw new Error(`Failed: npx ${full.join(" ")}\n${res.stderr || res.stdout}`);
  }
}

function setVercelEnv(name, value) {
  runVercel(["env", "rm", name, "production", "--yes", ...(VERCEL_TOKEN ? ["--token", VERCEL_TOKEN] : [])], "");
  runVercel(["env", "add", name, "production", ...(VERCEL_TOKEN ? ["--token", VERCEL_TOKEN] : [])], String(value));
}

async function main() {
  console.log(`[FX] Source: ${FX_URL}`);
  const fxRes = await fetch(FX_URL);
  if (!fxRes.ok) throw new Error(`FX request failed (${fxRes.status})`);
  const fxJson = await fxRes.json();
  const rate = Number(fxJson?.rates?.USD);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("Invalid GBP->USD rate from FX source");

  const targetMonthlyUsd = deriveUsdMinor(GBP_MONTHLY_MINOR, rate);
  const targetAnnualUsd = deriveUsdMinor(GBP_ANNUAL_MINOR, rate);

  console.log(`[FX] GBP->USD rate: ${rate}`);
  console.log(`[TARGET] Monthly USD minor: ${targetMonthlyUsd}`);
  console.log(`[TARGET] Annual USD minor: ${targetAnnualUsd}`);

  const productsRes = await paddleGet("/products?per_page=100&include=prices");
  const products = Array.isArray(productsRes?.data) ? productsRes.data : [];
  const product = products.find(
    (p) => p?.custom_data?.keys_product_key === "keys_pro" || p?.name === "Restormel Keys Pro",
  );
  if (!product?.id) throw new Error("Could not find Paddle product: Restormel Keys Pro");
  const prices = Array.isArray(product?.prices) ? product.prices : [];

  const monthlyCandidates = prices.filter((p) => customKey(p) === "keys_pro_monthly_usd");
  const annualCandidates = prices.filter((p) => customKey(p) === "keys_pro_annual_usd");

  const currentMonthly = newest(monthlyCandidates.filter(isActive)) || newest(monthlyCandidates);
  const currentAnnual = newest(annualCandidates.filter(isActive)) || newest(annualCandidates);

  const currentMonthlyMinor = currentMonthly ? parseMinorAmount(currentMonthly) : null;
  const currentAnnualMinor = currentAnnual ? parseMinorAmount(currentAnnual) : null;

  const monthlyDrift = currentMonthlyMinor == null ? Infinity : Math.abs(currentMonthlyMinor - targetMonthlyUsd);
  const annualDrift = currentAnnualMinor == null ? Infinity : Math.abs(currentAnnualMinor - targetAnnualUsd);

  console.log(`[CURRENT] Monthly USD: ${currentMonthlyMinor ?? "none"} (${currentMonthly?.id ?? "n/a"})`);
  console.log(`[CURRENT] Annual USD: ${currentAnnualMinor ?? "none"} (${currentAnnual?.id ?? "n/a"})`);
  console.log(`[DRIFT] Monthly: ${monthlyDrift} cents | Annual: ${annualDrift} cents`);

  let monthlyId = currentMonthly?.id || "";
  let annualId = currentAnnual?.id || "";

  const shouldUpdateMonthly = monthlyDrift >= MIN_DRIFT_CENTS;
  const shouldUpdateAnnual = annualDrift >= MIN_DRIFT_CENTS;

  if (!APPLY) {
    console.log("[MODE] Dry-run only. Use --apply to create/update Paddle prices and Vercel env.");
    process.exit(0);
  }

  if (!VERCEL_TOKEN) {
    throw new Error("Missing required env for --apply: VERCEL_TOKEN");
  }

  if (shouldUpdateMonthly) {
    const created = await paddlePost("/prices", {
      product_id: product.id,
      name: "Pro Monthly (USD)",
      description: "Restormel Keys Pro monthly subscription in USD.",
      unit_price: { amount: String(targetMonthlyUsd), currency_code: "USD" },
      billing_cycle: { interval: "month", frequency: 1 },
      custom_data: {
        integration: "restormel-keys",
        keys_price_key: "keys_pro_monthly_usd",
      },
    });
    monthlyId = created?.data?.id || monthlyId;
    console.log(`[APPLY] Created new monthly USD price: ${monthlyId}`);
  } else {
    console.log("[APPLY] Monthly USD within drift threshold; reusing current price.");
  }

  if (shouldUpdateAnnual) {
    const created = await paddlePost("/prices", {
      product_id: product.id,
      name: "Pro Annual (USD)",
      description: "Restormel Keys Pro annual subscription in USD.",
      unit_price: { amount: String(targetAnnualUsd), currency_code: "USD" },
      billing_cycle: { interval: "year", frequency: 1 },
      custom_data: {
        integration: "restormel-keys",
        keys_price_key: "keys_pro_annual_usd",
      },
    });
    annualId = created?.data?.id || annualId;
    console.log(`[APPLY] Created new annual USD price: ${annualId}`);
  } else {
    console.log("[APPLY] Annual USD within drift threshold; reusing current price.");
  }

  if (!monthlyId || !annualId) {
    throw new Error("Unable to resolve final USD price IDs.");
  }

  setVercelEnv("PADDLE_PRICE_KEYS_PRO_MONTHLY_USD", monthlyId);
  setVercelEnv("PADDLE_PRICE_KEYS_PRO_ANNUAL_USD", annualId);
  console.log("[APPLY] Updated Vercel production env vars for USD prices.");

  if (REDEPLOY) {
    runVercel(["--prod", "--yes", ...(VERCEL_TOKEN ? ["--token", VERCEL_TOKEN] : [])], "");
    console.log("[APPLY] Triggered production redeploy.");
  } else {
    console.log("[APPLY] Skipped redeploy. Use --redeploy to publish env updates immediately.");
  }
}

main().catch((err) => {
  console.error("[sync-paddle-usd-prices] failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});

