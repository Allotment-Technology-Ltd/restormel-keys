#!/usr/bin/env bash
# Install a skill: curated name (from repo skills/) or GitHub path owner/repo or owner/repo/subpath.
# Target: $CODEX_HOME/skills (default ~/.codex/skills if unset).
# Usage: install-skill.sh <skill-name-or-github-path>
set -e
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
SKILLS_ROOT="${CODEX_HOME}/skills"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

mkdir -p "$SKILLS_ROOT"

arg="${1:?Usage: install-skill.sh <skill-name|owner/repo|owner/repo/subpath>}"

if [[ "$arg" == */* ]]; then
  # GitHub path: owner/repo or owner/repo/subpath
  if [[ "$arg" =~ ^[^/]+/[^/]+$ ]]; then
    owner="${arg%%/*}"
    repo="${arg##*/}"
    skill_name="$repo"
    subpath=""
  else
    owner="${arg%%/*}"
    rest="${arg#*/}"
    repo="${rest%%/*}"
    subpath="${rest#$repo/}"
    skill_name="${subpath##*/}"
    [[ -z "$skill_name" ]] && skill_name="$repo"
  fi
  tmpdir=$(mktemp -d)
  trap 'rm -rf "$tmpdir"' EXIT
  if command -v gh &>/dev/null; then
    gh repo clone "$owner/$repo" "$tmpdir" -- --depth 1
  else
    git clone --depth 1 "https://github.com/$owner/$repo.git" "$tmpdir"
  fi
  if [[ -n "$subpath" ]]; then
    cp -r "$tmpdir/$subpath" "$SKILLS_ROOT/$skill_name"
  else
    cp -r "$tmpdir" "$SKILLS_ROOT/$skill_name"
  fi
  echo "Installed to $SKILLS_ROOT/$skill_name"
else
  # Curated: copy from repo skills/<name>
  name="$arg"
  if [[ ! -d "$REPO_ROOT/skills/$name" ]]; then
    echo "No curated skill '$name' in $REPO_ROOT/skills/" >&2
    exit 1
  fi
  cp -r "$REPO_ROOT/skills/$name" "$SKILLS_ROOT/$name"
  echo "Installed to $SKILLS_ROOT/$name"
fi

echo "Restart Codex so the skill is loaded."
