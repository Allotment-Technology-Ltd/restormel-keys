/**
 * Default theme CSS for shadow DOM. :host lets the host page override --rk-*.
 * Must match packages/svelte/src/theme.css and @restormel/keys-tokens semantic-rk (design system).
 */
export const defaultThemeCss = `
:host {
  --rk-bg: #0f1419;
  --rk-bg-elevated: #1a1f26;
  --rk-bg-hover: #212830;
  --rk-border: #2e3440;
  --rk-text: #e8edf2;
  --rk-text-muted: #c4cfdb;
  --rk-accent: #4c8dff;
  --rk-accent-hover: #6ba3ff;
  --rk-danger: #f25c54;
  --rk-danger-hover: #f4736d;
  --rk-success: #2ec4b6;
  --rk-amber: #ffb84d;
  --rk-focus-ring: 0 0 0 2px rgba(76, 141, 255, 0.5);
  --rk-radius: 6px;
  --rk-font: inherit;
  display: block;
}
`.trim();
