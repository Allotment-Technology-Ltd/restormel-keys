# prompt-librarian

Inventory prompt files, classify them (canonical / reference / archive), and recommend promotion to Skill, Rule, or Subagent.

## Purpose

Keep prompt assets governed: known location, clear status, and a path to promote repeated workflows to Skills, stable guardrails to Rules, and specialist review prompts to Subagents. Prevents prompt sprawl and duplicate operating truth.

## When to use

- Adding or moving prompt files (e.g. under prompts/ or docs/reference).
- Cleaning up prompt sprawl or deciding “is this canonical?”
- Deciding whether a repeated prompt should become a Skill, Rule, or Subagent.

## Inputs

- Prompt files and locations (e.g. prompts/canonical|reference|archive, docs/reference, bootstrap_prompts.md).
- docs/prompt-governance.md and docs/prompts-reference.md (current inventory and rules).

## Workflow

1. List all prompt-like files (prompts/*, docs/reference/* prompt packs, bootstrap_prompts, etc.).
2. For each: assign class (canonical / reference / archive) and document in docs/prompts-reference.md.
3. Check for repeated workflows → recommend Skill; stable repo law → recommend Rule; narrow specialist review → recommend Subagent.
4. Update docs/prompts-reference.md with inventory and any promotion recommendations.
5. Do not implement promotions in this skill; only recommend and update inventory.

## Outputs

- Updated docs/prompts-reference.md (inventory and status).
- List of promotion recommendations (workflow → Skill, guardrail → Rule, specialist → Subagent) with short rationale.

## Done criteria

- Every prompt file has a class and is listed in prompts-reference; recommendations are clear and aligned to docs/prompt-governance.md.

## How it saves credits or reduces mistakes

- One structured pass over prompts instead of ad-hoc “where does this go?” Avoids duplicate truth by making canonical vs reference explicit and by recommending promotions instead of creating new one-off prompts repeatedly.
