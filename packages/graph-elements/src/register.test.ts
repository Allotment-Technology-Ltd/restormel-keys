import { describe, it, expect } from "vitest";
import "./register.js";

describe("rg-graph-canvas registration", () => {
  it("registers rg-graph-canvas custom element", () => {
    expect(customElements.get("rg-graph-canvas")).toBeDefined();
  });

  it("maps width and height attributes", () => {
    const el = document.createElement("rg-graph-canvas") as import("./rg-graph-canvas.js").RgGraphCanvasElement;
    el.setAttribute("width", "640");
    el.setAttribute("height", "480");
    expect(el.width).toBe(640);
    expect(el.height).toBe(480);
  });

  it("accepts graph arrays via properties", () => {
    const el = document.createElement("rg-graph-canvas") as import("./rg-graph-canvas.js").RgGraphCanvasElement;
    el.nodes = [{ id: "a", type: "source", label: "A" }];
    el.edges = [];
    expect(el.nodes).toHaveLength(1);
  });
});
