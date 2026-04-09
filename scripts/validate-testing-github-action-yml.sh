#!/usr/bin/env bash
# Parse packages/testing-github-action/action.yml with a strict YAML loader.
# Catches mistakes that break GitHub composite manifest loading (e.g. unescaped quotes in descriptions).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="$ROOT/packages/testing-github-action/action.yml"
if [[ ! -f "$FILE" ]]; then
  echo "::error::Missing $FILE"
  exit 1
fi
if ! command -v ruby >/dev/null 2>&1; then
  echo "::error::ruby is required (Psych YAML)"
  exit 1
fi
ruby -ryaml -e "YAML.load_file(ARGV[0])" "$FILE"
echo "OK: $FILE parses as YAML"
