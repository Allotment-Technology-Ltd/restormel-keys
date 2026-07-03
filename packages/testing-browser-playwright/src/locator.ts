import type { Page } from "playwright";
import type { TestingLocator } from "./types.js";

export function resolveLocator(page: Page, loc: TestingLocator) {
  if (loc.kind === "css") {
    return page.locator(loc.selector);
  }
  const { role, name } = loc;
  return name === undefined ? page.getByRole(role) : page.getByRole(role, { name });
}
