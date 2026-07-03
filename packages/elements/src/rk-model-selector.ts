import { mount, unmount } from "svelte";
import { ModelSelector } from "@restormel/keys-svelte";
import { defaultThemeCss } from "./theme-inline.js";
import type { KeysInstance } from "@restormel/keys";
import type { ProviderDefinition } from "@restormel/keys";

const TAG = "rk-model-selector";

export class RkModelSelectorElement extends HTMLElement {
  private _root: ShadowRoot | null = null;
  private _container: HTMLDivElement | null = null;
  private _mountInstance: ReturnType<typeof mount> | null = null;

  private _keys: KeysInstance | null = null;
  private _providers: ProviderDefinition[] = [];

  get keys(): KeysInstance | null {
    return this._keys;
  }
  set keys(v: KeysInstance | null) {
    this._keys = v;
    this._update();
  }

  get providers(): ProviderDefinition[] {
    return this._providers;
  }
  set providers(v: ProviderDefinition[]) {
    this._providers = Array.isArray(v) ? v : [];
    this._update();
  }

  connectedCallback(): void {
    if (this._root) return;
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
    if (!this._keys || this._providers.length === 0) return;
    this._mountInstance = mount(ModelSelector, {
      target: this._container,
      props: {
        keys: this._keys,
        providers: this._providers,
        onSelect: (modelId: string, providerId: string) => {
          this.dispatchEvent(
            new CustomEvent("rk-model-selected", {
              bubbles: true,
              composed: true,
              detail: { modelId, providerId },
            })
          );
        },
      },
    });
  }
}

if (typeof customElements !== "undefined" && !customElements.get(TAG)) {
  customElements.define(TAG, RkModelSelectorElement);
}
