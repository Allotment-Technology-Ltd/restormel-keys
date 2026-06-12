/**
 * Typed semantic token keys for docs, tooling, and drift checks.
 * Keep in sync with semantic-rm.css and semantic-rk.css.
 */

/** --rm-* semantic keys (brand/app/docs shells). */
export const RM_SEMANTIC_KEYS = [
  "--rm-bg",
  "--rm-surface",
  "--rm-surface-raised",
  "--rm-border",
  "--rm-text",
  "--rm-muted",
  "--rm-dim",
  "--rm-sage",
  "--rm-sage-bg",
  "--rm-font-display",
  "--rm-font-ui",
  "--rm-radius",
  "--rm-container-max",
  "--rm-container-narrow",
  "--rm-reading-width",
  "--rm-card-radius",
  "--rm-card-shadow",
] as const;

/** --rk-* semantic keys (embeddable components). */
export const RK_SEMANTIC_KEYS = [
  "--rk-bg",
  "--rk-bg-elevated",
  "--rk-bg-hover",
  "--rk-border",
  "--rk-text",
  "--rk-text-muted",
  "--rk-accent",
  "--rk-accent-hover",
  "--rk-danger",
  "--rk-danger-hover",
  "--rk-success",
  "--rk-amber",
  "--rk-focus-ring",
  "--rk-radius",
  "--rk-font",
] as const;

export type RmSemanticKey = (typeof RM_SEMANTIC_KEYS)[number];
export type RkSemanticKey = (typeof RK_SEMANTIC_KEYS)[number];

/**
 * State token keys (W2.3) — defined in brutalist-rm.css.
 * Use these instead of --color-*-tint (which are undefined in the brutalist theme
 * and silently ride hex fallbacks, causing invisible-text bugs on light backgrounds).
 */
export const STATE_TOKEN_KEYS = [
  "--state-ok-bg",
  "--state-ok-fg",
  "--state-warn-bg",
  "--state-warn-fg",
  "--state-fail-bg",
  "--state-fail-fg",
] as const;

export type StateTokenKey = (typeof STATE_TOKEN_KEYS)[number];
