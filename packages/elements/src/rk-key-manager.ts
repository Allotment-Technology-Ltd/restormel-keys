import { mount, unmount } from "svelte";
import { KeyManager } from "@restormel/keys-svelte";
import { defaultThemeCss } from "./theme-inline.js";
import type { KeysInstance } from "@restormel/keys";
import type { KeyConfig, KeyAddResult, KeyRemoveResult } from "@restormel/keys";
import type { ProviderDefinition, ProviderValidationResult } from "@restormel/keys";

export interface RkKeyManagerProps {
  keys: KeysInstance | null;
  userId: string;
  providers?: ProviderDefinition[];
}

const TAG = "rk-key-manager";

export class RkKeyManagerElement extends HTMLElement {
  static observedAttributes = ["user-id"];

  private _root: ShadowRoot | null = null;
  private _container: HTMLDivElement | null = null;
  private _mountInstance: ReturnType<typeof mount> | null = null;

  private _keys: KeysInstance | null = null;
  private _userId = "";
  private _providers: ProviderDefinition[] = [];
  private _onValidate: ((provider: string, rawCredential: string) => Promise<ProviderValidationResult>) | undefined;
  private _onRevalidate: ((keyId: string, provider: string) => Promise<ProviderValidationResult>) | undefined;

  get keys(): KeysInstance | null {
    return this._keys;
  }
  set keys(v: KeysInstance | null) {
    this._keys = v;
    this._update();
  }

  get userId(): string {
    return this._userId;
  }
  set userId(v: string) {
    this._userId = v ?? "";
    this._update();
  }

  get providers(): ProviderDefinition[] {
    return this._providers;
  }
  set providers(v: ProviderDefinition[]) {
    this._providers = Array.isArray(v) ? v : [];
    this._update();
  }

  get onValidate(): ((provider: string, rawCredential: string) => Promise<ProviderValidationResult>) | undefined {
    return this._onValidate;
  }
  set onValidate(v: ((provider: string, rawCredential: string) => Promise<ProviderValidationResult>) | undefined) {
    this._onValidate = v;
    this._update();
  }

  get onRevalidate(): ((keyId: string, provider: string) => Promise<ProviderValidationResult>) | undefined {
    return this._onRevalidate;
  }
  set onRevalidate(v: ((keyId: string, provider: string) => Promise<ProviderValidationResult>) | undefined) {
    this._onRevalidate = v;
    this._update();
  }

  attributeChangedCallback(name: string, _old: string | null, newVal: string | null): void {
    if (name === "user-id") this._userId = newVal ?? "";
    this._update();
  }

  connectedCallback(): void {
    if (this._root) return;
    if (this.hasAttribute("user-id")) this._userId = this.getAttribute("user-id") ?? "";
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
    if (!this._keys) return;
    this._mountInstance = mount(KeyManager, {
      target: this._container,
      props: {
        keys: this._keys,
        userId: this._userId,
        providers: this._providers,
        onValidate: this._onValidate,
        onRevalidate: this._onRevalidate,
        onKeyAdded: (key: KeyConfig, apiKey?: string): Promise<KeyAddResult> => {
          return new Promise((resolve) => {
            const event = new CustomEvent("rk-key-added", {
              bubbles: true,
              composed: true,
              detail: { key, apiKey, resolve },
            });
            const handled = this.dispatchEvent(event);
            if (!handled) resolve({ ok: true });
            const detail = (event as CustomEvent).detail;
            if (detail._result) {
              resolve(detail._result);
            } else {
              resolve({ ok: true });
            }
          });
        },
        onKeyRemoved: (keyId: string): Promise<KeyRemoveResult> => {
          return new Promise((resolve) => {
            const event = new CustomEvent("rk-key-removed", {
              bubbles: true,
              composed: true,
              detail: { keyId, resolve },
            });
            this.dispatchEvent(event);
            const detail = (event as CustomEvent).detail;
            if (detail._result) {
              resolve(detail._result);
            } else {
              resolve({ ok: true });
            }
          });
        },
      },
    });
  }
}

if (typeof customElements !== "undefined" && !customElements.get(TAG)) {
  customElements.define(TAG, RkKeyManagerElement);
}
