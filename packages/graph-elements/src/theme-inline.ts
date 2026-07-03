/** Minimal :host tokens for GraphCanvas inside shadow DOM (demo parity subset). */
export const defaultGraphThemeCss = `
:host {
  display: block;
  min-height: 240px;
  --color-bg: #1A1917;
  --color-surface: #141312;
  --color-surface-raised: #201F1D;
  --color-text: #E8E6E1;
  --color-muted: #DCD8D0;
  --color-dim: #A8A29A;
  --color-border: #2E2C29;
  --color-sage: #7FA383;
  --color-sage-bg: rgba(127, 163, 131, 0.10);
  --color-sage-border: rgba(127, 163, 131, 0.25);
  --color-copper: #D4936F;
  --color-copper-bg: rgba(212, 147, 111, 0.10);
  --color-copper-border: rgba(212, 147, 111, 0.25);
  --color-blue: #6B9FD4;
  --color-blue-bg: rgba(107, 159, 212, 0.10);
  --color-blue-border: rgba(107, 159, 212, 0.25);
  --radius-sm: 4px;
  --radius-md: 8px;
  --font-ui: system-ui, sans-serif;
  --text-meta: 0.75rem;
}
`;
