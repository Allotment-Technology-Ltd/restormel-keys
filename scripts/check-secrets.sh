#!/usr/bin/env bash
# Search for obvious secret patterns and tracked .env. Exit 0 if clean; exit 1 if something suspicious.
# Aligns to docs/bootstrap-plan.md and docs/governance/security-baseline.md (no committed secrets).
# Requires: bash, git (for tracked-file checks). Run from repo root or scripts/.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
FOUND=0

# Tracked .env is a policy violation
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if git ls-files --error-unmatch .env 2>/dev/null; then
    echo "BLOCKING: .env is tracked. Remove from git: git rm --cached .env ; add .env to .gitignore."
    FOUND=1
  fi
fi

# Simple secret-like patterns (high false-positive; review any match)
PATTERNS="sk_live_[0-9a-zA-Z]{20,} sk_test_[0-9a-zA-Z]{20,} AKIA[0-9A-Z]{16}"
EXCLUDE="example|placeholder|xxx|redact|dummy|sample.*key|your.*key"
for pattern in $PATTERNS; do
  matches=""
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    matches=$(git grep -E "$pattern" -- '*.md' '*.ts' '*.js' '*.json' '*.yaml' '*.yml' 2>/dev/null | grep -vE "$EXCLUDE" || true)
  else
    matches=$(grep -rE "$pattern" --include='*.md' --include='*.ts' --include='*.js' --include='*.json' --include='*.yaml' --include='*.yml' . 2>/dev/null | grep -vE "$EXCLUDE" || true)
  fi
  if [ -n "$matches" ]; then
    echo "Possible secret pattern in tracked files: $pattern — review and remove or redact (see docs/governance/security-baseline.md)."
    FOUND=1
  fi
done

if [ "$FOUND" -eq 0 ]; then
  echo "Secret check OK (no obvious patterns or tracked .env)"
  exit 0
else
  echo "Address the items above, then re-run this script."
  exit 1
fi
