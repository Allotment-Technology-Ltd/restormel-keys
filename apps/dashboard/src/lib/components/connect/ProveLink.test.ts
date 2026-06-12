// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/svelte";
import ProveLink from "./ProveLink.svelte";
import { PROVE_LINK_CLASS, proveClaimsFilterHref } from "$lib/prove-it";

/**
 * The shared "Prove it" affordance (W4.3). Contract:
 *  - it is always an <a> (read-only by construction — safe on the mobile / as-of
 *    read-only tiers, since it mutates nothing);
 *  - it carries the grep-able PROVE_LINK_CLASS;
 *  - it renders the ↗ glyph by default and can suppress it.
 */
describe("ProveLink", () => {
  it("renders an anchor with the shared prove-it class and the destination href", () => {
    const href = proveClaimsFilterHref("review");
    const { container } = render(ProveLink, { props: { href } });
    const a = container.querySelector("a");
    expect(a).toBeTruthy();
    expect(a!.getAttribute("href")).toBe(href);
    expect(a!.classList.contains(PROVE_LINK_CLASS)).toBe(true);
    expect(a!.hasAttribute("data-prove-it")).toBe(true);
  });

  it("renders the ↗ glyph by default and hides it from assistive tech", () => {
    const { container } = render(ProveLink, { props: { href: "/x" } });
    const arrow = container.querySelector(".prove-it-arrow");
    expect(arrow).toBeTruthy();
    expect(arrow!.getAttribute("aria-hidden")).toBe("true");
  });

  it("suppresses the glyph when arrow={false}", () => {
    const { container } = render(ProveLink, { props: { href: "/x", arrow: false } });
    expect(container.querySelector(".prove-it-arrow")).toBeNull();
  });

  it("is read-only: it never renders a button or a form-mutating element", () => {
    const { container } = render(ProveLink, { props: { href: "/x" } });
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector("form")).toBeNull();
  });
});
