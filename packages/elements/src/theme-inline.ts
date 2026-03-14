/**
 * Default theme CSS for shadow DOM. :host lets the host page override --rk-*.
 */
export const defaultThemeCss = `
:host {
  --rk-bg: #1a1b1e;
  --rk-bg-elevated: #25262b;
  --rk-bg-hover: #2c2e33;
  --rk-border: #373a40;
  --rk-text: #e8e8ed;
  --rk-text-muted: #909296;
  --rk-accent: #4dabf7;
  --rk-accent-hover: #74c0fc;
  --rk-danger: #ff6b6b;
  --rk-danger-hover: #ff8787;
  --rk-success: #51cf66;
  --rk-amber: #f59e0b;
  --rk-focus-ring: 0 0 0 2px var(--rk-bg) inset, 0 0 0 4px var(--rk-accent);
  --rk-radius: 6px;
  --rk-font: inherit;
  display: block;
}
`.trim();
