<!-- Restormel PR template. Keep it short — the goal is a clean, attributable trail. -->

## What & why

<!-- One or two lines, then link the issue so work auto-associates and status moves.
     Use `Ref #N` for items tracked through deploy (merge -> ready-deploy, deploy closes it).
     Use `Closes #N` only if the item is truly done at merge (docs/chores). -->
Ref #

## Type

- [ ] feature  - [ ] bug  - [ ] task/chore  - [ ] spike  - [ ] docs

## Checklist

- [ ] CI is green (Forgejo Actions)
- [ ] Linked to its issue (`Ref`/`Closes #` above) and the right milestone/labels are set
- [ ] No secrets in the diff
- [ ] **Records:** if this changes a managed fact (asset, sub-processor/connector, data
      flow, capability, decision), the matching `records/` register entry is updated in the
      same change (per `OPERATING-MANUAL.md` self-maintaining-records norm)
- [ ] **Sovereignty:** no regulated/customer data added to a US-SaaS path; pushed to
      Forgejo (`origin`) only, never the GitHub mirror
- [ ] Docs/quickstart updated if behaviour changed
