# skill-installer

Install skills from a curated list or from GitHub into `$CODEX_HOME/skills`. Always remind the user to restart Codex after install.

## Purpose

Get skills into the environment in a repeatable way: list what’s available, install from curated list or from a GitHub path (including private repos the user can access), using a fixed target and optional helper script.

## When to use

- User wants to **list** installable skills.
- User wants to **install** a curated skill or a skill from a GitHub repo path (e.g. `owner/repo` or `owner/repo/path/to/skill`).

## Inputs

- **List:** none (or path to curated list if not default).
- **Install:** skill name (from curated list) or GitHub path (`owner/repo` or `owner/repo/subpath`). Optional: install target (default `$CODEX_HOME/skills`).

## Workflow

### 1. List curated installable skills

- Read the curated list. For Restormel Keys this repo, the curated set is the nine skills under `skills/`: skill-installer, repo-bootstrapper, docs-maintainer, roadmap-status-sync, changelog-updater, prompt-librarian, security-review, architecture-recorder, release-prep.
- Output the list with names and one-line purpose (from each SKILL.md). If the list lives in a file (e.g. `skills/curated-list.md` or docs/governance/skills.md), read that and output it.

### 2. Install a curated skill

- Resolve the skill’s source path (e.g. this repo’s `skills/<name>/`).
- Set install target: `$CODEX_HOME/skills`; if `CODEX_HOME` is unset, use `~/.codex/skills` or ask the user.
- Copy the skill directory into the target: `cp -r skills/<name> "$CODEX_HOME/skills/<name>"` (or equivalent). Create `$CODEX_HOME/skills` if it does not exist.
- Confirm: “Installed to $CODEX_HOME/skills/<name>”.
- Remind: “Restart Codex so the skill is loaded.”

### 3. Install from a GitHub repo path

- Parse the path: `owner/repo` or `owner/repo/subpath`. Skill name = last path segment (e.g. `subpath` or `repo`).
- Set install target: `$CODEX_HOME/skills/<skill-name>`. Create parent dir if needed.
- Clone or fetch only the needed path. Prefer:
  - `git clone --depth 1 https://github.com/owner/repo.git <temp-dir>` then copy `repo/subpath` or `repo` into `$CODEX_HOME/skills/<skill-name>`, then remove temp dir; or
  - `gh repo clone owner/repo <temp-dir>` if user has `gh` and is authenticated (works for private repos they can access).
- If the repo root is the skill, copy contents of `<temp-dir>` into `$CODEX_HOME/skills/<skill-name>`. Ensure at least a SKILL.md (or documented descriptor) is present.
- Confirm: “Installed to $CODEX_HOME/skills/<skill-name>”.
- Remind: “Restart Codex so the skill is loaded.”

### 4. Helper script (where useful)

- Use `skills/skill-installer/install-skill.sh <name-or-github-path>` when in the repo: it resolves curated name vs GitHub path, creates `$CODEX_HOME/skills` if needed, copies or clones into `$CODEX_HOME/skills/<name>`, prints path and restart reminder. Uses `gh repo clone` for GitHub if available (works with private repos the user can access), else `git clone`.
- From outside the repo, follow steps 2 or 3 above; or clone the repo and run the script for determinism.

## Outputs

- **List:** printed or written list of curated skills with names and purposes.
- **Install:** install path (e.g. `$CODEX_HOME/skills/<name>`), plus: “Restart Codex after install so the skill is loaded.”

## Done criteria

- **List:** user has a list of installable skills.
- **Install:** skill files are under `$CODEX_HOME/skills/<name>`; user has been told to restart Codex.

## How it saves credits or reduces mistakes

- One target (`$CODEX_HOME/skills`), one procedure for curated vs GitHub, optional script for repeatability. Restart reminder every time avoids “skill not loading” confusion.
