import { test, expect } from "@playwright/test";

test("home page renders and links to settings", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /restormel keys/i })).toBeVisible();
  await page.getByRole("link", { name: /settings/i }).click();
  await expect(page).toHaveURL(/\/settings/);
});
