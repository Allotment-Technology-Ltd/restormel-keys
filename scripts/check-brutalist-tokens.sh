#!/usr/bin/env bash
# Neo-Brutalist token governance (docs/DESIGN-SPECIFICATION.md v3).
# Guards the canonical palette against drift back to pastels/soft SaaS, and verifies
# the brutalist layer is wired into the app + that motion is reduced-motion safe.
# Exit 0 if all checks pass; 1 otherwise.

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOKENS="${REPO_ROOT}/packages/keys-tokens/src/brutalist-rm.css"
BASE="${REPO_ROOT}/packages/keys-tokens/src/base.css"
UTILS="${REPO_ROOT}/apps/dashboard/src/lib/styles/brutalist-utilities.css"
APP_CSS="${REPO_ROOT}/apps/dashboard/src/app.css"
MARKETING_CSS="${REPO_ROOT}/apps/dashboard/src/lib/styles/marketing-shell.css"

FAIL=0
fail() { echo "check-brutalist-tokens: $1" >&2; FAIL=1; }

for f in "$TOKENS" "$BASE" "$UTILS" "$APP_CSS" "$MARKETING_CSS"; do
  [[ -f "$f" ]] || fail "missing required file: ${f#$REPO_ROOT/}"
done

# 1) Canonical palette values must be present and exact (case-insensitive hex).
assert_value() {
  local name="$1" hex="$2" file="${3:-$TOKENS}"
  if ! grep -iqE -e "${name}:[[:space:]]*${hex};" "$file"; then
    fail "palette drift: expected ${name}: ${hex} in ${file#$REPO_ROOT/}"
  fi
}
assert_value "--color-bg" "#f3ead0"
assert_value "--color-ink" "#0c0c0c"
assert_value "--color-yellow" "#ffd600"
assert_value "--color-blue" "#1a3f8a"
assert_value "--coral-alert-active" "#d94e47" "$BASE"

# Legacy --brut-* aliases must map to the v3 palette (not stale v2 literals).
grep -qE -e "--brut-canvas:[[:space:]]*var\\(--color-bg\\);" "$TOKENS" || fail "expected --brut-canvas alias to --color-bg"
grep -qE -e "--brut-ink:[[:space:]]*var\\(--color-ink\\);" "$TOKENS" || fail "expected --brut-ink alias to --color-ink"
grep -qE -e "--brut-neon:[[:space:]]*var\\(--color-yellow\\);" "$TOKENS" || fail "expected --brut-neon alias to --color-yellow"
grep -qE -e "--brut-blue:[[:space:]]*var\\(--color-blue\\);" "$TOKENS" || fail "expected --brut-blue alias to --color-blue"
grep -qE -e "--brut-coral:[[:space:]]*var\\(--coral-alert-active\\);" "$TOKENS" || fail "expected --brut-coral alias to --coral-alert-active"

# 2) Structure: zero radius + hard offset shadow (no ambient blur in the shadow token).
grep -qE -e "--rm-radius:[[:space:]]*0;" "$TOKENS" || fail "expected --rm-radius: 0 (zero radius)"
grep -qE -e "--shadow-md:[[:space:]]*5px 5px 0" "$TOKENS" || fail "expected hard 5px 5px 0 block shadow on --shadow-md"
grep -qE -e "--brut-shadow:[[:space:]]*var\\(--shadow-md\\);" "$TOKENS" || fail "expected --brut-shadow to alias --shadow-md"

# 3) Wiring: app + marketing shells must import the brutalist token layer.
grep -q "brutalist-rm.css" "$APP_CSS" || fail "app.css must import @restormel/keys-tokens/brutalist-rm.css"
grep -q "brutalist-utilities.css" "$APP_CSS" || fail "app.css must import brutalist-utilities.css"
grep -q "brutalist-rm.css" "$MARKETING_CSS" || fail "marketing-shell.css must import brutalist-rm.css"

# 4) Motion safety: press utilities must be guarded by prefers-reduced-motion.
grep -q "prefers-reduced-motion" "$UTILS" || fail "brutalist-utilities.css must guard motion with prefers-reduced-motion"

if [[ $FAIL -eq 1 ]]; then
  echo "check-brutalist-tokens: FAILED — see messages above." >&2
  exit 1
fi

echo "check-brutalist-tokens OK (palette, structure, wiring, motion-safety)."
