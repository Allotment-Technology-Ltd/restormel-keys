#!/usr/bin/env bash
# Check token parity between packages/svelte theme.css and packages/elements theme-inline.ts (--rk-*).
# Exit 0 if they match; 1 if drift. See docs/design-system-index.md and packages/tokens.

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SVELTE_THEME="${REPO_ROOT}/packages/svelte/src/theme.css"
ELEMENTS_THEME="${REPO_ROOT}/packages/elements/src/theme-inline.ts"

# Output lines "KEY=VALUE" (normalized) for --rk-* in the given file.
get_rk_pairs() {
  local file="$1"
  if [[ "$file" == *.css ]]; then
    sed -n '/\.rk-dark/,/^}/p' "$file" | grep -E '^\s*--rk-[a-z-]+:' | sed 's/^[[:space:]]*//;s/;[[:space:]]*$//' | while IFS= read -r line; do
      key="${line%%:*}"
      val="${line#*:}"
      printf "%s=%s\n" "${key// /}" "$(echo "$val" | sed 's/[[:space:]]*//g')"
    done
  else
    grep -oE '\-\-rk-[a-z-]+: [^;]+' "$file" | while IFS= read -r line; do
      key="${line%%:*}"
      val="${line#*:}"
      printf "%s=%s\n" "${key// /}" "$(echo "$val" | sed 's/[[:space:]]*//g')"
    done
  fi
}

if [[ ! -f "$SVELTE_THEME" ]] || [[ ! -f "$ELEMENTS_THEME" ]]; then
  echo "Token drift check: missing theme file (svelte or elements)." >&2
  exit 1
fi

SVELTE_SORTED="$(mktemp)"
ELEMENTS_SORTED="$(mktemp)"
trap 'rm -f "$SVELTE_SORTED" "$ELEMENTS_SORTED"' EXIT

get_rk_pairs "$SVELTE_THEME" | sort -t= -k1,1 > "$SVELTE_SORTED"
get_rk_pairs "$ELEMENTS_THEME" | sort -t= -k1,1 > "$ELEMENTS_SORTED"

DRIFT=0
while IFS= read -r line; do
  key="${line%%=*}"
  sval="${line#*=}"
  eval="$(grep "^${key}=" "$ELEMENTS_SORTED" 2>/dev/null | cut -d= -f2-)"
  if [[ "$eval" != "$sval" ]]; then
    echo "Token drift: $key" >&2
    echo "  svelte:   $sval" >&2
    echo "  elements: $eval" >&2
    DRIFT=1
  fi
done < "$SVELTE_SORTED"

# Keys only in elements
while IFS= read -r line; do
  key="${line%%=*}"
  if ! grep -q "^${key}=" "$SVELTE_SORTED"; then
    echo "Token only in elements: $key" >&2
    DRIFT=1
  fi
done < "$ELEMENTS_SORTED"

if [[ $DRIFT -eq 1 ]]; then
  echo "check-token-drift: --rk-* parity failed. Align packages/svelte and packages/elements themes." >&2
  exit 1
fi

echo "Token drift check OK (svelte vs elements --rk-* parity)."
