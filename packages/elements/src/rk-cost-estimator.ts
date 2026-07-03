import { mount, unmount } from "svelte";
import { CostEstimator } from "@restormel/keys-svelte";
import { defaultThemeCss } from "./theme-inline.js";
import type { CostEstimateResult } from "@restormel/keys";

const TAG = "rk-cost-estimator";

export class RkCostEstimatorElement extends HTMLElement {
  static observedAttributes = ["budget", "estimated-cost"];

  private _root: ShadowRoot | null = null;
  private _container: HTMLDivElement | null = null;
  private _mountInstance: ReturnType<typeof mount> | null = null;

  private _cost: CostEstimateResult | null = null;
  private _budget: number | undefined;
  private _estimatedCost: number | undefined;

  get cost(): CostEstimateResult | null {
    return this._cost;
  }
  set cost(v: CostEstimateResult | null) {
    this._cost = v;
    this._update();
    this.dispatchEvent(
      new CustomEvent("rk-cost-updated", {
        bubbles: true,
        composed: true,
        detail: { cost: this._cost, budget: this._budget, estimatedCost: this._estimatedCost },
      })
    );
  }

  get budget(): number | undefined {
    return this._budget;
  }
  set budget(v: number | undefined) {
    this._budget = v;
    this._update();
  }

  get estimatedCost(): number | undefined {
    return this._estimatedCost;
  }
  set estimatedCost(v: number | undefined) {
    this._estimatedCost = v;
    this._update();
  }

  attributeChangedCallback(name: string, _old: string | null, newVal: string | null): void {
    const n = newVal != null ? Number(newVal) : undefined;
    if (name === "budget") this._budget = Number.isFinite(n) ? n : undefined;
    if (name === "estimated-cost") this._estimatedCost = Number.isFinite(n) ? n : undefined;
    this._update();
  }

  connectedCallback(): void {
    if (this._root) return;
    const budgetAttr = this.getAttribute("budget");
    const estAttr = this.getAttribute("estimated-cost");
    if (budgetAttr != null) this._budget = Number(budgetAttr);
    if (estAttr != null) this._estimatedCost = Number(estAttr);
    this._root = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = defaultThemeCss;
    this._root.appendChild(style);
    this._container = document.createElement("div");
    this._root.appendChild(this._container);
    this._update();
  }

  disconnectedCallback(): void {
    if (this._mountInstance) {
      unmount(this._mountInstance);
      this._mountInstance = null;
    }
    this._container = null;
    this._root = null;
  }

  private _update(): void {
    if (!this._container || !this._root) return;
    if (this._mountInstance) {
      unmount(this._mountInstance);
      this._mountInstance = null;
    }
    this._mountInstance = mount(CostEstimator, {
      target: this._container,
      props: {
        cost: this._cost,
        budget: this._budget,
        estimatedCost: this._estimatedCost,
      },
    });
  }
}

if (typeof customElements !== "undefined" && !customElements.get(TAG)) {
  customElements.define(TAG, RkCostEstimatorElement);
}
