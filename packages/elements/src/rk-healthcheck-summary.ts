/**
 * Minimal Healthcheck summary web component for BYOK apps.
 * Set `el.report = <health report object>` (see dashboard embed API schema).
 */
const TAG = "rk-healthcheck-summary";

export class RkHealthcheckSummaryElement extends HTMLElement {
  private _report: any = null;

  get report(): any {
    return this._report;
  }
  set report(value: any) {
    this._report = value;
    this.render();
  }

  connectedCallback() {
    this.render();
  }

  private render() {
    const r = this._report;
    if (!r) {
      this.innerHTML = `<div class="rk-hs-muted">No health report.</div>`;
      return;
    }

    const verified = (r.integrations ?? []).filter((i: any) => i.verificationStatus === "verified").length;
    const pending = (r.integrations ?? []).filter((i: any) => i.verificationStatus === "pending").length;
    const total = (r.integrations ?? []).length;
    const unverified = total - verified;
    const gen = r.generatedAt ? new Date(r.generatedAt).toLocaleString() : "—";
    const modelVerify = r.models?.latestSourceVerifiedAt ? new Date(r.models.latestSourceVerifiedAt).toLocaleString() : "—";

    this.innerHTML = `
      <style>
        :host { display: block; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: var(--rk-text, #e8e8ec); }
        .rk-hs-header { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
        .rk-hs-title { margin: 0; font-size: 1.1rem; font-weight: 700; }
        .rk-hs-muted { opacity: 0.75; font-size: 0.85rem; }
        .rk-hs-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 12px; }
        .rk-hs-card { border: 1px solid var(--rk-border, #2a2a2e); border-radius: 10px; padding: 12px; background: var(--rk-bg, #1a1a1e); }
        .rk-hs-label { font-size: 0.75rem; opacity: 0.75; text-transform: uppercase; letter-spacing: 0.05em; }
        .rk-hs-value { font-size: 1.4rem; font-weight: 800; margin: 4px 0; }
        .rk-hs-list { list-style: none; padding: 0; margin: 10px 0 0; display: flex; flex-direction: column; gap: 8px; }
        .rk-hs-row { border: 1px solid var(--rk-border, #2a2a2e); border-radius: 10px; padding: 12px; }
        .rk-hs-rowTop { display: flex; justify-content: space-between; gap: 12px; }
        .rk-hs-name { font-weight: 700; }
      </style>
      <div class="rk-hs-header">
        <h3 class="rk-hs-title">Healthcheck</h3>
        <div class="rk-hs-muted">Generated: ${gen}</div>
      </div>
      <div class="rk-hs-grid">
        <div class="rk-hs-card">
          <div class="rk-hs-label">Integrations</div>
          <div class="rk-hs-value">${total}</div>
          <div class="rk-hs-muted">verified ${verified} · pending ${pending} · unverified ${unverified}</div>
        </div>
        <div class="rk-hs-card">
          <div class="rk-hs-label">Policies</div>
          <div class="rk-hs-value">${r.policies?.total ?? 0}</div>
          <div class="rk-hs-muted">workspace policies</div>
        </div>
        <div class="rk-hs-card">
          <div class="rk-hs-label">Models</div>
          <div class="rk-hs-value">${r.models?.total ?? 0}</div>
          <div class="rk-hs-muted">catalog verify ${modelVerify}</div>
        </div>
      </div>
      <ul class="rk-hs-list">
        ${(r.integrations ?? [])
          .map(
            (i: any) => `
          <li class="rk-hs-row">
            <div class="rk-hs-rowTop">
              <div>
                <div class="rk-hs-name">${i.displayName ?? i.providerType}</div>
                <div class="rk-hs-muted">${i.providerType}${i.region ? ` · ${i.region}` : ""}</div>
              </div>
              <div style="text-align:right">
                <div class="rk-hs-muted">${i.verificationStatus ?? "unverified"}</div>
              </div>
            </div>
          </li>
        `
          )
          .join("")}
      </ul>
    `;
  }
}

if (typeof customElements !== "undefined" && !customElements.get(TAG)) {
  customElements.define(TAG, RkHealthcheckSummaryElement);
}

