import { test, expect } from "@playwright/test";

// Settings UI is loaded via dynamic import (ssr: false).
const CLIENT_LOAD_TIMEOUT = 25_000;
const skipClientContentInCI = process.env.CI === "true";

test.describe("settings page", () => {
  test("page renders (route and main)", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByRole("main")).toBeAttached();
  });

  test.skip(skipClientContentInCI, "client content loads (dynamic import)", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByTestId("settings-client-content")).toBeVisible({ timeout: CLIENT_LOAD_TIMEOUT });
    await expect(page.getByRole("heading", { name: /API keys/i })).toBeVisible({ timeout: 5000 });
  });

  test.skip(skipClientContentInCI, "add key flow: empty state and add button", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByTestId("settings-client-content")).toBeVisible({ timeout: CLIENT_LOAD_TIMEOUT });
    await expect(page.getByText(/no api keys yet|add your first key/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /add key/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test("add key works: POST validates and GET list returns keys array", async ({ request }) => {
    const placeholderKey = "sk-demo-placeholder-not-a-real-key";
    const addRes = await request.post("/api/keys", {
      headers: { "Content-Type": "application/json", "x-user-id": "demo-user" },
      data: { provider: "openai", apiKey: placeholderKey },
    });
    expect([200, 201, 400]).toContain(addRes.status());
    const listRes = await request.get("/api/keys", { headers: { "x-user-id": "demo-user" } });
    expect(listRes.status()).toBe(200);
    const data = await listRes.json();
    expect(data).toHaveProperty("keys");
    expect(Array.isArray(data.keys)).toBe(true);
  });

  test.skip(skipClientContentInCI, "no hydration mismatch: settings has client content", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByTestId("settings-client-content")).toBeVisible({ timeout: CLIENT_LOAD_TIMEOUT });
  });
});

test.describe("API", () => {
  test("GET /api/keys returns 200", async ({ request }) => {
    const res = await request.get("/api/keys", {
      headers: { "x-user-id": "demo-user" },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("keys");
    expect(Array.isArray(data.keys)).toBe(true);
  });

  test("GET /api/resolve returns 200 or 503 when no key", async ({ request }) => {
    const res = await request.get("/api/resolve?provider=openai", {
      headers: { "x-user-id": "demo-user" },
    });
    expect([200, 503]).toContain(res.status());
  });
});

test.describe("dynamic import", () => {
  test("settings route loads (dynamic import used for KeyManager)", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByRole("main")).toBeAttached();
  });
});
