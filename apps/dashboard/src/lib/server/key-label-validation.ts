/**
 * Validates that a label string does not contain key material.
 *
 * The regex is unanchored — it matches `rk_<8+chars>` anywhere in the string,
 * not just at the start. This prevents bypasses like "prod key rk_<fullkey>".
 *
 * Used by POST /api/projects/[id]/keys and PATCH /api/projects/[id]/keys.
 */
export function labelContainsKeyMaterial(label: string): boolean {
  return /rk_[A-Za-z0-9_-]{8,}/.test(label);
}
