import { expect } from "vitest";

/** Plain classList checks — avoid @testing-library/jest-dom matchers (fragile under Vitest workers in CI). */
export function expectElementHasClasses(el: Element | null, ...classes: string[]): void {
  expect(el).not.toBeNull();
  for (const c of classes) {
    expect(el!.classList.contains(c)).toBe(true);
  }
}
